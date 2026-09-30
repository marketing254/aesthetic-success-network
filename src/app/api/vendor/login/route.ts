import { NextResponse } from "next/server";
import { isOtpThrottle, sendOtpViaFallback, requestOtp } from "@/lib/auth/otpFallback";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";

/**
 * Dev-only preview cookie (test/test password mode). The middleware only
 * honours the exact value "test-preview" outside production. These two
 * constants used to live in the removed legacy magicToken module.
 */
const VENDOR_SESSION_COOKIE = "vendor_session";
const VENDOR_SESSION_TTL_S = 60 * 60 * 24 * 7;

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
 * POST /api/vendor/login
 *
 * Three modes:
 *   - mode "password": preview-only test/test credential. Sets a separate
 *     legacy session cookie (`vendor_session`) so the middleware allows
 *     access during preview. Use only for UI testing.
 *
 *   - mode "magic": fires Supabase Auth's magic-link email. The email
 *     contains a URL pointing at /auth/callback?next=/vendor&role=vendor.
 *     Once clicked, Supabase exchanges the code for a session cookie and
 *     the user is signed in. Reply is "we sent you a link", no token in
 *     the response (Supabase handles the URL).
 *
 *   - mode "verify": no longer exists (the homegrown HMAC token module
 *     was removed); the request falls through to "Unknown mode".
 *
 * DELETE clears both the legacy preview cookie AND signs the user out
 * of Supabase if they have a session.
 */

function setLegacyCookie(res: NextResponse, value: string) {
  res.cookies.set(VENDOR_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VENDOR_SESSION_TTL_S,
  });
}

export async function POST(req: Request) {
  let body: { mode?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // OTP is now the only supported mode. The legacy `mode: "password"`
  // branch below is kept for any old callers but new code (the shared
  // OtpLoginForm) sends no mode, which defaults to "magic" here.
  const mode = body.mode ?? "magic";
  const ip = clientIp(req);

  // ─────────────────────────────────────────────────────────────────────
  // PASSWORD: preview-only test/test stand-in. HARD-DISABLED in production —
  // even if NEXT_PUBLIC_SHOW_DEV_LOGIN flips on by accident, the API rejects.
  // ─────────────────────────────────────────────────────────────────────
  if (mode === "password") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN !== "true") {
      return NextResponse.json(
        { error: "Password mode is disabled. Use magic-link sign-in." },
        { status: 403 },
      );
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const rl = await checkRateLimit(`vendor-login-password:${ip}`);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
      );
    }

    const isTestCredential = email === "test" && password === "test";
    if (!isTestCredential) {
      return NextResponse.json(
        { error: "Invalid credentials. During preview, use 'test' for both fields." },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true, redirect: "/vendor" });
    setLegacyCookie(res, "test-preview");
    return res;
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAGIC: fire Supabase Auth's signInWithOtp
  // ─────────────────────────────────────────────────────────────────────
  if (mode === "magic") {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    // Rate-limit by IP + email so a single bad actor can't blast magic links
    // at every aesthetic practice in the country.
    const rl = await checkRateLimit(`vendor-magic:${ip}:${email}`);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
      );
    }

    // Role-scoped pre-check: only emails with a matching vendors row may
    // receive a partner OTP. A user who's also signed up as a member can't
    // back-door into the partner portal via /vendor/login.
    try {
      const adminCheck = getSupabaseAdmin();
      const { data: vendorRow } = await adminCheck
        .from("vendors")
        .select("id, status")
        .eq("contact_email", email)
        .maybeSingle();
      if (!vendorRow) {
        try {
          await adminCheck.from("auth_audit").insert({
            event: "otp_send_denied",
            email,
            user_type: "vendor",
            metadata: { reason: "no_vendor_row" },
          });
        } catch {
          /* audit best-effort */
        }
        return NextResponse.json(
          {
            error:
              "We couldn't find an application for that email. Apply at /partners first, then come back to sign in.",
          },
          { status: 404 },
        );
      }
      if (vendorRow.status === "rejected" || vendorRow.status === "churned") {
        try {
          await adminCheck.from("auth_audit").insert({
            event: "otp_send_denied",
            email,
            user_type: "vendor",
            metadata: { reason: "vendor_status_blocked", status: vendorRow.status },
          });
        } catch {
          /* audit best-effort */
        }
        return NextResponse.json(
          { error: "Your partner portal isn't available right now." },
          { status: 403 },
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:login] role pre-check failed:", err);
      return NextResponse.json(
        { error: "Couldn't send your sign-in code. Please try again." },
        { status: 500 },
      );
    }

    // OTP send — no emailRedirectTo so Supabase delivers the 6-digit
    // code via the {{ .Token }} template. Verification happens at
    // /api/vendor/verify-otp.
    const supabase = await createServerSupabase();
    let otpProvider: "supabase" | "fallback" = "supabase";
    const { error } = await requestOtp(supabase, email, "vendor:login");

    if (error) {
      // Supabase's specific code for "no user with this email" is generic
      // ("Signups not allowed for otp" or similar). Detect it heuristically
      // and surface a friendlier message that tells them to apply first.
      const msg = error.message ?? "";
      const isUserNotFound =
        /not allowed|not found|invalid/i.test(msg) ||
        error.status === 422 ||
        error.status === 400;

      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:login] supabase signInWithOtp failed:", error);

      try {
        const admin = getSupabaseAdmin();
        await admin.from("auth_audit").insert({
          event: "otp_send_denied",
          email,
          user_type: "vendor",
          metadata: { reason: msg, isUserNotFound },
        });
      } catch {
        // ignore
      }

      if (isUserNotFound) {
        return NextResponse.json(
          {
            error:
              "We couldn't find an application for that email. Apply at /partners first, then come back to sign in.",
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
      console.error("[vendor:login] supabase otp send failed, using fallback transport:", error.status, msg);
      const fb = await sendOtpViaFallback(email, "vendor:login");
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
        user_type: "vendor",
        metadata: { provider: otpProvider },
      });
      await admin.from("email_events").insert({
        template: "vendor_login_otp",
        recipient: email,
        provider: "supabase_auth",
        status: "queued",
        subject: "Your ASN partner sign-in code",
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:login] audit log failed:", err);
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      message: "We sent a 6-digit code to your inbox. It expires in 5 minutes.",
    });
  }

  return NextResponse.json({ error: `Unknown mode '${mode}'.` }, { status: 400 });
}

export async function DELETE() {
  // Best-effort Supabase signOut (clears the auth cookie).
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[vendor:logout] supabase signOut failed:", err);
  }

  // Also clear the legacy preview cookie if present.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VENDOR_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
