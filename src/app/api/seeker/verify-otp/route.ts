import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/seeker/verify-otp
 *
 * Body: { email, token, next? }   token = 6-digit OTP code
 *
 * Same security rails as /api/member/verify-otp: per-IP+email rate
 * limit, the code is never echoed or logged, and a failure returns one
 * generic message so it can't be used to work out which emails exist.
 *
 * THE `next` PARAMETER. The member route computes its landing path and
 * trusts nothing from the client, which is the right default. This route
 * has to do slightly more, because a job seeker signs in *mid-task*:
 * they clicked Apply on a specific job and we owe them a return trip to
 * that job rather than dumping them on a generic page.
 *
 * So `next` is accepted but never trusted — it is matched against an
 * allowlist of two shapes (a job page, or the applications list) and
 * anything else is discarded silently in favour of the default. A
 * scheme, a host, a protocol-relative "//evil.com" or a path outside
 * those two shapes cannot survive the regex, so there is no
 * open-redirect here.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

const TOKEN_RE = /^\d{6}$/;
const GENERIC_FAIL = "That code didn't work. Request a new one and try again.";

const DEFAULT_NEXT = "/seeker";
const APPLICATIONS_PATH = "/seeker/applications";
// A job slug is built by buildJobSlug(): lowercase letters, digits and
// hyphens only. Nothing here can express a host or a scheme.
const JOB_PAGE_RE = /^\/jobs\/[a-z0-9-]{3,160}$/;

function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  const value = raw.trim();
  if (value === DEFAULT_NEXT || value === APPLICATIONS_PATH) return value;
  if (JOB_PAGE_RE.test(value)) return value;
  return DEFAULT_NEXT;
}

export async function POST(req: Request) {
  const route = "POST /api/seeker/verify-otp";

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
  const rl = await checkRateLimit(`seeker-verify:${ip}:${email}`);
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

    const admin = getSupabaseAdmin();

    if (error || !data?.user) {
      try {
        await admin.from("auth_audit").insert({
          event: "otp_verify_failed",
          email,
          user_type: "job_seeker",
          metadata: { reason: "invalid_or_expired" },
        });
      } catch {
        /* audit best-effort */
      }
      return apiError.validation(GENERIC_FAIL);
    }

    const { data: row } = await admin
      .from("members")
      .select("id, status, account_type, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (!row) {
      // Code verified but no row to attach it to. Nothing useful can
      // happen from here.
      return apiError.forbidden(route);
    }

    if (row.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "That account isn't active." },
        { status: 403 },
      );
    }

    // Link the auth user. The RLS policies on job_applications resolve
    // the applicant via members.auth_user_id = auth.uid(), so an unlinked
    // row would show the applicant an empty list of their own
    // applications.
    if (row.auth_user_id !== data.user.id) {
      await admin.from("members").update({ auth_user_id: data.user.id }).eq("id", row.id);
    }

    try {
      await admin.from("auth_audit").insert({
        event: "otp_verify_success",
        email,
        user_id: data.user.id,
        user_type: "job_seeker",
        metadata: { member_id: row.id, account_type: row.account_type },
      });
    } catch {
      /* audit best-effort */
    }

    return NextResponse.json({ ok: true, next: safeNext(body.next) });
  } catch (err) {
    return serverError(err, { route });
  }
}
