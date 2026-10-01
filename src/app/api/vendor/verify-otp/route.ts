import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/verify-otp
 *
 * Body: { email, token }   token = 6-digit code
 *
 * Verifies the OTP that /api/vendor/login sent. Lands the user at
 * /vendor (the partner portal home).
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const TOKEN_RE = /^\d{6}$/;
const GENERIC_FAIL = "That code didn't work. Request a new one and try again.";

export async function POST(req: Request) {
  const route = "POST /api/vendor/verify-otp";

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
  const rl = await checkRateLimit(`vendor-verify:${ip}:${email}`);
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
          user_type: "vendor",
          metadata: { reason: "invalid_or_expired" },
        });
      } catch {
        /* audit best-effort */
      }
      return apiError.validation(GENERIC_FAIL);
    }

    const admin = getSupabaseAdmin();
    const { data: vendorRow } = await admin
      .from("vendors")
      .select("id, status, auth_user_id")
      .eq("contact_email", email)
      .maybeSingle();

    if (!vendorRow) return apiError.forbidden(route);
    if (vendorRow.status === "rejected" || vendorRow.status === "churned") {
      return NextResponse.json(
        { ok: false, error: "Your partner portal isn't available right now." },
        { status: 403 },
      );
    }
    if (!vendorRow.auth_user_id) {
      await admin
        .from("vendors")
        .update({ auth_user_id: data.user.id })
        .eq("id", vendorRow.id);
    }

    try {
      await admin.from("auth_audit").insert({
        event: "otp_verify_success",
        email,
        user_id: data.user.id,
        user_type: "vendor",
        metadata: { vendor_id: vendorRow.id },
      });
    } catch {
      /* audit best-effort */
    }

    return NextResponse.json({ ok: true, next: "/vendor" });
  } catch (err) {
    return serverError(err, { route });
  }
}
