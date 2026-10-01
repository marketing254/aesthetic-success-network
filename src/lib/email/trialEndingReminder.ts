import "server-only";
import {
  ACCENT,
  EXPERTS_EMAIL,
  PARTNERSHIPS_EMAIL,
  SITE_HOST,
  firstNameOf,
  sendEmailDraft,
  type EmailDraft,
} from "@/lib/email/layout";
import {
  CANCEL_NOTICE_DAYS,
  COMPANY_LAUNCH_LABEL,
  COMPANY_LAUNCH_MONTHS,
  COMPANY_STANDARD_LABEL,
  PAYMENT_GRACE_DAYS,
  formatLongDate,
  normalizeProviderRate,
} from "@/lib/providerBilling";

/**
 * The single reminder before a provider's first charge:
 * "Your free founding months end in 7 days." Sent once per provider by
 * the daily cron (/api/cron/provider-reminders) and stamped on the row
 * (free_period_reminder_sent_at). The Stripe trial_will_end webhook is a
 * safety net only and never sends a second copy.
 *
 * Applies to experts AND companies: every provider has the same free
 * founding months, then $39 (experts and flat companies: no increase;
 * ladder companies: $39 x 12 then $149).
 * Never says "trial".
 */

export type TrialEndingReminderInput = {
  role: "partner" | "expert";
  to: string;
  contactName: string;
  daysLeft: number;
  trialEndDate: Date;
  /** Portal billing page (update card, cancel). */
  portalUrl: string;
  /** Company plan ("ladder" / "flat"). Ignored for experts. */
  rate?: string | null;
};

function endsWords(daysLeft: number): string {
  if (daysLeft <= 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft} days`;
}

export async function sendTrialEndingReminder(input: TrialEndingReminderInput): Promise<boolean> {
  const name = firstNameOf(input.contactName);
  const rate = COMPANY_LAUNCH_LABEL;
  const ladder = input.role === "partner" && normalizeProviderRate(input.rate) !== "flat";
  const afterLine = ladder
    ? `It stays ${rate} a month for your first ${COMPANY_LAUNCH_MONTHS} paid months, then moves to the ${COMPANY_STANDARD_LABEL} standard company rate.`
    : `Your rate stays ${rate} a month with no increase, for as long as your ${input.role === "expert" ? "expert membership" : "company listing"} is active.`;
  const date = formatLongDate(input.trialEndDate) ?? "the end of your free months";
  const when = endsWords(input.daysLeft);
  const draft: EmailDraft = {
    subject: `Your free founding months end ${when}`,
    preview: `Your free founding months end on ${date}. ${rate} a month after that.`,
    eyebrow: "Billing reminder",
    headline: `Heads-up, ${name}: your free founding months end ${when}.`,
    intro: [
      `Your free founding months end on ${date}. On that day, Stripe will charge the card on file ${rate} for your first paid month. ${afterLine}`,
    ],
    sections: [
      {
        title: "Want to continue?",
        paragraphs: ["You don't need to do anything. If your card has expired or changed, update it now so nothing is interrupted."],
        tone: "green",
      },
      {
        title: "Want to stop?",
        paragraphs: [
          `Cancel any time before ${date} and you won't be charged. Open your billing page and choose Cancel, or reply to this email with the word "cancel" and we'll take care of it. ${
            input.role === "expert" ? "Your playbook and material are yours to keep." : "Your material is yours to keep."
          } After your first charge, cancellation takes ${CANCEL_NOTICE_DAYS} days' written notice.`,
        ],
      },
      {
        title: "What happens if the charge fails?",
        paragraphs: [
          `We'll email you right away. Your listing stays live for ${PAYMENT_GRACE_DAYS} days while you update your card. After that, your listing is paused until payment goes through.`,
        ],
      },
    ],
    ctas: [
      { label: "Update payment method", url: input.portalUrl },
      { label: "Cancel my membership", url: input.portalUrl, secondary: true },
    ],
    closing: "Questions? Reply to this email and we'll get back to you within one business day.",
    footerNote: "Billing reminder",
    footerLines: [
      `One reminder, sent ${input.daysLeft} days before your first charge. No further reminders will be sent.`,
      `Aesthetic Success Network · ${input.role === "expert" ? EXPERTS_EMAIL : PARTNERSHIPS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: input.role === "expert" ? ACCENT.expert : ACCENT.partner,
  };
  return sendEmailDraft({ to: input.to, audience: input.role, draft, tag: `free-period-reminder:${input.role}` });
}
