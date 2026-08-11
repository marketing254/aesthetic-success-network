import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { asString, isValidEmail } from "@/lib/forms/request";
import { PORTAL_HOME, resolvePortalRoles } from "@/lib/auth/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal/verify-otp — completes portal sign-in.
 * Verifies the 6-digit code (which writes the session cookie), re-checks
 * that the email still holds a live portal role, then returns the home
 * route for that role. Someone whose access was revoked between
 * requesting and entering the code is signed straight back out.
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

  // Primary codes verify as type "email", fallback codes as "magiclink".
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

  const identity = await resolvePortalRoles(email);
  if (identity.roles.length === 0) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Your access isn't active. Contact support@aestheticsuccessnetwork.com." },
      { status: 403 },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    await admin.from("auth_audit").insert({
      event: "login_success",
      email,
      user_id: data.user.id,
      user_type: identity.roles.join("+"),
      metadata: { method: "email_otp", surface: "portal" },
    });
  } catch (err) {
    console.error("[portal:verify-otp] audit insert failed:", err);
    // Never block sign-in on the audit write.
  }

  return NextResponse.json({
    ok: true,
    roles: identity.roles,
    home: PORTAL_HOME[identity.roles[0]!],
  });
}
