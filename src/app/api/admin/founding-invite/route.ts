import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { appOrigin } from "@/lib/stripe";
import { errMessage } from "@/lib/errMessage";
import { writeAudit } from "@/lib/audit";
import { asString, isValidEmail } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/admin/founding-invite
 *
 * GET  — list every founding invite, decorated with the shareable
 *        /founding/<code> URL, for the admin console.
 * POST — mint a new invite for a hand-picked prospect. Nothing gets
 *        emailed here — the admin copies invite_url into their own
 *        message, same pattern as personalized expert/partner links.
 */

function genCode(): string {
  // 18 bytes -> 24-char base64url. Unguessable, URL-safe.
  return crypto.randomBytes(18).toString("base64url");
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("founding_member_invites")
      .select(
        "id, code, full_name, email, practice_name, notes, status, viewed_at, accepted_at, member_id, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const origin = appOrigin();
    const rows = (data ?? []).map((r) => ({ ...r, invite_url: `${origin}/founding/${r.code}` }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const fullName = asString(body.fullName);
  const email = asString(body.email).toLowerCase();
  const practiceName = asString(body.practiceName) || null;
  const notes = asString(body.notes) || null;

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const code = genCode();

    const { data: inserted, error } = await supabase
      .from("founding_member_invites")
      .insert({
        code,
        full_name: fullName,
        email,
        practice_name: practiceName,
        notes,
        status: "sent",
        created_by: guard.adminId,
      })
      .select("id, code")
      .single();
    if (error) throw error;

    await writeAudit(guard, "founding_member_invite", inserted.id as string, "create", email);

    const origin = appOrigin();
    return NextResponse.json({
      ok: true,
      id: inserted.id,
      code: inserted.code,
      invite_url: `${origin}/founding/${inserted.code}`,
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
