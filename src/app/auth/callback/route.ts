import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/callback
 *
 * The redirect target for every Supabase magic link in this app. The URL
 * Supabase appends `?code=...` (PKCE flow) which we exchange for a session
 * cookie, then redirect the user to wherever they were trying to go (or a
 * sensible default).
 *
 * Query params:
 *   code   — PKCE code from Supabase (always present on success)
 *   next   — relative path to redirect to after success (defaults to /)
 *   role   — optional 'vendor' | 'admin' | 'member' — used to pick the
 *            right default destination and to log the event
 *
 * Also performs one-time bootstrap work on first sign-in:
 *   - Vendor: if the user has a `vendor_applications` row but no `vendors`
 *     row yet, create one and link auth_user_id.
 *   - Admin: if the user's email exists in `admin_users` but auth_user_id
 *     is null, link it now.
 *
 * Any failure during bootstrap is logged but does NOT block sign-in — the
 * user can still proceed; the admin queue will surface the issue.
 */
// Pick the right login page to bounce back to when the magic-link
// verification fails. Without this every failure used to land on the
// vendor login page even when an admin was trying to sign in.
function loginPathForRole(role: string | null): string {
  if (role === "admin") return "/admin/login";
  if (role === "member") return "/member/login";
  if (role === "expert") return "/expert/login";
  return "/vendor/login";
}

// Valid OTP types we accept on the token_hash flow. Supabase's verifyOtp
// supports several — we only use 'magiclink' for the expert welcome email,
// but list the common ones so we can extend to recovery/invite/signup
// emails later without changing this route.
type OtpType = "magiclink" | "email" | "signup" | "recovery" | "invite" | "email_change";
const OTP_TYPES: ReadonlyArray<OtpType> = [
  "magiclink",
  "email",
  "signup",
  "recovery",
  "invite",
  "email_change",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/";
  const role = url.searchParams.get("role"); // 'vendor' | 'admin' | 'member' | 'expert' | null

  const supabase = await createServerSupabase();

  // Three flows can land here:
  //
  //   1. PKCE flow (signInWithOtp from /api/vendor/login, /api/member/login,
  //      /api/expert/login etc.). Supabase appends `?code=...` to this URL.
  //      We exchange the code for a session.
  //
  //   2. Token-hash flow (admin.generateLink — used by the expert welcome
  //      email). The email link points to OUR domain with `?token_hash=...
  //      &type=magiclink`. We call verifyOtp here, which sets the auth
  //      cookies on our domain (this is the SSR-compatible path; the raw
  //      `action_link` from generateLink does NOT carry cookies over from
  //      Supabase's domain to ours).
  //
  //   3. Existing session — defensive: if we end up here with neither a
  //      code nor a token_hash, but the user already has a valid session
  //      cookie, just continue with the bootstrap.
  //
  // Whichever path ran, we end up with `user`.
  let user: { id: string; email: string | null } | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      console.error("[auth:callback] code exchange failed:", error);
      return NextResponse.redirect(
        new URL(
          `${loginPathForRole(role)}?error=${encodeURIComponent(error?.message ?? "Sign-in failed.")}`,
          url.origin,
        ),
      );
    }
    user = { id: data.session.user.id, email: data.session.user.email ?? null };
  } else if (tokenHash) {
    const type: OtpType = OTP_TYPES.includes((typeParam ?? "magiclink") as OtpType)
      ? ((typeParam ?? "magiclink") as OtpType)
      : "magiclink";
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error || !data?.user) {
      console.error("[auth:callback] token_hash verify failed:", error);
      return NextResponse.redirect(
        new URL(
          `${loginPathForRole(role)}?error=${encodeURIComponent(error?.message ?? "Sign-in link is invalid or expired. Request a new one.")}`,
          url.origin,
        ),
      );
    }
    user = { id: data.user.id, email: data.user.email ?? null };
  } else {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getUser();
    if (sessionErr || !sessionData?.user) {
      const explicitErr = url.searchParams.get("error_description");
      const fallback = explicitErr ?? "Missing code in callback.";
      return NextResponse.redirect(
        new URL(`${loginPathForRole(role)}?error=${encodeURIComponent(fallback)}`, url.origin),
      );
    }
    user = { id: sessionData.user.id, email: sessionData.user.email ?? null };
  }

  // ─────────────────────────────────────────────────────────────────────
  // First-signin bootstrap. Uses the service-role admin client so we can
  // write across RLS without needing the user to be approved yet.
  // ─────────────────────────────────────────────────────────────────────
  try {
    const admin = getSupabaseAdmin();

    if (role === "vendor" || !role) {
      // The vendors row is always created at signup time (see
      // /api/vendor/signup) — we just need to link auth_user_id on
      // first sign-in.
      const { data: existingVendor } = await admin
        .from("vendors")
        .select("id, auth_user_id")
        .eq("contact_email", (user.email ?? "").toLowerCase())
        .maybeSingle();

      if (existingVendor && !existingVendor.auth_user_id) {
        await admin
          .from("vendors")
          .update({ auth_user_id: user.id })
          .eq("id", existingVendor.id);
      }
    }

    if (role === "admin" || !role) {
      // Link admin row to auth user if email matches and not yet linked.
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("id, auth_user_id, active")
        .eq("email", (user.email ?? "").toLowerCase())
        .maybeSingle();

      if (adminRow && adminRow.active && !adminRow.auth_user_id) {
        await admin
          .from("admin_users")
          .update({ auth_user_id: user.id, last_active_at: new Date().toISOString() })
          .eq("id", adminRow.id);
      } else if (adminRow && adminRow.active) {
        // Already linked — just bump last_active_at.
        await admin
          .from("admin_users")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", adminRow.id);
      }
    }

    if (role === "member" || !role) {
      // Link the active member row to this auth user on first sign-in.
      // Only members whose admin has flipped status to 'active' can sign in
      // (signInWithOtp uses shouldCreateUser:false; new auth users are only
      //  created by /api/admin/members/activate).
      const { data: memberRow } = await admin
        .from("members")
        .select("id, auth_user_id, status")
        .eq("email", (user.email ?? "").toLowerCase())
        .maybeSingle();

      if (memberRow && memberRow.status === "active" && !memberRow.auth_user_id) {
        await admin
          .from("members")
          .update({ auth_user_id: user.id })
          .eq("id", memberRow.id);
      }
    }

    if (role === "expert" || !role) {
      // Link the experts row to this auth user on every sign-in (always —
      // not just when null — because provisioning may have linked to a
      // stale auth_user_id if the email already had a Supabase account
      // from a previous role). The signed-in user IS the source of truth.
      // Also flip status from 'invited' → 'active' if needed so the portal
      // opens up. New auth users are provisioned by /api/admin/experts
      // (PATCH mark_onboarded) — this step just keeps the link fresh.
      const email = (user.email ?? "").toLowerCase();
      const { data: expertRow } = await admin
        .from("experts")
        .select("id, auth_user_id, status, activated_at")
        .eq("email", email)
        .maybeSingle();

      if (expertRow && expertRow.status !== "archived" && expertRow.status !== "suspended") {
        const patch: { auth_user_id?: string; status?: "active"; activated_at?: string } = {};
        if (expertRow.auth_user_id !== user.id) patch.auth_user_id = user.id;
        if (expertRow.status === "invited") {
          patch.status = "active";
          if (!expertRow.activated_at) patch.activated_at = new Date().toISOString();
        }
        if (Object.keys(patch).length > 0) {
          await admin.from("experts").update(patch).eq("id", expertRow.id);
        }
      }
    }

    // Audit log
    await admin.from("auth_audit").insert({
      event: "login_success",
      email: user.email,
      user_id: user.id,
      user_type: (role as "vendor" | "admin" | "member" | "expert" | null) ?? null,
      metadata: { next },
    });
  } catch (err) {
    console.error("[auth:callback] bootstrap threw:", err);
    // Don't block sign-in. Continue to the redirect.
  }

  // Pick the destination.
  //   1. If `next` was explicitly set and is a safe relative path, honor it.
  //   2. Otherwise, look up which table the user belongs to and infer the
  //      destination. This handles the case where Supabase fell back to the
  //      Site URL and lost the `?next=...&role=...` query params.
  let safeNext: string | null = null;
  if (next && next !== "/" && next.startsWith("/") && !next.startsWith("//")) {
    safeNext = next;
  } else {
    try {
      const admin = getSupabaseAdmin();
      const email = (user.email ?? "").toLowerCase();

      // Priority: admin → vendor → expert → member.
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("id, active")
        .eq("email", email)
        .maybeSingle();
      if (adminRow?.active) {
        safeNext = "/admin";
      } else {
        const { data: vendorRow } = await admin
          .from("vendors")
          .select("id, status")
          .eq("contact_email", email)
          .maybeSingle();
        if (vendorRow && vendorRow.status !== "rejected" && vendorRow.status !== "churned") {
          safeNext = "/vendor";
        } else {
          const { data: expertRow } = await admin
            .from("experts")
            .select("id, status")
            .eq("email", email)
            .maybeSingle();
          if (
            expertRow &&
            expertRow.status !== "archived" &&
            expertRow.status !== "suspended"
          ) {
            safeNext = "/expert";
          } else {
            const { data: memberRow } = await admin
              .from("members")
              .select("id, status")
              .eq("email", email)
              .maybeSingle();
            if (memberRow?.status === "active") {
              safeNext = "/dashboard";
            }
          }
        }
      }
    } catch (err) {
      console.error("[auth:callback] role-routing lookup failed:", err);
    }
  }

  return NextResponse.redirect(new URL(safeNext ?? "/", url.origin));
}
