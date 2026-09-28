/**
 * Local-run email safety (ASN-SWAP-CANON section 2).
 *
 * Every outbound transport in the app calls applyEmailSandbox() on the
 * message right before nodemailer sendMail / the Resend POST. When the
 * sandbox is on, the message is re-addressed to EMAIL_SANDBOX_TO, cc/bcc
 * are dropped, and the subject is prefixed with the recipients it would
 * have gone to. Supabase Auth sign-in codes are not affected (they leave
 * through the Supabase dashboard SMTP, not through this code).
 *
 * The sandbox is ON when:
 *   - EMAIL_SANDBOX=true, or JOB_EMAILS_SANDBOX=true (legacy alias), or
 *   - NODE_ENV is not "production" and EMAIL_SANDBOX is not explicitly
 *     "false".
 * It is OFF only in production, or when EMAIL_SANDBOX=false is set on
 * purpose for a local run that must reach real inboxes.
 *
 * This file also owns the recipient lists that used to be hard-coded in
 * source. Each one reads a comma-separated env var with a single default
 * inbox, so nothing personal lives in the repo.
 */

export const DEFAULT_TEAM_INBOX = "rushdhaakbar82@gmail.com";

/** Parse a comma-separated env list; falls back to `fallback` when unset or empty. */
export function emailListFromEnv(name: string, fallback: string[] = [DEFAULT_TEAM_INBOX]): string[] {
  const raw = process.env[name];
  if (raw === undefined) return [...fallback];
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [...fallback];
}

/** TEAM_DISTRIBUTION_LIST: every internal alert (signup, payment, lead magnet). */
export function teamDistributionList(): string[] {
  return emailListFromEnv("TEAM_DISTRIBUTION_LIST");
}

/** EMAIL_AUDIT_BCC: silent copies of member-facing sequences and job-board mail; summit ops alert. */
export function auditBccList(): string[] {
  return emailListFromEnv("EMAIL_AUDIT_BCC");
}

/** EMAIL_QUEUE_ALERT_TO: the job-board review-queue alert and abandoned-draft review sends. */
export function queueAlertList(): string[] {
  return emailListFromEnv("EMAIL_QUEUE_ALERT_TO");
}

/** TEST_MEMBER_EMAILS: internal accounts excluded from founding-number math and sequences. Default empty. */
export function testMemberEmails(): Set<string> {
  return new Set(emailListFromEnv("TEST_MEMBER_EMAILS", []).map((e) => e.toLowerCase()));
}

/** SUPPRESSED_EMAILS: addresses the abandoned-registration sequence must never touch. Default empty. */
export function suppressedEmails(): Set<string> {
  return new Set(emailListFromEnv("SUPPRESSED_EMAILS", []).map((e) => e.toLowerCase()));
}

export function sandboxRecipient(): string {
  return process.env.EMAIL_SANDBOX_TO?.trim() || DEFAULT_TEAM_INBOX;
}

export function isEmailSandbox(): boolean {
  const flag = (process.env.EMAIL_SANDBOX ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if ((process.env.JOB_EMAILS_SANDBOX ?? "").trim().toLowerCase() === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

type AddressLike = string | { address?: string; name?: string } | null | undefined;

function describeRecipients(value: AddressLike | AddressLike[]): string {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((v) => {
      if (!v) return "";
      if (typeof v === "string") return v.trim();
      return v.address ? (v.name ? `${v.name} <${v.address}>` : v.address) : "";
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Rewrite a message for the sandbox. Works for nodemailer options and for
 * Resend JSON bodies alike (both use to / cc / bcc / subject). Returns the
 * message untouched when the sandbox is off.
 */
export function applyEmailSandbox<
  T extends { to?: unknown; cc?: unknown; bcc?: unknown; subject?: string },
>(msg: T): T {
  if (!isEmailSandbox()) return msg;

  const to = describeRecipients(msg.to as AddressLike | AddressLike[]);
  const cc = describeRecipients(msg.cc as AddressLike | AddressLike[]);
  const bcc = describeRecipients(msg.bcc as AddressLike | AddressLike[]);
  const parts = [`would go to ${to || "(nobody)"}`];
  if (cc) parts.push(`cc ${cc}`);
  if (bcc) parts.push(`bcc ${bcc}`);
  const label = parts.join("; ");
  const target = sandboxRecipient();

  console.info(`[email-sandbox] redirected to ${target} (${label})`);

  return {
    ...msg,
    to: target,
    cc: undefined,
    bcc: undefined,
    subject: `[TEST · ${label}] ${msg.subject ?? ""}`.trimEnd(),
  };
}
