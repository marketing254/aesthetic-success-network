import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendAdminCodeEmail } from "@/lib/email/adminCode";

/**
 * Fallback for every OTP login route (member, expert, company, seeker,
 * admin). When Supabase Auth cannot email the 6-digit code itself, mint the
 * code with the Admin API and send it through the app's own SMTP mailbox.
 * The verify routes accept both code types ("email" and "magiclink").
 */
export type OtpFallbackResult =
  | { ok: true }
  | { ok: false; reason: "no_user" | "link_failed" | "mail_failed"; detail?: string };

export async function sendOtpViaFallback(email: string, tag: string): Promise<OtpFallbackResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    console.error(`[${tag}] generateLink failed:`, error.status, error.message);
    if (/not found/i.test(error.message ?? "") || error.status === 404 || error.status === 422) {
      return { ok: false, reason: "no_user", detail: error.message };
    }
    return { ok: false, reason: "link_failed", detail: error.message };
  }
  const otp = data?.properties?.email_otp;
  if (!otp) return { ok: false, reason: "link_failed", detail: "no email_otp in generateLink response" };
  try {
    await sendAdminCodeEmail(email, otp);
    return { ok: true };
  } catch (err) {
    console.error(`[${tag}] fallback code email failed:`, err);
    return { ok: false, reason: "mail_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Marker returned by requestOtp when the app's own sender already failed. */
export const APP_MAIL_FAILED = "app_mail_failed";

/** True when requestOtp already tried the app sender and it failed: do not retry. */
export function isAppMailFailure(error: { status?: number; message?: string } | null | undefined): boolean {
  return !!error && error.message === APP_MAIL_FAILED;
}

/** True when Supabase's per-address resend throttle produced the error. */
export function isOtpThrottle(error: { status?: number; message?: string }): boolean {
  return error.status === 429 || /security purposes|once every/i.test(error.message ?? "");
}

type OtpClient = { auth: { signInWithOtp: (args: { email: string; options: { shouldCreateUser: boolean } }) => Promise<{ error: { status?: number; message?: string } | null }> } };

/**
 * Request a sign-in code.
 *  - OTP_TRANSPORT=app: skip Supabase's own email and send the code through
 *    the app's SMTP straight away (fast; use while Supabase SMTP is broken).
 *  - otherwise: ask Supabase to send it, but give up after
 *    OTP_SUPABASE_TIMEOUT_MS (default 6000) so a hanging SMTP on Supabase's
 *    side never makes the button spin for half a minute; the caller's
 *    fallback then sends the code itself.
 */
export async function requestOtp(
  supabase: OtpClient,
  email: string,
  tag: string,
): Promise<{ error: { status?: number; message?: string } | null }> {
  if ((process.env.OTP_TRANSPORT ?? "").toLowerCase() === "app") {
    const fb = await sendOtpViaFallback(email, tag);
    if (fb.ok) return { error: null };
    if (fb.reason === "no_user") return { error: { status: 422, message: "user not found" } };
    // The app's own sender already tried and failed. Return a fixed marker
    // (the SMTP detail is logged above) so callers neither read a mail error
    // such as "Invalid login" as "no account", nor send the same code email
    // a second time, which is what spam filters punish.
    return { error: { status: 503, message: APP_MAIL_FAILED } };
  }
  const ms = Number(process.env.OTP_SUPABASE_TIMEOUT_MS ?? "6000");
  const timeout = new Promise<{ error: { status: number; message: string } }>((resolve) =>
    setTimeout(() => resolve({ error: { status: 504, message: "supabase otp send timed out" } }), ms),
  );
  return Promise.race([supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }), timeout]);
}
