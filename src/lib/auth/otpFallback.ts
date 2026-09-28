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

/** True when Supabase's per-address resend throttle produced the error. */
export function isOtpThrottle(error: { status?: number; message?: string }): boolean {
  return error.status === 429 || /security purposes|once every/i.test(error.message ?? "");
}
