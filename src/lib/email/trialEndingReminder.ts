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
  EXPERT_RATE_LABEL,
  PAYMENT_GRACE_DAYS,
  PROVIDER_FREE_MONTHS,
  formatLongDate,
  rateLabel,
} from "@/lib/providerBilling";

/**
 * The single reminder before a provider's first charge:
 * "Your free founding months end in 7 days." Sent once per provider by
 * the daily cron (/api/cron/provider-reminders) and stamped on the row
 * (free_period_reminder_sent_at). The Stripe trial_will_end webhook is a
 * safety net only and never sends a second copy.
 *
 * Applies to experts AND companies: every provider has the same free
 * founding months, then a flat rate ($39 experts; $39 or $149 companies).
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
  /** Company rate ("standard" / "large"). Ignored for experts. */
  rate?: string | null;
};

function endsWords(daysLeft: number): string {
  if (daysLeft <= 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft} days`;
}

export async function sendTrialEndingReminder(input: TrialEndingReminderInput): Promise<boolean> {
  const name = firstNameOf(input.contactName);
  const rate = input.role === "expert" ? EXPERT_RATE_LABEL : rateLabel(input.rate);
  const what = input.role === "expert" ? "expert membership" : "company listing";
  const date = formatLongDate(input.trialEndDate) ?? "the end of your free months";
  const when = endsWords(input.daysLeft);
  const draft: EmailDraft = {
    subject: `Your free founding months end ${when}`,
    preview: `Your ${PROVIDER_FREE_MONTHS} free founding months end on ${date}. ${rate} a month after that, with no increase.`,
    eyebrow: "Billing reminder",
    headline: `Heads-up, ${name}: your free founding months end ${when}.`,
    intro: [
      `Your ${PROVIDER_FREE_MONTHS} free founding months end on ${date}. On that day, Stripe will charge the card on file ${rate} for your first paid month. Your rate stays ${rate} a month with no increase, for as long as your ${what} is active.`,
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
