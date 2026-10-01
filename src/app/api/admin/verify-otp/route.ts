import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/verify-otp
 *
 * Body: { email, token }   token = 6-digit code
 *
 * Verifies the OTP. Final allow-list check happens here too (defense in
 * depth — even if Supabase auth was somehow bypassed, the admin_users
 * row gate stays). Lands the user at /admin.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const TOKEN_RE = /^\d{6}$/;
const GENERIC_FAIL = "That code didn't work. Request a new one and try again.";

export async function POST(req: Request) {
  const route = "POST /api/admin/verify-otp";

  let body: { email?: string; token?: string };
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
  const rl = await checkRateLimit(`admin-verify:${ip}:${email}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  try {
    const cookieClient = await createServerSupabase();
    // Codes sent by Supabase verify as type "email"; codes minted by the
    // login route's fallback (generateLink) verify as "magiclink". Try both.
    let { data, error } = await cookieClient.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data?.user) {
      const retry = await cookieClient.auth.verifyOtp({ email, token, type: "magiclink" });
      data = retry.data;
      error = retry.error;
    }

    if (error || !data?.user) {
      try {
        const admin = getSupabaseAdmin();
        await admin.from("auth_audit").insert({
          event: "otp_verify_failed",
          email,
          user_type: "admin",
          metadata: { reason: "invalid_or_expired" },
        });
      } catch {
        /* audit best-effort */
      }
      return apiError.validation(GENERIC_FAIL);
    }

    // Confirm allow-list membership (defense in depth).
    const admin = getSupabaseAdmin();
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("id, active, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (!adminRow || !adminRow.active) {
      return apiError.forbidden(route);
    }
    if (!adminRow.auth_user_id) {
      await admin
        .from("admin_users")
        .update({
          auth_user_id: data.user.id,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", adminRow.id);
    } else {
      await admin
        .from("admin_users")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", adminRow.id);
    }

    try {
      await admin.from("auth_audit").insert({
        event: "otp_verify_success",
        email,
        user_id: data.user.id,
        user_type: "admin",
        metadata: { admin_id: adminRow.id },
      });
    } catch {
      /* audit best-effort */
    }

    return NextResponse.json({ ok: true, next: "/admin" });
  } catch (err) {
    return serverError(err, { route });
  }
}
