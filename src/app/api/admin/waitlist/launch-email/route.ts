import { NextResponse } from "next/server";
import { MEMBER_LAUNCH_ENABLED } from "@/lib/launch";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { sendMemberLaunchEmail } from "@/lib/email/memberLaunch";
import { appOrigin } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/waitlist/launch-email
 *   { id: "<waitlist_signup id>" }   one person
 *   { all: true }                    everyone still waiting (max 200 per call)
 *
 * Sends the "doors are open" email with a prefilled signup link. Refused
 * (409) while MEMBER_LAUNCH_ENABLED is not true, so nobody can be emailed
 * before the member portal is open. Each signup is emailed once
 * (launch_email_sent_at); a resend needs { id, resend: true }.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!MEMBER_LAUNCH_ENABLED) {
    return NextResponse.json(
      { error: "Member launch is off. Set MEMBER_LAUNCH_ENABLED=true (and NEXT_PUBLIC_MEMBER_LAUNCH_ENABLED=true), redeploy, then send." },
      { status: 409 },
    );
  }

  let body: { id?: string; all?: boolean; resend?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const origin = appOrigin();
  try {
    let query = sb
      .from("waitlist_signups")
      .select("id, email, full_name, status, launch_email_sent_at")
      .eq("role", "member")
      .neq("status", "declined")
      .neq("status", "converted");
    if (body.id) query = query.eq("id", body.id);
    else if (body.all) query = query.is("launch_email_sent_at", null).limit(200);
    else return NextResponse.json({ error: "Give an id or all: true." }, { status: 400 });

    const { data: rows, error } = await query;
    if (error) throw error;
    if (body.id && rows?.length === 1 && rows[0].launch_email_sent_at && !body.resend) {
      return NextResponse.json({ error: "Already sent. Use resend to send again." }, { status: 409 });
    }

    const sent: string[] = [];
    const failed: string[] = [];
    for (const r of rows ?? []) {
      const ok = await sendMemberLaunchEmail({
        to: r.email,
        fullName: r.full_name,
        joinUrl: `${origin}/join/member?wl=${encodeURIComponent(r.id)}`,
      });
      if (ok) {
        await sb
          .from("waitlist_signups")
          .update({ launch_email_sent_at: new Date().toISOString(), status: "contacted", contacted_at: new Date().toISOString() } as never)
          .eq("id", r.id);
        sent.push(r.email);
      } else {
        failed.push(r.email);
      }
    }
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    return serverError(err, { route: "POST /api/admin/waitlist/launch-email" });
  }
}
