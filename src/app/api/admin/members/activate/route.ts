import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { sendMemberWelcomeEmail } from "@/lib/waitlist/confirmationEmail";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { serverError } from "@/lib/api/errorResponse";
import { appOrigin, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/members/activate
 *
 * Promotes a waitlist signup → active member. Three modes:
 *
 *   { waitlist_signup_id: "..." }
 *     Pulls the waitlist_signups row, creates a `members` row with
 *     status='active', pre-creates the Supabase auth user (so magic-link
 *     sign-in works), marks the waitlist row as 'converted', sends the
 *     welcome email.
 *
 *   { member_id: "..." }
 *     Existing members row (perhaps status='waitlist' or 'invited') —
 *     flips status to 'active', sends/re-sends the welcome email.
 *
 *   { email: "...", first_name: "...", ... }
 *     Manual create. Useful when the team adds someone outside the
 *     normal waitlist flow.
 *
 * Idempotent. Re-activating an already-active member just re-sends the
 * welcome email and bumps welcome_sent_at.
 */

type ActivateBody = {
  waitlist_signup_id?: string;
  member_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  practice_name?: string;
  city?: string;
  phone?: string;
};

function splitName(fullName: string | null | undefined): { first: string; last: string | null } {
  const t = (fullName ?? "").trim();
  if (!t) return { first: "Member", last: null };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: null };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: ActivateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  let email: string | null = null;
  let firstName: string = "Member";
  let memberId: string | null = null;

  // ─────────────────────────────────────────────────────────────────────
  // 1. Resolve the target member (existing or newly created).
  // ─────────────────────────────────────────────────────────────────────
  if (body.member_id) {
    const { data: existing, error } = await sb
      .from("members")
      .select("id, email, first_name, status")
      .eq("id", body.member_id)
      .maybeSingle();
    if (error || !existing) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    memberId = existing.id;
    email = existing.email.toLowerCase();
    firstName = existing.first_name;
  } else if (body.waitlist_signup_id) {
    const { data: signup, error } = await sb
      .from("waitlist_signups")
      .select("id, full_name, email, practice_name, phone, city_state, status")
      .eq("id", body.waitlist_signup_id)
      .maybeSingle();
    if (error || !signup) {
      return NextResponse.json({ error: "Waitlist signup not found." }, { status: 404 });
    }
    email = signup.email.toLowerCase();
    const { first, last } = splitName(signup.full_name);
    firstName = first;

    // Check if a members row already exists for this email.
    const { data: existing } = await sb
      .from("members")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      memberId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: first,
          last_name: last,
          email,
          phone: signup.phone ?? null,
          practice_name: signup.practice_name ?? null,
          city: signup.city_state ?? null,
          status: "active",
          tier: "founding",
        })
        .select("id")
        .single();
      if (insErr) {
        return serverError(insErr, { route: "POST /api/admin/members/activate" });
      }
      memberId = inserted.id;
    }

    // Mark the waitlist row as converted (best-effort).
    await sb.from("waitlist_signups").update({ status: "converted" }).eq("id", signup.id);
  } else if (body.email) {
    email = body.email.toLowerCase();
    firstName = body.first_name?.trim() || "Member";
    const { data: existing } = await sb
      .from("members")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      memberId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: firstName,
          last_name: body.last_name?.trim() || null,
          email,
          phone: body.phone?.trim() || null,
          practice_name: body.practice_name?.trim() || null,
          city: body.city?.trim() || null,
          status: "active",
          tier: "founding",
        })
        .select("id")
        .single();
      if (insErr) {
        return serverError(insErr, { route: "POST /api/admin/members/activate" });
      }
      memberId = inserted.id;
    }
  } else {
    return NextResponse.json(
      { error: "Provide waitlist_signup_id, member_id, or email." },
      { status: 400 },
    );
  }

  if (!memberId || !email) {
    return NextResponse.json({ error: "Could not resolve target member." }, { status: 500 });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. Flip status → active, set activated_at + activated_by.
  // ─────────────────────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  await sb
    .from("members")
    .update({
      status: "active",
      activated_at: nowIso,
      activated_by: guard.adminId,
      joined_at: nowIso,
    })
    .eq("id", memberId);

  // ─────────────────────────────────────────────────────────────────────
  // 3. Pre-create the Supabase auth user. shouldCreateUser:false on the
  //    member login route means the user MUST already exist before they
  //    can request a magic link.
  // ─────────────────────────────────────────────────────────────────────
  try {
    const { error: createErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { user_type: "member", member_id: memberId },
    });
    if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
      console.error("[admin/members/activate] auth user create failed:", createErr);
    }
  } catch (err) {
    console.error("[admin/members/activate] auth user create threw:", err);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. Send the welcome email + log it.
  // ─────────────────────────────────────────────────────────────────────
  const origin = appOrigin();
  const portalUrl = `${origin.replace(/\/$/, "")}/member/login`;

  let emailSent = false;
  try {
    const result = await sendMemberWelcomeEmail({
      email,
      firstName,
      portalUrl,
    });
    emailSent = result.sent;
  } catch (mailErr) {
    console.warn("[admin/members/activate] welcome email failed:", mailErr);
  }

  await sb.from("members").update({ welcome_sent_at: nowIso }).eq("id", memberId);

  await sb.from("email_events").insert({
    template: "member_welcome",
    recipient: email,
    subject: "Your ASN portal is ready",
    provider: process.env.SMTP_HOST ? "smtp" : process.env.GMAIL_USER ? "gmail" : process.env.RESEND_API_KEY ? "resend" : "log",
    status: emailSent ? "queued" : "failed",
    metadata: { member_id: memberId },
  });

  await sb.from("review_actions").insert({
    target_type: "member",
    target_id: memberId,
    action: "activate",
    note: null,
    admin_id: guard.adminId,
  });

  // Email the whole team that a member was added / activated by admin.
  void notifyTeamEvent({
    kind: "admin_added",
    role: "member",
    name: firstName,
    email,
    adminLink: appUrl("/admin/members"),
    highlight: emailSent
      ? "Welcome email sent. Member can sign in."
      : "Activated, but the welcome email didn't confirm; they can request a link at /member/login.",
    fields: [
      { label: "Name", value: firstName },
      { label: "Email", value: email },
      { label: "Practice", value: body.practice_name },
      { label: "City", value: body.city },
      { label: "Phone", value: body.phone },
    ],
  });

  return NextResponse.json({
    ok: true,
    member_id: memberId,
    email,
    email_sent: emailSent,
  });
}
