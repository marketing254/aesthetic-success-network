import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, isValidEmail } from "@/lib/forms/request";
import { resolvePortalRoles } from "@/lib/auth/portal";
import { sendPortalCodeEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal/login — OTP request for the member / expert / partner
 * portals. Same two-transport pattern as the admin route:
 *   1. PRIMARY  — Supabase Auth emails the 6-digit code.
 *   2. FALLBACK — generate via the Admin API, email through our transport.
 *
 * The role check runs BEFORE any email goes out, so an email that isn't
 * an activated member or an approved expert/partner never gets a code.
 * Completed by POST /api/portal/verify-otp.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = asString(body.email).toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const rl = checkRateLimit(`portal-otp:${clientIp(req)}:${email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    console.error("[portal:login] supabase not configured:", err);
    return NextResponse.json(
      { error: "Sign-in is unavailable: Supabase env vars are missing on the server." },
      { status: 503 },
    );
  }

  const identity = await resolvePortalRoles(email);
  if (identity.roles.length === 0) {
    return NextResponse.json(
      {
        error:
          "We don't have an active membership or approved application for that email yet. If you've applied, we'll email you the moment it's approved.",
      },
      { status: 403 },
    );
  }

  // ── PRIMARY: Supabase sends the code ──────────────────────────────
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: otpErr } = await anon.auth.signInWithOtp({
    email,
    // Portal users are created as auth users at activation/approval time.
    options: { shouldCreateUser: false },
  });

  if (!otpErr) {
    return NextResponse.json({ ok: true, sentVia: "supabase" });
  }

  if (otpErr.status === 429 || /security purposes|once every/i.test(otpErr.message ?? "")) {
    return NextResponse.json(
      { error: "A code was sent recently. Wait a minute, then request a new one." },
      { status: 429 },
    );
  }

  console.error(
    "[portal:login] supabase otp send failed, using fallback transport:",
    otpErr.status,
    otpErr.message,
  );

  // ── FALLBACK: generate the code ourselves, email via our transport ──
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr) {
    console.error("[portal:login] generateLink failed:", linkErr.status, linkErr.message);
    if (/not found/i.test(linkErr.message ?? "") || linkErr.status === 404 || linkErr.status === 422) {
      return NextResponse.json(
        {
          error:
            "Your account isn't set up for sign-in yet. Email support@aestheticsuccessnetwork.com and we'll fix it.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Could not create a sign-in code. Please try again." },
      { status: 500 },
    );
  }

  const otp = linkData?.properties?.email_otp;
  if (!otp) {
    console.error("[portal:login] generateLink returned no email_otp");
    return NextResponse.json(
      { error: "Could not create a sign-in code. Please try again." },
      { status: 500 },
    );
  }

  try {
    await sendPortalCodeEmail(email, otp);
  } catch (err) {
    console.error("[portal:login] code email failed:", err);
    return NextResponse.json(
      { error: "Could not send the code email. Please try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentVia: "fallback" });
}
