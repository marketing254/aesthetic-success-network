import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/callback — redirect target for the admin magic link.
 * Exchanges the PKCE code for a session cookie, links admin_users to the
 * auth user on first sign-in, writes an auth_audit row, then redirects.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";

  if (!code) {
    const err = url.searchParams.get("error_description") ?? "Missing code in callback.";
    return NextResponse.redirect(
      new URL(`/admin/login?error=${encodeURIComponent(err)}`, url.origin),
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    console.error("[auth:callback] code exchange failed:", error);
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=${encodeURIComponent(error?.message ?? "Sign-in failed.")}`,
        url.origin,
      ),
    );
  }

  const user = data.session.user;

  try {
    const admin = getSupabaseAdmin();
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id, auth_user_id, active")
      .eq("email", (user.email ?? "").toLowerCase())
      .maybeSingle();

    if (adminRow?.active && !adminRow.auth_user_id) {
      await admin
        .from("admin_users")
        .update({ auth_user_id: user.id, last_active_at: new Date().toISOString() })
        .eq("id", adminRow.id);
    } else if (adminRow?.active) {
      await admin
        .from("admin_users")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", adminRow.id);
    }

    await admin.from("auth_audit").insert({
      event: "login_success",
      email: user.email,
      user_id: user.id,
      user_type: "admin",
      metadata: { next },
    });
  } catch (err) {
    console.error("[auth:callback] bootstrap failed:", err);
    // Don't block sign-in.
  }

  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
