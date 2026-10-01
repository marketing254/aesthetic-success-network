import "server-only";
import {
  ACCENT,
  EXPERTS_EMAIL,
  PARTNERSHIPS_EMAIL,
  SITE_HOST,
  firstNameOf,
  sendEmailDraft,
  type EmailDraft,
  type EmailSection,
} from "@/lib/email/layout";
import {
  CANCEL_NOTICE_DAYS,
  COMPANY_LAUNCH_LABEL,
  COMPANY_LAUNCH_MONTHS,
  COMPANY_STANDARD_LABEL,
  EXPERT_RATE_LABEL,
  FIRST_CHARGE_REMINDER_DAYS,
  FOUNDING_EXPERT_FREE_MONTHS,
  PROVIDER_FREE_MONTHS,
  normalizeProviderRate,
} from "@/lib/providerBilling";

/**
 * Agreement email: sends the private /founding/<code> link to an expert
 * or partner (founding invite, or a website applicant the admin just
 * approved). This is the ONLY place the link is ever surfaced; it's
 * unguessable and expires. Attaches their personalized agreement PDF so
 * they can read it before clicking through.
 *
 * Terms shown: free founding months (6, from the member launch), then
 * $39 (experts: 12 free months then $39 flat; companies: 6 free months
 * then $39 x 12 then $149, or $39 flat on the flat plan). A
 * card is saved on acceptance; nothing is charged until the free months
 * end.
 */

const DEFAULT_PDF_FILENAME = "ASN-Founding-Agreement.pdf";

export type FoundingInviteEmailInput = {
  to: string;
  fullName: string;
  role: "expert" | "partner" | "both";
  /** Company plan: "ladder" ($39 x 12 then $149) or "flat" ($39). Ignored for expert-only invites. */
  pricing?: string | null;
  companyName?: string | null;
  inviteUrl: string;
  pdfBuffer?: Buffer | null;
  pdfFilename?: string;
  agreementVersion: string;
};

function roleLabelFor(role: FoundingInviteEmailInput["role"]): string {
  if (role === "both") return "Founding Expert and Partner";
  return role === "partner" ? "Founding Partner" : "Founding Expert";
}

function termsSection(input: FoundingInviteEmailInput): EmailSection {
  const items: string[] = [];
  const hasExpert = input.role === "expert" || input.role === "both";
  const hasPartner = input.role === "partner" || input.role === "both";
  if (hasExpert) {
    const side = input.role === "both" ? " for your expert access" : "";
    items.push(`Your first ${FOUNDING_EXPERT_FREE_MONTHS} months${side} are free, starting the day we open to members. After that it's ${EXPERT_RATE_LABEL} a month, and it stays ${EXPERT_RATE_LABEL} with no increase.`);
  }
  if (hasPartner) {
    const side = input.role === "both" ? " for your company listing" : "";
    items.push(
      normalizeProviderRate(input.pricing) === "flat"
        ? `Your first ${PROVIDER_FREE_MONTHS} months${side} are free, starting the day we open to members. After that it's ${COMPANY_LAUNCH_LABEL} a month, and it stays ${COMPANY_LAUNCH_LABEL} with no increase.`
        : `Your first ${PROVIDER_FREE_MONTHS} months${side} are free, starting the day we open to members. After that it's ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL} a month.`,
    );
  }
  items.push(
    `When you accept, we'll securely save a payment method. Nothing is charged until your free months end, and we'll remind you ${FIRST_CHARGE_REMINDER_DAYS} days before your first charge. Cancel any time before then and you won't be charged. After your first charge, cancel with ${CANCEL_NOTICE_DAYS} days' written notice.`,
  );
  return { title: "Your founding terms", items, tone: "gold" };
}

export async function sendFoundingInviteEmail(input: FoundingInviteEmailInput): Promise<boolean> {
  const name = firstNameOf(input.fullName);
  const roleLabel = roleLabelFor(input.role);
  const partnerSide = input.role === "partner" || input.role === "both";
  const forCompany = partnerSide && input.companyName ? ` for ${input.companyName}` : "";
  const draft: EmailDraft = {
    subject: "Your Aesthetic Success Network agreement is ready to sign",
    preview: `Your ${roleLabel} agreement is ready. Review it online and accept it electronically.`,
    eyebrow: "Agreement ready",
    headline: "Agreement ready for review.",
    intro: [
      `Hello ${name},`,
      `Your Aesthetic Success Network ${roleLabel} agreement${forCompany} is ready. A PDF copy is attached for your records.`,
      "Please use the secure link below to review the agreement online and accept it electronically. It takes a few minutes.",
    ],
    sections: [
      termsSection(input),
      {
        title: "After you accept",
        paragraphs: [
          partnerSide
            ? "Once you've accepted, we'll email you a signed copy and your portal access."
            : "Once you've accepted, we'll email you a signed copy for your records, and your expert portal opens.",
        ],
      },
    ],
    ctas: [{ label: "Review agreement", url: input.inviteUrl }],
    notes: ["This link is private to you and expires in 30 days. Please don't forward it."],
    closing: partnerSide
      ? "Questions? Reply to this email and our partnerships team will get back to you within one business day."
      : "Questions? Reply to this email and we'll get back to you within one business day.",
    footerNote: `${roleLabel} agreement`,
    footerLines: [
      `This agreement was prepared for ${input.fullName}${input.companyName ? ` (${input.companyName})` : ""}. Version ${input.agreementVersion}.`,
      `Aesthetic Success Network · ${partnerSide ? PARTNERSHIPS_EMAIL : EXPERTS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: partnerSide ? ACCENT.partner : ACCENT.expert,
  };
  const ok = await sendEmailDraft({
    to: input.to,
    audience: input.role,
    draft,
    attachments: input.pdfBuffer
      ? [{ filename: input.pdfFilename ?? DEFAULT_PDF_FILENAME, content: input.pdfBuffer, contentType: "application/pdf" }]
      : undefined,
    tag: `founding-invite:${input.role}`,
  });
  if (!ok) console.info(`[founding-invite:${input.role}] link for ${input.to}: ${input.inviteUrl}`);
  return ok;
}
