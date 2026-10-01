import "server-only";
import {
  ACCENT,
  EXPERTS_EMAIL,
  PARTNERSHIPS_EMAIL,
  SITE_HOST,
  TEAM_SIGNOFF,
  firstNameOf,
  sendEmailDraft,
  type EmailAttachment,
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
  PROVIDER_FREE_MONTHS,
  companyStandardStartsAt,
  formatLongDate,
  freeMonthsFor,
  normalizeProviderRate,
} from "@/lib/providerBilling";

/**
 * The ONE welcome email a provider receives, sent after they accept the
 * agreement and save a card (founding accept route and the portal
 * sign-and-pay routes). Attaches the signed agreement PDF.
 *
 *   partner  "You're in, [First name]. Welcome to the Aesthetic Success Network."
 *   expert   "Welcome to the bench." (portal live, book onboarding call)
 *   both     the expert welcome with the company block added
 *
 * Billing copy: card saved, nothing charged today, free founding months
 * end on [date] (experts: 12 months after the member launch for founding
 * invites, 6 for website; companies: 6), then $39 (experts flat;
 * companies $39 x 12 then $149, or flat). Cancel before the first charge
 * = no charge; after
 * that 30 days' notice. One reminder 7 days before.
 *
 * `accountEmail` is the address they sign in with and is the ONLY email
 * printed in the body. Staff copies travel as BCC (applyEmailSandbox).
 */

export type JoinConfirmationInput = {
  role: "partner" | "expert" | "both";
  /** Kept for callers; every company is on the same ladder. */
  rate?: string | null;
  /** Ladder companies: ISO date the $149 standard rate starts (company free end + 12 months). */
  standardStartsAt?: string | null;
  /** Role "both": the company side's free end (experts get 12 months, companies 6). */
  companyFreePeriodEndsAt?: string | null;
  /** True when this is a founding-invite acceptance. */
  founding?: boolean;
  /** ISO date the free founding months end (Stripe trial end). */
  freePeriodEndsAt?: string | null;
  to: string;
  /** The sign-in email shown in the body. Defaults to `to`. */
  accountEmail?: string;
  contactName: string;
  companyName?: string | null;
  pdfBuffer: Buffer;
  pdfFilename: string;
  portalUrl: string;
  agreementVersion: string;
  signedAt?: Date;
  /** Partner roles: the member offer on file. */
  memberOffer?: string | null;
  /** Multi-company agreements: every company with its own offer. */
  companies?: { name: string; category?: string | null; member_offer?: string | null }[] | null;
  /** Whether a card was saved as part of this acceptance. */
  cardCaptured?: boolean;
  /** Legacy fields still passed by older callers; freePeriodEndsAt wins. */
  expertTrialEndsAt?: string | null;
  trialEndsAt?: string | null;
};

const ONBOARDING_CALL_URL = process.env.ONBOARDING_CALL_URL ?? "";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

function hasPartner(role: JoinConfirmationInput["role"]) {
  return role === "partner" || role === "both";
}
function hasExpert(role: JoinConfirmationInput["role"]) {
  return role === "expert" || role === "both";
}

function roleLabelFor(role: JoinConfirmationInput["role"]): string {
  if (role === "both") return "Founding Expert and Partner";
  return role === "partner" ? "Founding Partner" : "Founding Expert";
}

function billingSection(input: JoinConfirmationInput): EmailSection {
  const items: string[] = [];
  const expertFreeEnd = input.freePeriodEndsAt ?? input.expertTrialEndsAt ?? input.trialEndsAt ?? null;
  const companyFreeEnd = input.companyFreePeriodEndsAt ?? input.freePeriodEndsAt ?? null;
  const plan = normalizeProviderRate(input.rate);
  if (hasExpert(input.role)) {
    const months = freeMonthsFor({ audience: "expert", founding: input.founding });
    const until = formatLongDate(expertFreeEnd);
    const side = input.role === "both" ? " for your expert access" : "";
    items.push(`Your ${months} founding months${side} are free, and they start the day we open to members.${until ? ` Free through: ${until}.` : ""}`);
    items.push(
      until
        ? `First charge: ${EXPERT_RATE_LABEL} on ${until}${side}, then ${EXPERT_RATE_LABEL} a month with no increase.`
        : `First charge: ${EXPERT_RATE_LABEL}${side} when your free months end, then ${EXPERT_RATE_LABEL} a month with no increase.`,
    );
  }
  if (hasPartner(input.role)) {
    const until = formatLongDate(companyFreeEnd);
    const side = input.role === "both" ? " for your company listing" : "";
    items.push(`Your ${PROVIDER_FREE_MONTHS} founding months${side} are free, and they start the day we open to members.${until ? ` Free through: ${until}.` : ""}`);
    if (plan === "flat") {
      items.push(
        until
          ? `First charge: ${COMPANY_LAUNCH_LABEL} on ${until}${side}, then ${COMPANY_LAUNCH_LABEL} a month with no increase.`
          : `First charge: ${COMPANY_LAUNCH_LABEL}${side} when your free months end, then ${COMPANY_LAUNCH_LABEL} a month with no increase.`,
      );
    } else {
      const stdDate = formatLongDate(input.standardStartsAt ?? (companyFreeEnd ? companyStandardStartsAt(new Date(companyFreeEnd)) : null));
      items.push(
        until
          ? `First charge: ${COMPANY_LAUNCH_LABEL} on ${until}${side}, then ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months.`
          : `First charge: ${COMPANY_LAUNCH_LABEL}${side} when your free months end, then ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months.`,
      );
      items.push(
        stdDate
          ? `From ${stdDate}: ${COMPANY_STANDARD_LABEL} a month${side}, the standard company rate.`
          : `After those ${COMPANY_LAUNCH_MONTHS} months: ${COMPANY_STANDARD_LABEL} a month${side}, the standard company rate.`,
      );
    }
  }
  items.push(
    `Cancel any time before your first charge and you won't be charged. After that, cancel with ${CANCEL_NOTICE_DAYS} days' written notice. We'll remind you ${FIRST_CHARGE_REMINDER_DAYS} days before your first charge.`,
  );
  return { title: "Your billing, in plain dates", items, tone: "gold" };
}

function offerSection(input: JoinConfirmationInput): EmailSection | null {
  if (!hasPartner(input.role)) return null;
  const companies = (input.companies ?? [])
    .map((c) => ({ name: (c.name ?? "").trim(), category: c.category?.trim() || null, offer: c.member_offer?.trim() || null }))
    .filter((c) => c.name);
  if (companies.length > 0 && !companies[0].offer && input.memberOffer?.trim()) companies[0].offer = input.memberOffer.trim();
  if (companies.length > 1) {
    return {
      title: "Your companies and member offers on file",
      items: companies.map((c) => `${c.name}${c.category ? ` (${c.category})` : ""}: ${c.offer ?? "offer to be confirmed before this listing goes live"}`),
      paragraphs: ["One founding fee covers all of the above. This is what members will see. Reply if anything needs correcting before it goes live."],
      tone: "gold",
    };
  }
  const offer = input.memberOffer?.trim() || companies[0]?.offer;
  if (!offer) return null;
  return {
    title: "Your member offer on file",
    paragraphs: [`${offer}. This is what members will see. Reply if anything needs correcting before it goes live.`],
    tone: "gold",
  };
}

function agreementSection(input: JoinConfirmationInput): EmailSection {
  const acceptedOn = formatDateTime(input.signedAt ?? new Date());
  return {
    title: "Your agreement",
    paragraphs: [
      `A copy of your Aesthetic Success Network ${roleLabelFor(input.role)} Agreement (${input.agreementVersion}) is attached, and you can download it anytime from your portal. Accepted by ${input.contactName} on ${acceptedOn}.`,
    ],
  };
}

const PARTNER_WHAT_WE_DO = [
  "A Verified Partner badge for your site and emails.",
  "Your page in our partner directory, with your logo, description, member offer and a way to book you.",
  "Founding partners are featured first when we open to members.",
  "We build material from one recording, in your company's name. You approve every piece, and it's yours to keep, even if you leave.",
  "A ready-made launch kit, and we promote you through our email list, social channels and a blog post from your session.",
  "A seat on the ASN podcast and first call to speak at our events.",
  "The Expert Hotline recommends you by fit. Referrals are never pay-to-play.",
  "Your courses and products in front of members. Members buy on your own site and you keep the full price. The one condition: a member-only offer on each.",
  "A network of vetted experts and companies to connect with for collaborations, co-marketing and referrals.",
  "A place in the Business of Aesthetics community (about 15,000 aesthetic professionals). Team members listed as experts get the Group Expert badge.",
  "The job board, and the expert side is included at no extra cost.",
];

const PARTNER_SEND_US = [
  "Your logo (PNG, transparent background if you have it)",
  "A one-paragraph company description",
  "The contact email members should use",
  "Your website and booking or demo link",
  "One recording: a webinar, demo or talk you've already done",
];

function partnerDraft(input: JoinConfirmationInput, name: string): EmailDraft {
  const accountEmail = input.accountEmail ?? input.to;
  const sections: EmailSection[] = [];
  const cardLine =
    input.cardCaptured === true
      ? "Your card is safely saved with Stripe. Nothing was charged today."
      : "No payment details were taken today.";
  if (input.cardCaptured) sections.push(billingSection(input));
  const offer = offerSection(input);
  if (offer) sections.push(offer);
  sections.push(agreementSection(input));
  sections.push({ title: "What we do for you", items: PARTNER_WHAT_WE_DO });
  sections.push({
    title: "What we ask of you",
    paragraphs: [
      "Your best deal for members, replies to member leads within one business day, a booking or demo link, and 30 days' notice before changing your offer.",
      "We can't promise a number of members, leads or sales, and we don't offer category exclusivity. What we promise is the work above, and that we put you in front of every member we bring in.",
    ],
  });
  sections.push({
    title: "What's next",
    paragraphs: ["Send us whatever you have on hand, and we'll chase down the rest:"],
    items: PARTNER_SEND_US,
  });
  sections.push({
    title: "Your portal",
    paragraphs: [
      "Your listing, member offer and material go live when we open to members, and we'll email you when members start reaching out.",
      `Sign in to your portal with this email: ${accountEmail}. Enter it there and we'll send you a 6-digit sign-in code.`,
    ],
  });
  return {
    subject: `You're in, ${name}. Welcome to the Aesthetic Success Network.`,
    preview: "Your Founding Partner agreement is confirmed. A copy is attached for your records.",
    eyebrow: "Founding partner",
    headline: `You're in, ${name}.`,
    intro: [`Welcome to the Aesthetic Success Network as a Founding Partner. ${cardLine}`],
    sections,
    ctas: [{ label: "Open your portal", url: input.portalUrl }],
    closing: "Questions? Reply to this email and our partnerships team will get back to you within one business day.",
    signoff: TEAM_SIGNOFF,
    footerNote: "Founding partner agreement accepted",
    footerLines: [
      "This is an automated confirmation that your Aesthetic Success Network partner agreement was accepted.",
      `Aesthetic Success Network · ${PARTNERSHIPS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: ACCENT.partner,
  };
}

function expertDraft(input: JoinConfirmationInput, name: string): EmailDraft {
  const accountEmail = input.accountEmail ?? input.to;
  const both = input.role === "both";
  const sections: EmailSection[] = [];
  if (ONBOARDING_CALL_URL) {
    sections.push({
      title: "Your next step: book your onboarding call",
      paragraphs: ["Pick a time for a 30-minute conversation with our team. We'll set up your expert profile, plan your first playbook, and answer any questions."],
      tone: "green",
    });
  } else {
    sections.push({
      title: "Your next step: your onboarding call",
      paragraphs: ["Our team will email you to book a 30-minute onboarding conversation. We'll set up your expert profile, plan your first playbook, and answer any questions."],
      tone: "green",
    });
  }
  sections.push({
    title: "What you can do inside the portal",
    items: [
      "Share your first recording. One recording of you teaching your topic is all we need. Our team turns it into a full playbook, published by ASN with your name and expertise front and center.",
      "Upload extra resources. SOPs, templates, slide decks, recordings and PDFs. We review them, format them in the ASN style, and add them to the member library.",
      "Complete your profile. This is what members see when the Expert Hotline recommends you.",
    ],
    paragraphs: ["The member side opens soon. Until then, use this time to get your profile and first playbook ready so members find you on day one."],
  });
  if (input.cardCaptured) sections.push(billingSection(input));
  if (both) {
    const offer = offerSection(input);
    if (offer) sections.push(offer);
    sections.push({ title: "What we do for your company", items: PARTNER_WHAT_WE_DO });
  }
  sections.push({
    title: "A few things to know",
    items: [
      "Expert Hotline referrals are routed by fit, never pay-to-play.",
      both
        ? "Your expert access and your company listing sit on one account, with one card and one sign-in."
        : "Have a company with a product or service for practice owners? It can join as a partner on the same account.",
    ],
  });
  sections.push(agreementSection(input));
  sections.push({
    title: "Sign in",
    paragraphs: [`Sign in to your portal with this email: ${accountEmail}. Enter it there and we'll send you a 6-digit sign-in code. No password needed.`],
  });
  const ctas = ONBOARDING_CALL_URL
    ? [
        { label: "Book your onboarding call", url: ONBOARDING_CALL_URL },
        { label: "Sign in to your portal", url: input.portalUrl, secondary: true },
      ]
    : [{ label: "Sign in to your portal", url: input.portalUrl }];
  return {
    subject: both
      ? `You're in, ${name}. Welcome to the Aesthetic Success Network.`
      : "Welcome to the bench: your Aesthetic Success Network expert portal is live",
    preview: "Your expert portal is live. Book your onboarding call and sign in with a 6-digit code.",
    eyebrow: both ? "Founding expert and partner" : "Expert portal live",
    headline: "Welcome to the bench.",
    intro: [
      `Hi ${name},`,
      both
        ? `Your Founding Expert and Partner agreement is accepted. Your expert portal and your company listing are live and ready for you. ${
            input.cardCaptured ? "Your card is safely saved with Stripe. Nothing was charged today." : ""
          }`.trim()
        : `Great news: your agreement is accepted, and you're now a founding expert with the Aesthetic Success Network. Your expert portal is live and ready for you. ${
            input.cardCaptured ? "Your card is safely saved with Stripe. Nothing was charged today." : ""
          }`.trim(),
    ],
    sections,
    ctas,
    closing: "Questions? Reply to this email and we'll get back to you within one business day.",
    signoff: ["Welcome to the bench.", ...TEAM_SIGNOFF],
    footerNote: "Expert portal active",
    footerLines: [
      "This is an automated confirmation that your Aesthetic Success Network expert portal is active.",
      `Aesthetic Success Network · ${EXPERTS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: ACCENT.expert,
  };
}

export async function sendJoinConfirmationEmail(input: JoinConfirmationInput): Promise<boolean> {
  const name = firstNameOf(input.contactName);
  const draft = input.role === "partner" ? partnerDraft(input, name) : expertDraft(input, name);
  const attachments: EmailAttachment[] = [
    { filename: input.pdfFilename, content: input.pdfBuffer, contentType: "application/pdf" },
  ];
  return sendEmailDraft({
    to: input.to,
    audience: input.role,
    draft,
    attachments,
    tag: `join-confirm:${input.role}`,
  });
}
