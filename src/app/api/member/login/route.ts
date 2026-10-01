import { NextResponse } from "next/server";
import { MEMBER_LAUNCH_ENABLED, MEMBER_LAUNCH_MESSAGE } from "@/lib/launch";
import { isOtpThrottle, sendOtpViaFallback, requestOtp } from "@/lib/auth/otpFallback";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/login
 *
 * OTP sign-in for members. shouldCreateUser:false — only emails
 * that already exist in auth.users can receive a code. New auth users
 * are pre-created at /api/member/signup (self-serve) or by admin via
 * /api/admin/members/activate (legacy path).
 *
 * Deliberately NO emailRedirectTo: the Supabase email template renders
 * `{{ .Token }}` as a 6-digit code, not a clickable link. Verification
 * happens at /api/member/verify-otp.
 *
 * Rate-limited per IP+email so a bot can't spray.
 *
 * DELETE clears the Supabase session cookie.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function POST(req: Request) {
  if (!MEMBER_LAUNCH_ENABLED) {
    return NextResponse.json({ error: MEMBER_LAUNCH_MESSAGE }, { status: 403 });
  }
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit(`member-magic:${ip}:${email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  // Role-scoped pre-check. Even if this email exists in auth.users for
  // another role (e.g. signed up as an expert), block sending a member
  // code unless there's also a members row for them. Prevents cross-role
  // OTPs (a partner's auth user can't sign in via /member/login).
  //
  // Admin bypass: an active admin_users row lets the same email through
  // this pre-check so the team can hit /dashboard in "admin preview"
  // mode. See middleware.ts and /api/member/me for the matching
  // downstream bypasses.
  try {
    const adminCheck = getSupabaseAdmin();
    // Case-insensitive match — admins may have their row stored with
    // Original.Case while the login form lowercases before
    // comparing. ilike with no wildcards behaves like a case-insensitive
    // equality check.
    const { data: adminBypassRow } = await adminCheck
      .from("admin_users")
      .select("id, active")
      .ilike("email", email)
      .maybeSingle();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info(
        `[member:login] admin bypass check: email="${email}", found=${!!adminBypassRow}, active=${adminBypassRow?.active ?? "n/a"}`,
      );
    }
    if (adminBypassRow?.active) {
      // Skip the members-row requirement and go straight to sending the OTP.
      const supabase = await createServerSupabase();
      const { error: otpErr } = await requestOtp(supabase, email, "member:login");
      if (otpErr) {
        return NextResponse.json(
          { error: "Couldn't send your sign-in code. Please try again." },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    const { data: memberRow } = await adminCheck
      .from("members")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();
    if (!memberRow) {
      try {
        await adminCheck.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "member",
          metadata: { reason: "no_member_row" },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json(
        {
          error:
            "We couldn't find a member account for that email. Sign up at /join, or check the spelling.",
        },
        { status: 404 },
      );
    }
    if (memberRow.status !== "active" && memberRow.status !== "invited") {
      try {
        await adminCheck.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "member",
          metadata: { reason: "member_status_blocked", status: memberRow.status },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json(
        {
          error: "Your portal isn't active. Contact the team to reactivate.",
        },
        { status: 403 },
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("[member:login] role pre-check failed:", err);
    return NextResponse.json(
      { error: "Couldn't send your sign-in code. Please try again." },
      { status: 500 },
    );
  }

  const supabase = await createServerSupabase();
  let otpProvider: "supabase" | "fallback" = "supabase";
  const { error } = await requestOtp(supabase, email, "member:login");

  if (error) {
    const msg = error.message ?? "";
    const isUserNotFound =
      /not allowed|not found|invalid/i.test(msg) || error.status === 422 || error.status === 400;

    try {
      const admin = getSupabaseAdmin();
      await admin.from("auth_audit").insert({
        event: "otp_send_denied",
        email,
        user_type: "member",
        metadata: { reason: msg, isUserNotFound },
      });
    } catch {
      /* ignore */
    }

    if (isUserNotFound) {
      return NextResponse.json(
        {
          error:
            "We couldn't find a member account for that email. Sign up at /join, or check the spelling.",
        },
        { status: 404 },
      );
    }
    if (isOtpThrottle(error)) {
      return NextResponse.json(
        { error: "A code was sent recently. Wait a minute, then request a new one." },
        { status: 429 },
      );
    }
    console.error("[member:login] supabase otp send failed, using fallback transport:", error.status, msg);
    const fb = await sendOtpViaFallback(email, "member:login");
    if (!fb.ok) {
      return NextResponse.json(
        { error: "Couldn't send your sign-in code. Please try again." },
        { status: fb.reason === "no_user" ? 404 : 500 },
      );
    }
    otpProvider = "fallback";
  }

  try {
    const admin = getSupabaseAdmin();
    await admin.from("auth_audit").insert({
      event: "otp_issued",
      email,
      user_type: "member",
      metadata: { provider: otpProvider },
    });
    await admin.from("email_events").insert({
      template: "member_login_otp",
      recipient: email,
      provider: "supabase_auth",
      status: "queued",
      subject: "Your ASN sign-in code",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("[member:login] audit log failed:", err);
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    message: "We sent a 6-digit code to your inbox. It expires in 5 minutes.",
  });
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[member:logout] signOut failed:", err);
  }
  return NextResponse.json({ ok: true });
}
