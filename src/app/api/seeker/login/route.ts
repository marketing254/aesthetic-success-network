import { NextResponse } from "next/server";
import { isOtpThrottle, sendOtpViaFallback, requestOtp } from "@/lib/auth/otpFallback";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/seeker/login
 *
 * OTP sign-in for the job-seeker surface. Same shape as
 * /api/member/login: shouldCreateUser:false, so the auth user must
 * already exist (created at /api/seeker/signup), and no emailRedirectTo
 * because the Supabase template renders a 6-digit code, not a link.
 *
 * Accepts BOTH account types on purpose. A paying member is a person who
 * might also want to apply for a job, and there is no reason to make
 * them hold two accounts to do it. What this endpoint will not do is
 * create an account — an unknown email is told to register.
 *
 * DELETE clears the session, so the seeker surface has a sign-out.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const UNKNOWN_EMAIL =
  "We couldn't find an account for that email. Create a free one; it takes a minute.";

export async function POST(req: Request) {
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
  const rl = await checkRateLimit(`seeker-magic:${ip}:${email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  const admin = getSupabaseAdmin();

  try {
    const { data: row } = await admin
      .from("members")
      .select("id, status, account_type")
      .eq("email", email)
      .maybeSingle();

    if (!row) {
      try {
        await admin.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "job_seeker",
          metadata: { reason: "no_member_row" },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json({ error: UNKNOWN_EMAIL, reason: "unknown_email" }, { status: 404 });
    }

    if (row.status !== "active") {
      try {
        await admin.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "job_seeker",
          metadata: { reason: "status_blocked", status: row.status },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json(
        { error: "That account isn't active. Contact us if you think that's wrong." },
        { status: 403 },
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[seeker:login] pre-check failed:", err);
    }
    return NextResponse.json(
      { error: "Couldn't send your sign-in code. Please try again." },
      { status: 500 },
    );
  }

  const supabase = await createServerSupabase();
  let otpProvider: "supabase" | "fallback" = "supabase";
  const { error } = await requestOtp(supabase, email, "seeker:login");

  if (error) {
    const msg = error.message ?? "";
    const isUserNotFound =
      /not allowed|not found|invalid/i.test(msg) || error.status === 422 || error.status === 400;
    try {
      await admin.from("auth_audit").insert({
        event: "otp_send_denied",
        email,
        user_type: "job_seeker",
        metadata: { reason: msg, isUserNotFound },
      });
    } catch {
      /* ignore */
    }
    if (isUserNotFound) {
      return NextResponse.json({ error: UNKNOWN_EMAIL, reason: "unknown_email" }, { status: 404 });
    }
    if (isOtpThrottle(error)) {
      return NextResponse.json(
        { error: "A code was sent recently. Wait a minute, then request a new one." },
        { status: 429 },
      );
    }
    console.error("[seeker:login] supabase otp send failed, using fallback transport:", error.status, msg);
    const fb = await sendOtpViaFallback(email, "seeker:login");
    if (!fb.ok) {
      return NextResponse.json(
        { error: "Couldn't send your sign-in code. Please try again." },
        { status: fb.reason === "no_user" ? 404 : 500 },
      );
    }
    otpProvider = "fallback";
  }

  try {
    await admin.from("auth_audit").insert({
      event: "otp_issued",
      email,
      user_type: "job_seeker",
      metadata: { provider: otpProvider },
    });
    await admin.from("email_events").insert({
      template: "seeker_login_otp",
      recipient: email,
      provider: "supabase_auth",
      status: "queued",
      subject: "Your ASN sign-in code",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[seeker:login] audit log failed:", err);
    }
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
    console.error("[seeker:logout] signOut failed:", err);
  }
  return NextResponse.json({ ok: true });
}
