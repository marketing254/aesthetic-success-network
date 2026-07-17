import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { asString, isValidEmail } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/verify-otp — completes the DMN-pattern OTP sign-in.
 * Verifies the 6-digit code (setting the session cookie), then does the
 * first-sign-in bootstrap: links admin_users.auth_user_id, bumps
 * last_active_at, writes the auth_audit row. Non-admins are signed
 * straight back out.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = asString(body.email).toLowerCase();
  const token = asString(body.token).replace(/\s+/g, "");
  if (!isValidEmail(email) || token.length < 6) {
    return NextResponse.json({ error: "Email and the 6-digit code are required." }, { status: 400 });
  }

  // Cookie-bound client: a successful verify writes the session cookie
  // onto this response. Primary codes come from signInWithOtp (type
  // "email"); fallback codes come from generateLink and verify as
  // "magiclink" — try both so either path signs in.
  const supabase = await createServerSupabase();
  let { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data?.user) {
    const retry = await supabase.auth.verifyOtp({ email, token, type: "magiclink" });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.user) {
    const expired = /expired/i.test(error?.message ?? "");
    return NextResponse.json(
      {
        error: expired
          ? "That code has expired. Send a new one and try again."
          : "That code isn't right. Check the email and try again.",
      },
      { status: 401 },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id, auth_user_id, active")
      .ilike("email", email)
      .maybeSingle();

    if (!adminRow || !adminRow.active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Your account is not an admin." }, { status: 403 });
    }

    await admin
      .from("admin_users")
      .update({ auth_user_id: data.user.id, last_active_at: new Date().toISOString() })
      .eq("id", adminRow.id);

    await admin.from("auth_audit").insert({
      event: "login_success",
      email,
      user_id: data.user.id,
      user_type: "admin",
      metadata: { method: "email_otp" },
    });
  } catch (err) {
    console.error("[admin:verify-otp] bootstrap failed:", err);
    // Don't block sign-in — middleware still gates by email.
  }

  return NextResponse.json({ ok: true });
}
