import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, isValidEmail } from "@/lib/forms/request";
import { sendAdminCodeEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/login — DMN-pattern OTP request.
 * Looks up admin_users FIRST (refuses unknown/inactive emails before any
 * email is sent), then sends the 6-digit code:
 *   1. PRIMARY — Supabase Auth (`signInWithOtp`): the code is emailed by
 *      Supabase through its dashboard SMTP (Rackspace support@ mailbox;
 *      the Magic Link template must contain {{ .Token }}).
 *   2. FALLBACK — if Supabase can't send, the code is generated via the
 *      Admin API (`generateLink`) and emailed through the app's own
 *      Rackspace transport, so admins are never locked out.
 * Completed by POST /api/admin/verify-otp (accepts both code types).
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

  const rl = checkRateLimit(`admin-otp:${clientIp(req)}:${email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  // Gate on the allow-list before any email goes out.
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    console.error("[admin:login] supabase not configured:", err);
    return NextResponse.json(
      { error: "Sign-in is unavailable: Supabase env vars are missing on the server." },
      { status: 503 },
    );
  }

  const { data: row } = await admin
    .from("admin_users")
    .select("id, active")
    .ilike("email", email)
    .maybeSingle();

  if (!row || !row.active) {
    return NextResponse.json(
      {
        error:
          "That email isn't on the admin allow-list. Ask an owner-role admin to add you, then try again.",
      },
      { status: 403 },
    );
  }

  // ── PRIMARY: Supabase sends the code (dashboard SMTP → Rackspace) ──
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: otpErr } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (!otpErr) {
    return NextResponse.json({ ok: true, sentVia: "supabase" });
  }

  // Supabase's own resend throttle (~60s per email) — surface it clearly
  // instead of falling back and double-sending.
  if (otpErr.status === 429 || /security purposes|once every/i.test(otpErr.message ?? "")) {
    return NextResponse.json(
      { error: "A code was sent recently. Wait a minute, then request a new one." },
      { status: 429 },
    );
  }

  console.error(
    "[admin:login] supabase otp send failed, using fallback transport:",
    otpErr.status,
    otpErr.message,
  );

  // ── FALLBACK: generate the code ourselves, email via our transport ──
  // The auth user must be pre-created in Supabase → Authentication → Users.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr) {
    console.error("[admin:login] generateLink failed:", linkErr.status, linkErr.message);
    if (/not found/i.test(linkErr.message ?? "") || linkErr.status === 404 || linkErr.status === 422) {
      return NextResponse.json(
        {
          error:
            "This admin email has no auth user yet. Create it in Supabase → Authentication → Users, then try again.",
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
    console.error("[admin:login] generateLink returned no email_otp");
    return NextResponse.json(
      { error: "Could not create a sign-in code. Please try again." },
      { status: 500 },
    );
  }

  try {
    await sendAdminCodeEmail(email, otp);
  } catch (err) {
    console.error("[admin:login] code email failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not send the code email. Check the SMTP_* / GMAIL_* settings in the server env.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sentVia: "fallback" });
}
