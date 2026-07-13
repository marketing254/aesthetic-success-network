import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/link-session
 *
 * Called by the login page right after a successful OTP verification
 * (the code flow has no /auth/callback redirect, so first-sign-in
 * bootstrap happens here instead): links admin_users.auth_user_id,
 * bumps last_active_at, writes the auth_audit row.
 *
 * Returns 403 if the signed-in email isn't an active admin — the login
 * page signs the session back out in that case.
 */
export async function POST() {
  const cookieClient = await createServerSupabase();
  const { data: userData, error } = await cookieClient.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const email = (userData.user.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Account is missing an email." }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id, auth_user_id, active")
      .ilike("email", email)
      .maybeSingle();

    if (!adminRow || !adminRow.active) {
      return NextResponse.json({ error: "Your account is not an admin." }, { status: 403 });
    }

    await admin
      .from("admin_users")
      .update({ auth_user_id: userData.user.id, last_active_at: new Date().toISOString() })
      .eq("id", adminRow.id);

    await admin.from("auth_audit").insert({
      event: "login_success",
      email,
      user_id: userData.user.id,
      user_type: "admin",
      metadata: { method: "email_otp" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin:link-session] failed:", err);
    // Don't block sign-in on audit/link failures — middleware gates by email.
    return NextResponse.json({ ok: true, warning: "bootstrap incomplete" });
  }
}
