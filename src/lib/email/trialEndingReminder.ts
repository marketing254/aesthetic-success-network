import "server-only";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";

/**
 * Trial-ending reminder email. Fired by the Stripe webhook when
 * customer.subscription.trial_will_end (default: 3 days before trial
 * ends). For the 7-day-before ask in the product spec, run a daily
 * cron that queries vendors/experts where trial_end is 7 days out and
 * calls this same function.
 *
 * Transport priority mirrors joinConfirmation.ts — SMTP → Resend → log.
 */

const DEFAULT_FROM = "Aesthetic Success Network <support@aestheticsuccessnetwork.com>";
const SUPPORT_EMAIL = process.env.FOUNDING_SUPPORT_EMAIL ?? "support@aestheticsuccessnetwork.com";

function fromAddress(): string {
  return process.env.MAIL_FROM ?? DEFAULT_FROM;
}

export type TrialEndingReminderInput = {
  role: "partner" | "expert";
  to: string;
  contactName: string;
  daysLeft: number; // 3 for Stripe's default webhook, 7 for the cron
  trialEndDate: Date;
  portalUrl: string;
};

export async function sendTrialEndingReminder(
  input: TrialEndingReminderInput,
): Promise<boolean> {
  const roleLabel = input.role === "partner" ? "partner" : "expert";
  const firstName = input.contactName.trim().split(/\s+/)[0] || "there";
  const subject =
    input.daysLeft === 1
      ? `Your ASN ${roleLabel} trial ends tomorrow`
      : `Your ASN ${roleLabel} trial ends in ${input.daysLeft} days`;

  const html = buildHtml({ ...input, roleLabel, firstName });
  const text = buildText({ ...input, roleLabel, firstName });

  try {
    const from = fromAddress();

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpHost && smtpUser && smtpPass) {
      const port = Number(process.env.SMTP_PORT ?? "465");
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail(
        applyEmailSandbox({ from, to: input.to, replyTo: SUPPORT_EMAIL, subject, html, text }),
      );
      console.info(`[trial-ending:${input.role}] sent via SMTP`, { to: input.to });
      return true;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          applyEmailSandbox({ from, to: [input.to], reply_to: SUPPORT_EMAIL, subject, html, text }),
        ),
      });
      if (!res.ok) {
        console.error(
          `[trial-ending:${input.role}] Resend failed`,
          await res.text().catch(() => ""),
        );
        return false;
      }
      console.info(`[trial-ending:${input.role}] sent via Resend`, { to: input.to });
      return true;
    }

    console.info(
      `[trial-ending:${input.role}] (no transport) reminder for ${input.to} skipped`,
    );
    return false;
  } catch (err) {
    console.error(`[trial-ending:${input.role}] send failed`, err);
    return false;
  }
}

function endsWords(daysLeft: number): string {
  return daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
}

function formatTrialEnd(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildHtml(
  opts: TrialEndingReminderInput & { roleLabel: string; firstName: string },
): string {
  const dateStr = formatTrialEnd(opts.trialEndDate);
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5F0;padding:24px;color:#0A1A2F;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #E0DACE;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com"}/asn-logo-email.png" alt="Aesthetic Success Network" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;" />
  </div>
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;margin:0 0 8px 0;color:#0A1A2F;">
    Heads-up, ${escapeHtml(opts.firstName)}: your free trial ends ${endsWords(opts.daysLeft)}.
  </h1>
  <p style="color:#3B4A55;line-height:1.55;font-size:15px;">
    Your ASN ${escapeHtml(opts.roleLabel)} trial ends on <strong>${escapeHtml(dateStr)}</strong>. On that
    day Stripe will charge the card on file for the first paid month at
    $49. If the card has expired or changed, update it now so your
    listing doesn't get suspended.
  </p>
  <div style="background:#F7EED9;border:1px solid #D9A84B;border-radius:8px;padding:14px;margin:20px 0;">
    <p style="margin:0;font-size:14px;color:#0A1A2F;line-height:1.55;">
      <strong>What happens if the charge fails?</strong> The portal locks
      until you update the card. Nothing on your public listing changes
      immediately. You have a short grace period to fix it.
    </p>
  </div>
  <div style="text-align:center;margin:24px 0 8px 0;">
    <a href="${escapeHtml(opts.portalUrl)}" style="display:inline-block;background:#0E2A3D;color:#FFFFFF;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
      Update payment method &rarr;
    </a>
  </div>
  <p style="color:#7A8590;font-size:12px;line-height:1.5;margin:24px 0 0 0;text-align:center;">
    Questions? Reply to this email: ${escapeHtml(SUPPORT_EMAIL)}.<br/>
    Aesthetic Success Network, operated by Ekwa Marketing Inc. &middot; Powered by Business of Aesthetics
  </p>
</div>
</body></html>`;
}

function buildText(
  opts: TrialEndingReminderInput & { roleLabel: string; firstName: string },
): string {
  const dateStr = formatTrialEnd(opts.trialEndDate);
  return `Heads-up, ${opts.firstName}: your free trial ends ${endsWords(opts.daysLeft)}.

Your ASN ${opts.roleLabel} trial ends on ${dateStr}. On that day Stripe will
charge the card on file for the first paid month at $49. If the card
has expired or changed, update it now so your listing doesn't get
suspended.

If the charge fails, the portal locks until you update the card.
Nothing on your public listing changes immediately. You have a short
grace period to fix it.

Update payment method: ${opts.portalUrl}

Questions? Reply to this email: ${SUPPORT_EMAIL}.
Aesthetic Success Network, operated by Ekwa Marketing Inc. Powered by Business of Aesthetics.
`;
}
