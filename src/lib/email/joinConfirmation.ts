import "server-only";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import { readFileSync } from "node:fs";
import path from "node:path";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";

/**
 * Confirmation email for a new founding partner / expert. Attaches the
 * signed agreement PDF and points them at their portal.
 *
 * Copy follows Agreements/ASN_Forms_and_Esign_Spec.md: sender and
 * reply-to support@aestheticsuccessnetwork.com, the ASN legal line, every
 * billing step as a plain calendar date (the first $39 charge, and for
 * founding companies the $149 start), no card details, no em-dashes, and
 * the sign-in email restated (no code is sent from here; the portal login
 * screen sends the 6-digit code once they arrive).
 *
 * Billing copy per case:
 *   Founding expert (invite):   $0 for 12 months, then $39/month for good.
 *   Founding company (invite):  $39/month from today for 12 months, then
 *                               $149/month (ladder) or $39 for good (flat).
 *   Website expert:             $0 for 6 months, then $39/month for good.
 *   Website company:            $39/month from today for 12 months, then
 *                               $149/month (same as the founding ladder).
 *
 * Transport strategy mirrors teamNotify.ts: SMTP if configured, Resend
 * fallback, log-only in dev. Same fromAddress().
 */

const DEFAULT_FROM = "Aesthetic Success Network <support@aestheticsuccessnetwork.com>";
const SUPPORT_EMAIL = process.env.FOUNDING_SUPPORT_EMAIL ?? "support@aestheticsuccessnetwork.com";
const LEGAL_LINE = "Aesthetic Success Network, operated by Ekwa Marketing Inc.";
const LOGO_CID = "asn-logo-mark";

function fromAddress(): string {
  return process.env.MAIL_FROM ?? DEFAULT_FROM;
}

let LOGO_BUFFER: Buffer | null | undefined;
function getLogoBuffer(): Buffer | null {
  if (LOGO_BUFFER !== undefined) return LOGO_BUFFER;
  try {
    // Square navy tile mark (128px, ~15 KB). The full lockups are far too
    // large to attach inline to every email.
    const file = path.join(process.cwd(), "public", "asn-logo-email.png");
    LOGO_BUFFER = readFileSync(file);
  } catch {
    LOGO_BUFFER = null;
  }
  return LOGO_BUFFER;
}

function hasPartnerRole(role: JoinConfirmationInput["role"]): boolean {
  return role === "partner" || role === "both";
}
function hasExpertRole(role: JoinConfirmationInput["role"]): boolean {
  return role === "expert" || role === "both";
}

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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export type JoinConfirmationInput = {
  role: "partner" | "expert" | "both";
  /** Company price plan (founding invites, 0066). "ladder" (the default) = $39 for 12 months then $149; "flat_49" = $39 for good. */
  pricing?: "ladder" | "flat_49" | null;
  /** True when this is a founding-invite acceptance (case A / B pricing). Website flows leave it unset. */
  founding?: boolean;
  /** ISO date the EXPERT free period ends (first $39 expert charge). Founding: 12 months; website: 6 months. */
  expertTrialEndsAt?: string | null;
  /** ISO date the COMPANY moves to $149/month (month 13; founding ladder and website). */
  partnerStandardStartsAt?: string | null;
  to: string;
  contactName: string;
  companyName?: string | null;
  pdfBuffer: Buffer;
  pdfFilename: string;
  portalUrl: string;
  agreementVersion: string;
  /** When the agreement was accepted. Defaults to now if omitted. */
  signedAt?: Date;
  /** Member offer text, partner roles only. Omit the whole section if empty. */
  memberOffer?: string | null;
  /** Multi-company agreements: every company on the agreement with its own
   * offer. When 2+ entries exist the email lists offers per company instead
   * of the single memberOffer line. */
  companies?: { name: string; category?: string | null; member_offer?: string | null }[] | null;
  /** ISO date the website EXPERT trial ends / first $39 charge lands. Legacy field; expertTrialEndsAt wins. Ignored for companies (no trial). */
  trialEndsAt?: string | null;
  /** Whether a card was actually saved to Stripe as part of this signup (founding invite accept, portal trial start). Public join/apply flows don't capture a card here, so default false. */
  cardCaptured?: boolean;
};

/** Normalize the companies list; folds the invite-level offer into the
 * primary company so the per-company list is complete. */
function companiesWithOffers(opts: {
  companies?: JoinConfirmationInput["companies"];
  memberOffer?: string | null;
}): { name: string; category: string | null; member_offer: string | null }[] {
  const list = (opts.companies ?? [])
    .map((c) => ({
      name: (c.name ?? "").trim(),
      category: c.category?.trim() || null,
      member_offer: c.member_offer?.trim() || null,
    }))
    .filter((c) => c.name);
  if (list.length > 0 && !list[0].member_offer && opts.memberOffer?.trim()) {
    list[0].member_offer = opts.memberOffer.trim();
  }
  return list;
}

export async function sendJoinConfirmationEmail(
  input: JoinConfirmationInput,
): Promise<boolean> {
  const roleLabel =
    input.role === "both"
      ? "Founding Expert + Partner"
      : input.role === "partner"
        ? "Founding Partner"
        : "Founding Expert";
  const firstName = input.contactName.trim().split(/\s+/)[0] || "there";
  const subject = `You're in, ${firstName}. Welcome to the Aesthetic Success Network.`;
  const preheader = `Your ${roleLabel} agreement is confirmed. A copy is attached for your records.`;

  const opts = { ...input, roleLabel, firstName, preheader };
  const html = buildHtml(opts);
  const text = buildText(opts);
  const logoBuffer = getLogoBuffer();

  const base64Attachments = [
    {
      filename: input.pdfFilename,
      content: input.pdfBuffer.toString("base64"),
      contentType: "application/pdf",
    },
    ...(logoBuffer
      ? [
          {
            filename: "asn-logo.png",
            content: logoBuffer.toString("base64"),
            contentType: "image/png",
            content_id: LOGO_CID,
          },
        ]
      : []),
  ];

  try {
    const from = fromAddress();

    // SMTP
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
        applyEmailSandbox({
          from,
          to: input.to,
          replyTo: SUPPORT_EMAIL,
          subject,
          html,
          text,
          attachments: [
            {
              filename: input.pdfFilename,
              content: input.pdfBuffer,
              contentType: "application/pdf",
            },
            ...(logoBuffer
              ? [
                  {
                    filename: "asn-logo.png",
                    content: logoBuffer,
                    contentType: "image/png",
                    cid: LOGO_CID,
                  },
                ]
              : []),
          ],
        }),
      );
      console.info(`[join-confirm:${input.role}] sent via SMTP`, { to: input.to });
      return true;
    }

    // Resend fallback
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          applyEmailSandbox({
            from,
            to: [input.to],
            reply_to: SUPPORT_EMAIL,
            subject,
            html,
            text,
            attachments: base64Attachments,
          }),
        ),
      });
      if (!res.ok) {
        console.error(
          `[join-confirm:${input.role}] Resend failed`,
          await res.text().catch(() => ""),
        );
        return false;
      }
      console.info(`[join-confirm:${input.role}] sent via Resend`, { to: input.to });
      return true;
    }

    console.info(
      `[join-confirm:${input.role}] (no transport) welcome PDF for ${input.to} skipped`,
    );
    return false;
  } catch (err) {
    console.error(`[join-confirm:${input.role}] send failed`, err);
    return false;
  }
}

type BuiltOpts = JoinConfirmationInput & {
  roleLabel: string;
  firstName: string;
  preheader: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expert-side billing in plain calendar dates. $0 through the day before
 * the free period ends, then $39/month for good (experts never step up).
 * Founding invites: 12 months free; website experts: 6 months free.
 */
function expertBillingLines(opts: BuiltOpts): string[] {
  const signedAt = opts.signedAt ?? new Date();
  const freeMonths = opts.founding ? 12 : 6;
  const iso = opts.expertTrialEndsAt ?? opts.trialEndsAt;
  const trialEnd = iso ? new Date(iso) : addMonths(signedAt, freeMonths);
  const freeThrough = formatDate(new Date(trialEnd.getTime() - DAY_MS));
  const sideLabel = opts.role === "both" ? " for your expert access" : "";
  return [
    `Today through ${freeThrough}: $0${sideLabel} (your ${freeMonths} founding months)`,
    `First $39 charge on ${formatDate(trialEnd)}: $39/month${sideLabel} from then on, with no increase`,
  ];
}

/**
 * Company-side billing in plain calendar dates. Every company pays from
 * today; there is no free period.
 *   Founding (invite): $39/month from today for 12 months, then $149/month
 *     (ladder) or $39 for good (flat_49).
 *   Website: $39/month from today for 12 months, then $149/month.
 */
function companyBillingLines(opts: BuiltOpts): string[] {
  const signedAt = opts.signedAt ?? new Date();
  const sideLabel = opts.role === "both" ? " for your company listing" : "";
  if (opts.founding && opts.pricing === "flat_49") {
    return [`Today: first $39 charge${sideLabel}, then $39/month with no increase`];
  }
  const standardStart = opts.partnerStandardStartsAt
    ? new Date(opts.partnerStandardStartsAt)
    : addMonths(signedAt, 12);
  const growthThrough = formatDate(new Date(standardStart.getTime() - DAY_MS));
  const standardLabel = opts.founding ? "founding standard rate" : "standard rate";
  return [
    `Today through ${growthThrough}: $39/month${sideLabel} (your first 12 months, first charge today)`,
    `From ${formatDate(standardStart)}: $149/month${sideLabel} ${standardLabel}`,
  ];
}

function billingLines(opts: BuiltOpts): string[] {
  const lines: string[] = [];
  if (hasExpertRole(opts.role)) lines.push(...expertBillingLines(opts));
  if (hasPartnerRole(opts.role)) lines.push(...companyBillingLines(opts));
  // Only experts have a free period. Companies pay from today.
  const hasFreePeriod = hasExpertRole(opts.role);
  lines.push(
    hasFreePeriod
      ? `Cancel anytime with 30 days' written notice. We'll remind you 7 days before your free period ends.`
      : `Cancel anytime with 30 days' written notice.`,
  );
  return lines;
}

function billingSubject(opts: BuiltOpts): string {
  if (opts.role === "both") {
    const companyDisplay = opts.companyName?.trim() || opts.contactName;
    return `${companyDisplay}'s partner listing and your expert access`;
  }
  return hasPartnerRole(opts.role) ? "your partner listing" : "your expert access";
}

function welcomeLines(opts: BuiltOpts): string[] {
  const billingActive = opts.cardCaptured === true;
  const lines: string[] = [];
  // Every company (founding invite or website signup) is charged $39 the
  // day the card is saved.
  const companyChargedToday = billingActive;
  if (opts.role === "both") {
    lines.push(`Welcome to the Aesthetic Success Network as a Founding Expert and Partner.`);
    lines.push(
      billingActive
        ? companyChargedToday
          ? `Your card is safely saved with Stripe. Your first $39 company charge was made today; your expert access is free for 12 months. The billing below covers ${billingSubject(opts)} under one provider account.`
          : `Your card is safely saved with Stripe and nothing was charged today. The billing below covers ${billingSubject(opts)} under one provider account.`
        : `Your application is confirmed, and no payment details were taken today. We'll be in touch once it's reviewed.`,
    );
  } else if (opts.role === "partner") {
    lines.push(
      billingActive
        ? companyChargedToday
          ? `Welcome to the Aesthetic Success Network as a Founding Partner. Your card is safely saved with Stripe and your first $39 charge was made today.`
          : `Welcome to the Aesthetic Success Network as a Founding Partner. Your card is safely saved with Stripe. Nothing was charged today.`
        : `Welcome to the Aesthetic Success Network as a Founding Partner. Your application is confirmed, and no payment details were taken today. We'll be in touch once it's reviewed.`,
    );
  } else {
    lines.push(
      billingActive
        ? `Welcome to the Aesthetic Success Network as a Founding Expert. Your card is safely saved with Stripe. Nothing was charged today.`
        : `Welcome to the Aesthetic Success Network as a Founding Expert. Your application is confirmed, and no payment details were taken today. We'll be in touch once it's reviewed.`,
    );
  }
  return lines;
}

function agreementSentence(opts: BuiltOpts): string {
  const acceptedOn = formatDateTime(opts.signedAt ?? new Date());
  return `A copy of your Aesthetic Success Network ${opts.roleLabel} Agreement (${opts.agreementVersion}) is attached to this email, and you can download it anytime from your portal. Accepted by ${opts.contactName} on ${acceptedOn}.`;
}

function whatsNextItems(opts: BuiltOpts): string[] {
  const partner = hasPartnerRole(opts.role);
  const expert = hasExpertRole(opts.role);
  const items: string[] = [];
  if (expert) items.push("Your profile and first kit go live at launch");
  if (partner) items.push("Your listing, member offer, and resources go live at launch");
  items.push("We'll email you when members start reaching out");
  return items;
}

function buildHtml(opts: BuiltOpts): string {
  const partnerRole = hasPartnerRole(opts.role);
  const billingActive = opts.cardCaptured === true;

  const logoHtml = getLogoBuffer()
    ? `${emailBrandHeader({ center: true })}`
    : `${emailBrandHeader({ center: true })}`;

  let billingHtml = "";
  if (billingActive) {
    billingHtml = `
  <h2 style="font-size:14px;font-weight:800;letter-spacing:1px;color:#5C6770;margin:24px 0 10px 0;">
    YOUR BILLING, IN PLAIN DATES
  </h2>
  <ul style="padding-left:18px;line-height:1.6;color:#3B4A55;font-size:14px;margin:0 0 4px 0;">
    ${billingLines(opts)
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("\n    ")}
  </ul>`;
  }

  let memberOfferHtml = "";
  const emailCompanies = companiesWithOffers(opts);
  const offer = opts.memberOffer?.trim();
  if (partnerRole && emailCompanies.length > 1) {
    // Multi-company agreement: one block listing each company's own offer.
    const rows = emailCompanies
      .map(
        (c) => `
      <div style="margin-bottom:10px;">
        <div style="font-size:13.5px;font-weight:700;color:#0A1A2F;">${escapeHtml(c.name)}${
          c.category ? ` <span style="font-weight:400;color:#7A8590;">&middot; ${escapeHtml(c.category)}</span>` : ""
        }</div>
        <div style="font-size:13.5px;color:#3B4A55;line-height:1.5;">${
          c.member_offer ? escapeHtml(c.member_offer) : "Offer to be confirmed before this listing goes live."
        }</div>
      </div>`,
      )
      .join("");
    memberOfferHtml = `
  <div style="background:#F7EED9;border:1px solid #D9A84B;border-radius:8px;padding:16px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#A07823;margin-bottom:10px;">
      YOUR COMPANIES &amp; MEMBER OFFERS ON FILE
    </div>
    ${rows}
    <p style="margin:6px 0 0;font-size:13px;color:#5C6770;line-height:1.5;">
      One founding fee covers all of the above. This is what members will see. Reply if anything needs correcting before it goes live.
    </p>
  </div>`;
  } else if (partnerRole && offer) {
    memberOfferHtml = `
  <div style="background:#F7EED9;border:1px solid #D9A84B;border-radius:8px;padding:16px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#A07823;margin-bottom:8px;">
      YOUR MEMBER OFFER ON FILE
    </div>
    <p style="margin:0;font-size:14px;color:#0A1A2F;line-height:1.55;">
      ${escapeHtml(offer)}. This is what members will see. Reply if anything needs correcting before it goes live.
    </p>
  </div>`;
  }

  const whatsNextHtml = whatsNextItems(opts)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n    ");

  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5F0;padding:24px;color:#0A1A2F;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #E0DACE;">
  <div style="text-align:center;margin-bottom:24px;">
    ${logoHtml}
  </div>
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;margin:0 0 8px 0;color:#0A1A2F;">
    You&#39;re in, ${escapeHtml(opts.firstName)}.
  </h1>
  ${welcomeLines(opts)
    .map((line) => `<p style="color:#3B4A55;line-height:1.55;margin:0 0 8px 0;font-size:15px;">${escapeHtml(line)}</p>`)
    .join("\n  ")}
  ${billingHtml}
  ${memberOfferHtml}
  <div style="background:#F7EED9;border:1px solid #D9A84B;border-radius:8px;padding:16px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#A07823;margin-bottom:8px;">
      YOUR AGREEMENT
    </div>
    <p style="margin:0;font-size:14px;color:#0A1A2F;line-height:1.55;">
      ${escapeHtml(agreementSentence(opts))}
    </p>
  </div>
  <h2 style="font-size:14px;font-weight:800;letter-spacing:1px;color:#5C6770;margin:24px 0 10px 0;">
    WHAT&#39;S NEXT
  </h2>
  <ul style="padding-left:18px;line-height:1.6;color:#3B4A55;font-size:14px;margin:0 0 20px 0;">
    ${whatsNextHtml}
  </ul>
  <p style="color:#3B4A55;line-height:1.55;margin:0 0 8px 0;font-size:14px;">
    Sign in at your portal with this email: <strong>${escapeHtml(opts.to)}</strong>. Enter it there and we&#39;ll send you a 6-digit sign-in code.
  </p>
  <div style="text-align:center;margin:20px 0 8px 0;">
    <a href="${escapeHtml(opts.portalUrl)}" style="display:inline-block;background:#0E2A3D;color:#FFFFFF;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
      Open your portal
    </a>
  </div>
  <p style="color:#7A8590;font-size:12px;line-height:1.5;margin:24px 0 0 0;text-align:center;">
    Questions? Reply to this email or write to us at ${escapeHtml(SUPPORT_EMAIL)}.<br/>
    Cancel anytime with 30 days&#39; written notice.<br/>
    ${escapeHtml(LEGAL_LINE)} &middot; Powered by Business of Aesthetics
  </p>
</div>
</body></html>`;
}

function buildText(opts: BuiltOpts): string {
  const partnerRole = hasPartnerRole(opts.role);
  const billingActive = opts.cardCaptured === true;

  let billingText = "";
  if (billingActive) {
    billingText = `
Your billing, in plain dates:
${billingLines(opts)
  .map((line) => `  - ${line}`)
  .join("\n")}
`;
  }

  let memberOfferText = "";
  const emailCompanies = companiesWithOffers(opts);
  const offer = opts.memberOffer?.trim();
  if (partnerRole && emailCompanies.length > 1) {
    const rows = emailCompanies
      .map(
        (c) =>
          `  - ${c.name}${c.category ? ` (${c.category})` : ""}: ${
            c.member_offer ?? "offer to be confirmed before this listing goes live"
          }`,
      )
      .join("\n");
    memberOfferText = `
Your companies & member offers on file (one founding fee covers all):
${rows}
This is what members will see. Reply if anything needs correcting before it goes live.
`;
  } else if (partnerRole && offer) {
    memberOfferText = `
Your member offer on file:
${offer}. This is what members will see. Reply if anything needs correcting before it goes live.
`;
  }

  const whatsNextText = whatsNextItems(opts)
    .map((item) => `  - ${item}`)
    .join("\n");

  return `You're in, ${opts.firstName}.

${welcomeLines(opts).join("\n")}
${billingText}${memberOfferText}
Your agreement:
${agreementSentence(opts)}

What's next:
${whatsNextText}

Sign in at your portal with this email: ${opts.to}. Enter it there and we'll send you a 6-digit sign-in code.

Open your portal: ${opts.portalUrl}

Questions? Reply to this email or write to us at ${SUPPORT_EMAIL}.
Cancel anytime with 30 days' written notice.
${LEGAL_LINE} Powered by Business of Aesthetics.
`;
}
