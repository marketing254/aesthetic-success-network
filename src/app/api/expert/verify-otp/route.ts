import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expert/verify-otp
 *
 * Body: { email, token }   token = 6-digit code
 *
 * Verifies the OTP that /api/expert/login sent. Mirrors the member
 * verify endpoint but lands the user at /expert (the portal home).
 * Generic error messages — no enumeration leak. Rate-limited.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const TOKEN_RE = /^\d{6}$/;
const GENERIC_FAIL = "That code didn't work. Request a new one and try again.";

export async function POST(req: Request) {
  const route = "POST /api/expert/verify-otp";

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
  const rl = await checkRateLimit(`expert-verify:${ip}:${email}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  try {
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
      try {
        const admin = getSupabaseAdmin();
        await admin.from("auth_audit").insert({
          event: "otp_verify_failed",
          email,
          user_type: "expert",
          metadata: { reason: "invalid_or_expired" },
        });
      } catch {
        /* audit best-effort */
      }
      return apiError.validation(GENERIC_FAIL);
    }

    // Confirm there's an experts row tied to this email + it's active.
    const admin = getSupabaseAdmin();
    const { data: expertRow } = await admin
      .from("experts")
      .select("id, status, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (!expertRow) return apiError.forbidden(route);
    if (expertRow.status === "suspended" || expertRow.status === "archived") {
      return NextResponse.json(
        { ok: false, error: "Your expert portal isn't available right now." },
        { status: 403 },
      );
    }
    // Link auth_user_id if missing (first sign-in).
    if (!expertRow.auth_user_id) {
      await admin
        .from("experts")
        .update({
          auth_user_id: data.user.id,
          status: expertRow.status === "invited" ? "active" : expertRow.status,
          activated_at:
            expertRow.status === "invited" ? new Date().toISOString() : undefined,
        })
        .eq("id", expertRow.id);
    }

    try {
      await admin.from("auth_audit").insert({
        event: "otp_verify_success",
        email,
        user_id: data.user.id,
        user_type: "expert",
        metadata: { expert_id: expertRow.id },
      });
    } catch {
      /* audit best-effort */
    }

    return NextResponse.json({ ok: true, next: "/expert" });
  } catch (err) {
    return serverError(err, { route });
  }
}
