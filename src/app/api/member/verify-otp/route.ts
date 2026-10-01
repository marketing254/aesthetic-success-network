import { NextResponse } from "next/server";
import { SIGNUP_CHECKOUT_COOKIE } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/verify-otp
 *
 * Body: { email: string, token: string }   token = 6-digit OTP code
 *
 * Verifies the OTP that Supabase sent on /api/member/login or
 * /api/member/signup. On success, Supabase sets the auth session
 * cookies on our domain and we return the right next path so the
 * client can router.push() there.
 *
 * Security rails:
 *   - Per-IP+email rate limit on verify attempts (5 per 10 min then
 *     soft lockout). The Supabase server also enforces its own
 *     attempt-counting at the OTP layer.
 *   - OTP itself is never echoed back to the caller, never logged,
 *     never stored — only the verdict travels.
 *   - Failed verify returns a generic "Invalid or expired code"
 *     message; we don't leak whether the email is unknown vs the
 *     code is wrong vs the code expired (prevents enumeration).
 *   - The next path is computed from the member's current state at
 *     verify time, NOT trusted from a client-supplied parameter
 *     (prevents open-redirect via ?next=external.com).
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const TOKEN_RE = /^\d{6}$/;
const GENERIC_FAIL = "That code didn't work. Request a new one and try again.";

export async function POST(req: Request) {
  const route = "POST /api/member/verify-otp";

  let body: { email?: string; token?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const token = (body.token ?? "").trim();

  if (!email || !email.includes("@") || !TOKEN_RE.test(token)) {
    return apiError.validation(GENERIC_FAIL);
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit(`member-verify:${ip}:${email}`);
  if (!rl.allowed) {
    return apiError.rateLimited(route);
  }

  try {
    // verifyOtp on the cookie-bound server client sets the session
    // cookies on our domain automatically. Type 'email' matches
    // signInWithOtp's behavior on the request side.
    const cookieClient = await createServerSupabase();
    // Codes sent by Supabase verify as "email"; codes from the login
    // route's SMTP fallback (generateLink) verify as "magiclink".
    let { data, error } = await cookieClient.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data?.user) {
      const retry = await cookieClient.auth.verifyOtp({ email, token, type: "magiclink" });
      data = retry.data;
      error = retry.error;
    }

    if (error || !data?.user) {
      // Audit FAILED attempt (no token logged) for forensic visibility.
      try {
        const admin = getSupabaseAdmin();
        await admin.from("auth_audit").insert({
          event: "otp_verify_failed",
          email,
          user_type: "member",
          metadata: { reason: "invalid_or_expired" },
        });
      } catch {
        /* audit best-effort */
      }
      return apiError.validation(GENERIC_FAIL);
    }

    // Admin bypass — mirrors /api/member/login. An active admin_users
    // row for this email is enough to complete verification and land on
    // /dashboard in preview mode, with no members row required. Link
    // auth_user_id back onto the admin row while we're here so future
    // middleware checks (which query by auth_user_id) don't re-hit the
    // email lookup path.
    const admin = getSupabaseAdmin();
    const { data: adminBypassRow } = await admin
      .from("admin_users")
      .select("id, active, auth_user_id")
      .ilike("email", email)
      .maybeSingle();
    if (adminBypassRow?.active) {
      if (adminBypassRow.auth_user_id !== data.user.id) {
        await admin
          .from("admin_users")
          .update({ auth_user_id: data.user.id, last_active_at: new Date().toISOString() })
          .eq("id", adminBypassRow.id);
      } else {
        await admin
          .from("admin_users")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", adminBypassRow.id);
      }
      try {
        await admin.from("auth_audit").insert({
          event: "otp_verify_success",
          email,
          user_id: data.user.id,
          user_type: "member",
          metadata: { admin_preview: true, admin_id: adminBypassRow.id },
        });
      } catch {
        /* audit best-effort */
      }
      return NextResponse.json({ ok: true, next: "/dashboard" });
    }

    // Look up the member to decide where to land them.
    const { data: memberRow } = await admin
      .from("members")
      .select("id, status, subscription_status, auth_user_id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    // If members row exists but isn't linked yet (race between signup
    // insert and verify), link it now using the email match.
    let resolvedMember = memberRow;
    if (!resolvedMember) {
      const { data: byEmail } = await admin
        .from("members")
        .select("id, status, subscription_status, auth_user_id")
        .eq("email", email)
        .maybeSingle();
      if (byEmail) {
        if (!byEmail.auth_user_id) {
          await admin
            .from("members")
            .update({ auth_user_id: data.user.id })
            .eq("id", byEmail.id);
        }
        resolvedMember = { ...byEmail, auth_user_id: data.user.id };
      }
    }

    if (!resolvedMember) {
      // Verified the OTP but there's no members row — block.
      return apiError.forbidden(route);
    }

    if (resolvedMember.status !== "active") {
      // Member exists but admin paused / churned them.
      return NextResponse.json(
        {
          ok: false,
          error: "Your portal isn't active. Contact the team to reactivate.",
        },
        { status: 403 },
      );
    }

    // Audit success.
    try {
      await admin.from("auth_audit").insert({
        event: "otp_verify_success",
        email,
        user_id: data.user.id,
        user_type: "member",
        metadata: { member_id: resolvedMember.id },
      });
    } catch {
      /* audit best-effort */
    }

    // Decide where to send them. NOT trusted from any client parameter.
    const isPaid =
      resolvedMember.subscription_status === "active" ||
      resolvedMember.subscription_status === "trialing";
    // ?next= is accepted ONLY for the summit page, and only for a paid
    // member (an unpaid member still goes to /upgrade). Anything else —
    // an external host, a protocol-relative URL, any other path — is
    // ignored, so there is no open redirect.
    const wantsSummit = typeof body.next === "string" && body.next === "/summit";
    const next = isPaid ? (wantsSummit ? "/summit" : "/dashboard") : "/upgrade";

    // They now have a real session — retire the pay-first signup cookie so it
    // can't linger and take precedence over the session on a later /upgrade.
    const response = NextResponse.json({ ok: true, next });
    response.cookies.delete(SIGNUP_CHECKOUT_COOKIE);
    return response;
  } catch (err) {
    return serverError(err, { route });
  }
}
