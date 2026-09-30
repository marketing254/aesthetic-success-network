import { NextResponse } from "next/server";
import { isOtpThrottle, sendOtpViaFallback, requestOtp } from "@/lib/auth/otpFallback";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

/**
 * POST /api/expert/login
 *
 * Issues a Supabase Auth magic link to the supplied email IF an experts
 * row with that email already exists (created by /api/admin/experts on
 * invite). Uses shouldCreateUser:false — random visitors can't squat an
 * email into the auth table.
 *
 * Mirrors /api/vendor/login (magic mode) but with no dev-password escape
 * hatch — experts never had test/test credentials.
 */
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
  const rl = await checkRateLimit(`expert-magic:${ip}:${email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  // Role-scoped pre-check: only emails with a matching experts row may
  // receive an expert OTP. A user who's also signed up as a member can't
  // back-door into the expert portal via /expert/login.
  try {
    const adminCheck = getSupabaseAdmin();
    const { data: expertRow } = await adminCheck
      .from("experts")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();
    if (!expertRow) {
      try {
        await adminCheck.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "expert",
          metadata: { reason: "no_expert_row" },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json(
        {
          error:
            "We couldn't find an expert account for that email. Apply at /experts first; we'll email you once the team reviews your application.",
        },
        { status: 404 },
      );
    }
    if (expertRow.status === "suspended" || expertRow.status === "archived") {
      try {
        await adminCheck.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "expert",
          metadata: { reason: "expert_status_blocked", status: expertRow.status },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json(
        { error: "Your expert portal isn't available right now." },
        { status: 403 },
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("[expert:login] role pre-check failed:", err);
    return NextResponse.json(
      { error: "Couldn't send your sign-in code. Please try again." },
      { status: 500 },
    );
  }

  // OTP send — deliberately NO emailRedirectTo so Supabase delivers
  // the 6-digit code via the {{ .Token }} template. Verification happens
  // at /api/expert/verify-otp.
  const supabase = await createServerSupabase();
  let otpProvider: "supabase" | "fallback" = "supabase";
  const { error } = await requestOtp(supabase, email, "expert:login");

  if (error) {
    const msg = error.message ?? "";
    const isUserNotFound =
      /not allowed|not found|invalid/i.test(msg) ||
      error.status === 422 ||
      error.status === 400;

    if (process.env.NODE_ENV !== "production")
      console.error("[expert:login] supabase signInWithOtp failed:", error);

    try {
      const admin = getSupabaseAdmin();
      await admin.from("auth_audit").insert({
        event: "otp_send_denied",
        email,
        user_type: "expert",
        metadata: { reason: msg, isUserNotFound },
      });
    } catch {
      // ignore — audit is best-effort
    }

    if (isUserNotFound) {
      return NextResponse.json(
        {
          error:
            "We couldn't find an expert account for that email. Apply at /experts first; we'll email you once the team reviews your application.",
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
    console.error("[expert:login] supabase otp send failed, using fallback transport:", error.status, msg);
    const fb = await sendOtpViaFallback(email, "expert:login");
    if (!fb.ok) {
      return NextResponse.json(
        { error: "Couldn't send your sign-in code. Please try again." },
        { status: fb.reason === "no_user" ? 404 : 500 },
      );
    }
    otpProvider = "fallback";
  }

  // Audit + email_event logging (best-effort).
  try {
    const admin = getSupabaseAdmin();
    await admin.from("auth_audit").insert({
      event: "otp_issued",
      email,
      user_type: "expert",
      metadata: { provider: otpProvider },
    });
    await admin.from("email_events").insert({
      template: "expert_login_otp",
      recipient: email,
      provider: "supabase_auth",
      status: "queued",
      subject: "Your ASN expert sign-in code",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("[expert:login] audit log failed:", err);
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    message: "We sent a 6-digit code to your inbox. It expires in 5 minutes.",
  });
}

export async function DELETE() {
  // Sign out of Supabase. Experts have no legacy preview cookie.
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[expert:logout] supabase signOut failed:", err);
  }
  return NextResponse.json({ ok: true });
}
