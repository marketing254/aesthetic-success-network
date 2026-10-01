import type { WaitlistPayload, WaitlistRole } from "@/lib/waitlist/validate";
import { senderFor } from "@/lib/email/senders";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import type { ExpertApplicationPayload } from "@/lib/expert/validate";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";
import { ACCENT, firstNameOf, sendEmailDraft, type EmailDraft as LayoutDraft } from "@/lib/email/layout";
import { COMPANY_LAUNCH_LABEL, COMPANY_LAUNCH_MONTHS, COMPANY_STANDARD_LABEL, FIRST_CHARGE_REMINDER_DAYS, normalizeProviderRate, providerTermsSentence } from "@/lib/providerBilling";

type ConfirmationInput = {
  signup: WaitlistPayload;
  referenceId: string;
  submittedAt: string;
};

type ExpertConfirmationInput = {
  application: ExpertApplicationPayload;
  referenceId: string;
  submittedAt: string;
};

type EmailSection = {
  title: string;
  body?: string;
  items?: string[];
};

type CtaSpec = {
  label: string;
  url: string;
};

type EmailDraft = {
  role: WaitlistRole;
  subject: string;
  preview: string;
  eyebrow: string;
  headline: string;
  intro: string[];
  sections: EmailSection[];
  cta?: CtaSpec;
  closing: string;
  signoff: string[];
  footerNote: string;
  footerLines: string[];
  replyTo: string;
  accent: string;
  accentLight: string;
};

type BuiltEmail = {
  subject: string;
  html: string;
  text: string;
  replyTo: string;
};

type SendResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "disabled" | "missing_api_key" };

// One domain: aestheticsuccessnetwork.com. The site, the portal and every
// link in every email point at the www origin. One Rackspace mailbox
// (support@) authenticates SMTP and sends-as the other addresses on the
// same domain; the per-purpose From / Reply-To below is what the reader
// sees.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
const SITE_HOST = "aestheticsuccessnetwork.com";
const SUPPORT_EMAIL = process.env.WAITLIST_SUPPORT_EMAIL ?? "hello@aestheticsuccessnetwork.com";
const PARTNERSHIPS_EMAIL =
  process.env.WAITLIST_PARTNERSHIPS_EMAIL ?? "partners@aestheticsuccessnetwork.com";
const EXPERTS_EMAIL = process.env.WAITLIST_EXPERTS_EMAIL ?? "experts@aestheticsuccessnetwork.com";
const FROM_EMAIL =
  process.env.WAITLIST_EMAIL_FROM ??
  "Aesthetic Success Network <hello@aestheticsuccessnetwork.com>";

const BRAND_NAME = "Aesthetic Success Network";
const TEAM_SIGNOFF = ["The Aesthetic Success Network Team", "Powered by Business of Aesthetics"];

// Brand palette, used inline in the email HTML
const BRAND = {
  ink: "#0A1A2F",
  inkSoft: "#3B4A55",
  inkMute: "#5C6770",
  cream: "#F7F5F0",
  creamSoft: "#FBF8F1",
  line: "#E6DDCF",
  goldDeep: "#A07823",
  gold: "#D9A84B",
  goldLight: "#F0C16E",
};

// Email-safe font stacks.
//
// Body uses a humanist serif stack (Charter / Iowan / Georgia) that reads
// like a personal letter. Falls back to Georgia (preinstalled on Windows +
// Mac + iOS + Android) when Charter / Iowan aren't available.
//
// Display imports Fraunces from Google Fonts in <head> for clients that
// support it; Outlook + Windows Mail (which strip @import) fall through to
// the same warm-serif stack.
//
// UI chrome (CTAs, eyebrows, footer microcopy) uses a humanist sans stack
// so buttons stay legible and feel modern next to the serif body.
const FONT_DISPLAY =
  "'Fraunces','Iowan Old Style','Apple Garamond','Baskerville','Times New Roman', Georgia, serif";
const FONT_BODY =
  "'Charter','Iowan Old Style','Apple Garamond','Palatino Linotype','Book Antiqua', Georgia,'Times New Roman', serif";
const FONT_UI =
  "'Inter','Helvetica Neue', Helvetica,'Segoe UI', Roboto, Arial, sans-serif";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("en-US");
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeUrl(path: string): string {
  try {
    return new URL(path, SITE_URL).toString();
  } catch {
    return `https://www.aestheticsuccessnetwork.com${path}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DRAFTS. Copy mirrors the ASN launch-phase email set (July 2026) and the
// ASN canon: $29/month founding (first 100), $290/year, $99/month
// standard, 30-day money-back, hotline written reply in 2 to 3 business
// days. Providers (experts and companies, owner decision 2026-10-01): card
// saved on acceptance, first 6 months free from the member launch, then $39
// (website experts: 6 months free then $39 flat; companies: 6 months free then $39 x 12 then $149, or flat);
// courses and products sold on the provider's own site at full price with a
// member-only offer. No em-dashes.
// ─────────────────────────────────────────────────────────────────────────

function memberDraft(input: ConfirmationInput): EmailDraft {
  const submitted = formatDate(input.submittedAt);
  return {
    role: "member",
    subject: "Your founding spot is reserved | Aesthetic Success Network",
    preview:
      "You're on the founding waitlist. $29/month founding rate, locked while active. Nothing to pay today.",
    eyebrow: "Founding Waitlist",
    headline: "You're on the list.",
    accent: BRAND.gold,
    accentLight: BRAND.goldLight,
    replyTo: SUPPORT_EMAIL,
    intro: [
      `Hi ${firstName(input.signup.fullName)},`,
      "Welcome to the Aesthetic Success Network. Your spot on the founding waitlist is reserved, and there is nothing to pay today. As founding spots open we'll reach out personally, and you confirm before any charge.",
    ],
    sections: [
      {
        title: "What you get as a founding member",
        items: [
          "The Expert Hotline. Call our toll-free line, leave a voicemail, and get a written action plan by text and email within 2 to 3 business days, routed to the right experts by fit.",
          "A growing resource library. Training videos, action guides, checklists and worksheets, with new expert kits added weekly.",
          "Member-only partner deals. Exclusive pricing from vetted partners across devices, injectables, skincare, software and services.",
          "Live AMAs and CE. Monthly live sessions with the field's best experts, plus continuing-education opportunities.",
        ],
      },
      {
        title: "A few things to know",
        items: [
          "Your founding rate is $29/month (or $290/year, two months free), locked for as long as your membership stays active. After the first 100 members, the standard rate is $99/month.",
          "Every membership comes with a 30-day money-back guarantee, and you can cancel anytime.",
          "We'll email you before the doors open with everything you need. No payment happens until you confirm.",
        ],
      },
    ],
    cta: {
      label: "Visit the network",
      url: normalizeUrl("/"),
    },
    closing: `Questions in the meantime? Reply to this email or write to ${SUPPORT_EMAIL}. We read and respond to every message.`,
    signoff: ["Welcome aboard.", ...TEAM_SIGNOFF],
    footerNote: "Founding waitlist confirmation",
    footerLines: [
      `This is an automated confirmation of your ${BRAND_NAME} waitlist signup on ${submitted}. If this wasn't you, just ignore it.`,
      `Reference: ${input.referenceId}`,
      `${BRAND_NAME} · ${SUPPORT_EMAIL} · ${SITE_HOST}`,
    ],
  };
}

function draftFor(input: ConfirmationInput): EmailDraft {
  // Waitlist is members-only. Partners apply via the WaitlistSection on
  // /partners (posts to /api/vendor/signup) and receive a separate
  // sign-in email.
  return memberDraft(input);
}

// ─────────────────────────────────────────────────────────────────────────
// HTML RENDER, table-based layout so it works in every email client
// (Outlook, Apple Mail, Gmail iOS/Android). Inline styles only.
// ─────────────────────────────────────────────────────────────────────────

function renderIntro(intro: string[]): string {
  return intro
    .map(
      (line, i) =>
        `<p style="margin:${i === 0 ? "0" : "0"} 0 ${i === intro.length - 1 ? "0" : "16px"};color:${BRAND.inkSoft};font-family:${FONT_BODY};font-size:16px;line-height:1.7;font-weight:400;letter-spacing:-.003em;">${escapeHtml(line)}</p>`,
    )
    .join("");
}

function renderSection(section: EmailSection, accent: string): string {
  const body = section.body
    ? `<p style="margin:8px 0 0;color:${BRAND.inkSoft};font-family:${FONT_BODY};font-size:15px;line-height:1.7;font-weight:400;letter-spacing:-.003em;">${escapeHtml(section.body)}</p>`
    : "";
  const items = section.items
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0;width:100%;">${section.items
        .map(
          (item) => `
        <tr>
          <td valign="top" width="22" style="padding:9px 10px 0 0;">
            <div style="width:7px;height:7px;border-radius:50%;background:${accent};margin-top:0;"></div>
          </td>
          <td valign="top" style="padding:4px 0;color:${BRAND.inkSoft};font-family:${FONT_BODY};font-size:15px;line-height:1.65;font-weight:400;letter-spacing:-.003em;">${escapeHtml(item)}</td>
        </tr>`,
        )
        .join("")}</table>`
    : "";
  return `
    <tr>
      <td style="padding:26px 0 0;">
        <div style="display:inline-block;height:3px;width:24px;background:${accent};border-radius:2px;margin-bottom:12px;"></div>
        <h2 style="margin:0;color:${BRAND.ink};font-family:${FONT_BODY};font-size:16px;line-height:1.3;font-weight:700;letter-spacing:-.005em;">${escapeHtml(section.title)}</h2>
        ${body}
        ${items}
      </td>
    </tr>`;
}

function renderCta(cta: CtaSpec, accent: string): string {
  return `
    <tr>
      <td style="padding:30px 0 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="${accent}" style="border-radius:8px;background:${accent};">
              <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 24px;color:#FFFFFF;font-family:${FONT_UI};font-size:14px;font-weight:700;letter-spacing:.005em;text-decoration:none;border-radius:8px;mso-padding-alt:0;">${escapeHtml(cta.label)} &nbsp;&rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderHtml(draft: EmailDraft): string {
  const intro = renderIntro(draft.intro);
  const sections = draft.sections.map((s) => renderSection(s, draft.accent)).join("");
  const cta = draft.cta ? renderCta(draft.cta, draft.accent) : "";
  const closing = `
    <tr>
      <td style="padding:24px 0 0;">
        <div style="height:1px;background:${BRAND.line};margin-bottom:20px;"></div>
        <p style="margin:0;color:${BRAND.inkSoft};font-family:${FONT_BODY};font-size:14.5px;line-height:1.7;font-weight:400;letter-spacing:-.003em;">${escapeHtml(draft.closing)}</p>
      </td>
    </tr>`;
  const signoff = `
    <tr>
      <td style="padding:24px 0 0;">
        ${draft.signoff
          .map(
            (line, i) =>
              `<p style="margin:${i === 0 ? "0" : "4px 0 0"};color:${i === 0 ? BRAND.ink : BRAND.inkSoft};font-family:${FONT_BODY};font-size:${i === 0 ? "15.5px" : "14px"};line-height:1.6;font-weight:${i === 0 ? "600" : "500"};letter-spacing:-.003em;">${escapeHtml(line)}</p>`,
          )
          .join("")}
      </td>
    </tr>`;
  const footer = draft.footerLines
    .map(
      (line) =>
        `<div style="margin:3px 0;color:rgba(247,245,240,0.55);font-family:${FONT_UI};font-size:11.5px;line-height:1.6;letter-spacing:.002em;">${escapeHtml(line)}</div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${escapeHtml(draft.subject)}</title>
    <!-- Web fonts for clients that support @import (Apple Mail, iOS Mail,
         Gmail web, Yahoo, AOL). Outlook/Windows Mail will strip this and
         fall back to the system stack below, which still looks professional. -->
    <!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz, wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!--<![endif]-->
    <style>
      /* Strong typographic defaults, applied to every text node that doesn't override */
      body, table, td, p, a, h1, h2, h3, span, div {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      /* Tighten the optical sizing on the display headline */
      h1, .asn-display {
        font-feature-settings: "ss01" on, "ss02" on, "kern" on;
      }
      @media (max-width: 600px) {
        .container { padding: 18px 8px !important; }
        .card-pad { padding: 24px 22px 28px !important; }
        .footer-pad { padding: 20px 22px !important; }
        h1 { font-size: 24px !important; line-height: 1.16 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.creamSoft};font-family:${FONT_BODY};color:${BRAND.ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(draft.preview)}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.creamSoft};">
      <tr>
        <td class="container" align="center" style="padding:36px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;box-shadow:0 24px 60px -28px rgba(14,42,61,0.18);">

            <!-- Top brand bar with role accent -->
            <tr>
              <td style="height:5px;background:linear-gradient(90deg, ${BRAND.ink} 0%, ${draft.accent} 50%, ${BRAND.goldLight} 100%);font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- Header: brand wordmark + role chip -->
            <tr>
              <td style="padding:26px 34px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      ${emailBrandHeader({ dark: false })}
                    </td>
                    <td align="right" style="white-space:nowrap;">
                      <span style="display:inline-block;padding:6px 11px;border-radius:999px;background:${BRAND.creamSoft};border:1px solid ${BRAND.line};color:${draft.accent};font-family:${FONT_UI};font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(draft.eyebrow)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Headline + intro -->
            <tr>
              <td class="card-pad" style="padding:24px 34px 6px;">
                <h1 class="asn-display" style="margin:0 0 18px;color:${BRAND.ink};font-family:${FONT_DISPLAY};font-size:30px;line-height:1.12;font-weight:500;letter-spacing:-.02em;">${escapeHtml(draft.headline)}</h1>
                ${intro}
              </td>
            </tr>

            <!-- Sections -->
            <tr>
              <td class="card-pad" style="padding:0 34px 4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${sections}
                  ${cta}
                  ${closing}
                  ${signoff}
                </table>
              </td>
            </tr>

            <!-- Spacer to footer -->
            <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

            <!-- Footer -->
            <tr>
              <td class="footer-pad" style="padding:22px 34px;background:${BRAND.ink};">
                <div style="color:${BRAND.goldLight};font-family:${FONT_UI};font-size:10.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(draft.footerNote)}</div>
                ${footer}
              </td>
            </tr>

          </table>

          <!-- Outside footer (legal hint) -->
          <div style="max-width:620px;margin:14px auto 0;color:${BRAND.inkMute};font-family:${FONT_UI};font-size:11px;line-height:1.55;text-align:center;letter-spacing:.002em;">
            You received this because you contacted the ${BRAND_NAME}. ${BRAND_NAME}, operated by Ekwa Marketing Inc.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(draft: EmailDraft): string {
  const sections = draft.sections
    .map((section) => {
      const body = section.body ? `\n${section.body}` : "";
      const items = section.items ? `\n${section.items.map((item) => `- ${item}`).join("\n")}` : "";
      return `${section.title.toUpperCase()}${body}${items}`;
    })
    .join("\n\n");

  const lines = [
    draft.subject,
    "",
    ...draft.intro,
    "",
    sections,
    "",
    draft.cta ? `${draft.cta.label}: ${draft.cta.url}` : "",
    "",
    draft.closing,
    "",
    ...draft.signoff,
    "",
    draft.footerNote,
    ...draft.footerLines,
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));

  return lines.join("\n");
}

export function buildWaitlistConfirmationEmail(input: ConfirmationInput): BuiltEmail {
  const draft = draftFor(input);
  return {
    subject: draft.subject,
    html: renderHtml(draft),
    text: renderText(draft),
    replyTo: draft.replyTo,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SENDERS
//
// Single shared transport. Selection priority:
//   1. Generic SMTP (Rackspace, AWS SES SMTP, Mailgun SMTP, anything)
//      if SMTP_HOST + SMTP_USER + SMTP_PASS are set.
//   2. Gmail SMTP if GMAIL_USER + GMAIL_APP_PASSWORD are set (dev/legacy).
//   3. Resend API if RESEND_API_KEY is set (alternate prod path).
//   4. Otherwise log-only (preview mode for dev without creds).
//
// Every path runs the message through applyEmailSandbox() first, so a
// local run can never reach a real inbox unless EMAIL_SANDBOX=false.
//
// For ASN we use Rackspace. Set these env vars in Vercel:
//   SMTP_HOST=secure.emailsrvr.com
//   SMTP_PORT=465
//   SMTP_USER=support@aestheticsuccessnetwork.com
//   SMTP_PASS=<the password Rackspace provided>
// ─────────────────────────────────────────────────────────────────────────

type BuiltMail = { subject: string; html: string; text: string; replyTo: string };

/**
 * Send via whichever transport is configured. Returns the message id on
 * success or throws on failure. Caller decides whether to swallow the
 * error or surface it.
 */
async function dispatchMail(args: {
  to: string;
  from: string;
  mail: BuiltMail;
  tag: string;
}): Promise<{ id?: string; transport: "smtp" | "gmail" | "resend" | "log" }> {
  const { to, from, mail, tag } = args;

  // 1. Generic SMTP (Rackspace + most other providers)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    const port = Number(process.env.SMTP_PORT ?? "465");
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: smtpUser, pass: smtpPass },
    });
    const info = await transporter.sendMail(
      applyEmailSandbox({
        from,
        to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    );
    console.info(`[${tag}] sent via SMTP`, { to, host: smtpHost, messageId: info.messageId });
    return { id: info.messageId, transport: "smtp" };
  }

  // 2. Gmail (dev fallback)
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    });
    const info = await transporter.sendMail(
      applyEmailSandbox({
        from,
        to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    );
    console.info(`[${tag}] sent via Gmail SMTP`, { to, messageId: info.messageId });
    return { id: info.messageId, transport: "gmail" };
  }

  // 3. Resend API (alternate prod path)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        applyEmailSandbox({
          from,
          to: [to],
          reply_to: mail.replyTo,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      ),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      throw new Error(`Resend ${tag} failed with ${res.status}: ${details.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    console.info(`[${tag}] sent via Resend`, { to, messageId: data?.id });
    return { id: data?.id, transport: "resend" };
  }

  // 4. No sender configured — log only.
  console.info(`[${tag}] no sender configured; preview only`, { to, subject: mail.subject });
  return { transport: "log" };
}

export async function sendWaitlistConfirmationEmail(
  input: ConfirmationInput,
): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }

  const mail = buildWaitlistConfirmationEmail(input);
  const result = await dispatchMail({
    to: input.signup.email,
    from: senderFor("member"),
    mail,
    tag: "waitlist:email",
  });
  if (result.transport === "log") {
    return { sent: false, reason: "missing_api_key" };
  }
  return { sent: true, id: result.id };
}

// ─────────────────────────────────────────────────────────────────────────
// VENDOR MAGIC LINK
// Used by /api/vendor/signup and /api/vendor/login (magic mode) to send the
// one-time sign-in link to the partner email. Reuses the same transport
// stack as the waitlist confirmation; if nothing is configured the link is
// logged so a dev can copy it.
// ─────────────────────────────────────────────────────────────────────────

type VendorMagicInput = { email: string; link: string };

function buildVendorMagicEmail({ link }: VendorMagicInput): { subject: string; html: string; text: string; replyTo: string } {
  const subject = "Your partner sign-in link";
  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.creamSoft};font-family:${FONT_BODY};color:${BRAND.ink};">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="font-family:${FONT_UI};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.goldDeep};font-weight:700;margin-bottom:16px;">PARTNER PORTAL</div>
  <h1 style="font-family:${FONT_DISPLAY};font-size:28px;line-height:1.2;font-weight:500;color:${BRAND.ink};margin:0 0 16px;">Your sign-in link</h1>
  <p style="font-size:15px;line-height:1.65;color:${BRAND.inkSoft};margin:0 0 28px;">
    Click the button below to access your ${BRAND_NAME} partner portal. The link expires in 30 minutes for your security.
  </p>
  <a href="${safeLink}" style="display:inline-block;background:${BRAND.ink};color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;">Sign in to portal &rarr;</a>
  <p style="font-size:13px;line-height:1.6;color:${BRAND.inkMute};margin:28px 0 0;">
    If the button doesn't work, paste this link into your browser:<br/>
    <span style="word-break:break-all;color:${BRAND.goldDeep};">${safeLink}</span>
  </p>
  <hr style="border:0;border-top:1px solid ${BRAND.line};margin:32px 0;" />
  <p style="font-size:12px;line-height:1.6;color:${BRAND.inkMute};margin:0;">
    Didn't request this? You can safely ignore the email. The link won't sign anyone in unless they click it from your inbox.<br/>
    ${BRAND_NAME} &middot; Powered by Business of Aesthetics
  </p>
</div>
</body></html>`;
  const text = `Your ${BRAND_NAME} partner sign-in link.\n\nOpen this URL to access the portal (expires in 30 minutes):\n${link}\n\nIf you didn't request this, ignore the email.`;
  return { subject, html, text, replyTo: PARTNERSHIPS_EMAIL };
}

// ─────────────────────────────────────────────────────────────────────────
// COMPANY APPROVED ("You're verified")
// Sent by /api/admin/vendors when the team approves a company. The
// agreement (with the card step) arrives in a separate email right after;
// the portal opens once it is accepted. Rendered through the shared
// layout so it matches the expert emails.
// ─────────────────────────────────────────────────────────────────────────

type VendorApprovalInput = {
  email: string;
  contactName: string;
  companyName: string;
  /** Company plan: "ladder" ($39 x 12 then $149) or "flat" ($39). */
  rate?: string | null;
  /** Portal sign-in page (https://.../vendor/login). */
  portalUrl?: string;
};

const PARTNER_WHAT_WE_DO = [
  "A Verified Partner badge for your site and emails.",
  "Your page in our partner directory, with your logo, your description, your member offer and a way to book you.",
  "Founding partners are featured first when we open to members.",
  "We build material from one recording (a webinar, demo or talk you've already done), in your company's name. You approve every piece before it goes live, and it's yours to keep, even if you leave.",
  "A ready-made launch kit. Posts with the words written, quote cards, a QR code and an email banner.",
  "We promote you, not just list you. Our email list, our social channels, and a blog post from your session.",
  "A seat on the ASN podcast, exclusive to members.",
  "First call to speak at our events.",
  "The Expert Hotline recommends you by fit. When a member's question matches what you offer, we name you. Referrals are never pay-to-play.",
  "Your courses and products in front of members. Members buy on your own site and you keep the full price, with no cut to us. The one condition: a member-only offer on each.",
  "A network of vetted experts and companies. Connect directly with the other experts and partners serving aesthetic practices, for collaborations, co-marketing and referrals.",
  "A place in the Business of Aesthetics community (about 15,000 aesthetic professionals) to share what you know. Team members listed as experts get the Group Expert badge.",
  "The job board. Post roles and send candidates there.",
  "The expert side is included. Your team can also be listed as experts at no extra cost.",
];

function vendorApprovalDraft(input: VendorApprovalInput): LayoutDraft {
  const name = firstNameOf(input.contactName);
  return {
    subject: `You're verified: ${input.companyName} is approved for the Aesthetic Success Network`,
    preview: `${input.companyName} is approved and verified. Sign in, accept the agreement and save a card to activate your listing.`,
    eyebrow: "Partner verified",
    headline: `You're in, ${name}.`,
    intro: [
      `Our team reviewed ${input.companyName}, and we're delighted to confirm your partner account is approved and verified.`,
    ],
    sections: [
      {
        title: "Your next step: sign in and accept your agreement",
        paragraphs: [
          `Sign in to your company portal with this email: ${input.email}. Enter it there and we'll send you a 6-digit code. Inside, review the Provider Agreement, tick "I agree" and save a card. Nothing is charged today; that step activates your listing and we email you a signed copy.`,
        ],
        tone: "green",
      },
      { title: "What we do for you", items: PARTNER_WHAT_WE_DO },
      {
        title: "What we ask of every partner",
        items: [
          "One exclusive offer for members, your best deal",
          "Respond to member leads within one business day",
          "A booking or demo link",
          "30 days' notice before changing your offer",
          "Your membership fee once your free months end",
        ],
      },
      {
        title: "Your founding terms",
        paragraphs: [
          `${providerTermsSentence(input.rate)} Nothing is charged until your free months end, and we'll remind you ${FIRST_CHARGE_REMINDER_DAYS} days before your first charge. Cancel any time before then and you won't be charged.`,
        ],
        tone: "gold",
      },
      {
        title: "What to send us",
        paragraphs: ["Reply with whatever you have on hand, and we'll chase down the rest:"],
        items: [
          "Your logo (PNG, transparent background if you have it)",
          "A one-paragraph company description",
          "Your member offer",
          "The contact email members should use",
          "Your website and booking or demo link",
        ],
      },
      {
        title: "What we promise",
        paragraphs: [
          `We can't promise a number of members, leads or sales, and we don't offer category exclusivity. What we promise is the work above, and that we put you in front of every member we bring in. After your free months it's ${normalizeProviderRate(input.rate) === "flat" ? `${COMPANY_LAUNCH_LABEL} a month with no increase` : `${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL} a month`}.`,
        ],
      },
    ],
    ctaTop: input.portalUrl ? { label: "Sign in to your portal", url: input.portalUrl } : undefined,
    ctas: input.portalUrl ? [{ label: "Sign in to your portal", url: input.portalUrl }] : undefined,
    closing: "Questions? Reply to this email and our partnerships team will get back to you within one business day.",
    signoff: TEAM_SIGNOFF,
    footerNote: "Partner verified",
    footerLines: [
      `This is an automated confirmation that ${input.companyName} is approved and verified on the Aesthetic Success Network.`,
      `Aesthetic Success Network · ${PARTNERSHIPS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: ACCENT.partner,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MEMBER WELCOME EMAIL
// Sent by /api/admin/members/activate when a waitlist signup is promoted
// to an active member. Same brand language as the partner approval email.
// ─────────────────────────────────────────────────────────────────────────

type MemberWelcomeInput = {
  email: string;
  firstName: string;
  portalUrl: string;
};

function buildMemberWelcomeEmail({ firstName, portalUrl }: MemberWelcomeInput): {
  subject: string;
  html: string;
  text: string;
  replyTo: string;
} {
  const subject = "Your ASN portal is ready";
  const safePortal = escapeHtml(portalUrl);
  const safeName = escapeHtml(firstName);

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.creamSoft};font-family:${FONT_BODY};color:${BRAND.ink};">
<div style="max-width:580px;margin:0 auto;padding:44px 24px;">
  <div style="font-family:${FONT_UI};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.goldDeep};font-weight:700;margin-bottom:18px;">FOUNDING MEMBER · PORTAL ACTIVE</div>
  <h1 style="font-family:${FONT_DISPLAY};font-size:30px;line-height:1.18;font-weight:500;color:${BRAND.ink};margin:0 0 18px;letter-spacing:-.02em;">Welcome, ${safeName}.</h1>
  <p style="font-size:16px;line-height:1.7;color:${BRAND.inkSoft};margin:0 0 14px;">
    Your founding-member portal is live. You'll find the resource library waiting for you: practical, no-fluff kits built for aesthetic practice owners. Pick a topic and dig in.
  </p>
  <p style="font-size:16px;line-height:1.7;color:${BRAND.inkSoft};margin:0 0 28px;">
    To get in, click the button below and enter the email you joined with. We'll send you a one-time 6-digit sign-in code.
  </p>
  <a href="${safePortal}" style="display:inline-block;background:${BRAND.ink};color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;">Open your portal &rarr;</a>
  <hr style="border:0;border-top:1px solid ${BRAND.line};margin:36px 0 24px;" />
  <h2 style="font-family:${FONT_UI};font-size:14px;font-weight:700;color:${BRAND.ink};letter-spacing:.005em;margin:0 0 10px;text-transform:uppercase;">What you have access to today</h2>
  <ul style="font-size:14.5px;line-height:1.75;color:${BRAND.inkSoft};margin:0;padding-left:20px;">
    <li>The resource library: videos, action guides, worksheets, checklists</li>
    <li>Kits on pricing and margins, consult conversion, team and hiring, marketing and growth, operations and compliance</li>
    <li>Your member profile (practice details, contact info)</li>
    <li>New kits unlock automatically. You don't need to do anything</li>
  </ul>
  <p style="font-size:13px;line-height:1.65;color:${BRAND.inkMute};margin:32px 0 0;">
    Questions? Reply to this email. Our team reads every reply.<br/>
    ${BRAND_NAME} &middot; Powered by Business of Aesthetics
  </p>
</div>
</body></html>`;

  const text = `Welcome, ${firstName}.

Your founding-member portal is live. You'll find the resource library waiting for you: practical, no-fluff kits built for aesthetic practice owners. Pick a topic and dig in.

To get in, open the link below and enter the email you joined with. We'll send you a one-time 6-digit sign-in code.

Open your portal: ${portalUrl}

What you have access to today:
- The resource library: videos, action guides, worksheets, checklists
- Kits on pricing and margins, consult conversion, team and hiring, marketing and growth, operations and compliance
- Your member profile (practice details, contact info)
- New kits unlock automatically. You don't need to do anything

Questions? Reply to this email. Our team reads every reply.
${BRAND_NAME}. Powered by Business of Aesthetics.`;

  return { subject, html, text, replyTo: SUPPORT_EMAIL };
}

export async function sendMemberWelcomeEmail(input: MemberWelcomeInput): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }
  const mail = buildMemberWelcomeEmail(input);
  const result = await dispatchMail({
    to: input.email,
    from: senderFor("member"),
    mail,
    tag: "member:welcome",
  });
  if (result.transport === "log") {
    return { sent: false, reason: "missing_api_key" };
  }
  return { sent: true, id: result.id };
}

export async function sendVendorApprovalEmail(input: VendorApprovalInput): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }
  const ok = await sendEmailDraft({
    to: input.email,
    audience: "partner",
    draft: vendorApprovalDraft(input),
    tag: "vendor:approval",
  });
  return ok ? { sent: true } : { sent: false, reason: "missing_api_key" };
}

export async function sendVendorMagicLinkEmail(input: VendorMagicInput): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }

  const mail = buildVendorMagicEmail(input);
  const result = await dispatchMail({
    to: input.email,
    from: senderFor("partner"),
    mail,
    tag: "vendor:magic-link",
  });
  if (result.transport === "log") {
    return { sent: false, reason: "missing_api_key" };
  }
  return { sent: true, id: result.id };
}

// ─────────────────────────────────────────────────────────────────────────
// EXPERT APPLICATION RECEIVED
// Sent by /api/expert/signup when a coach / consultant / educator
// submits the application form.
// ─────────────────────────────────────────────────────────────────────────

const HOTLINE_FIT_LINE = "Expert Hotline referrals are routed by fit, never pay-to-play.";

function expertApplicationDraft(input: ExpertConfirmationInput): LayoutDraft {
  const submitted = formatDate(input.submittedAt);
  const name = firstName(input.application.fullName);
  return {
    subject: "Your Aesthetic Success Network expert application: what happens next",
    preview: "We've received your application and it's now in review. Our team will respond within 5 business days.",
    eyebrow: "Expert application",
    headline: "Application in review.",
    intro: [
      `Hi ${name},`,
      "Thank you for applying to join the Aesthetic Success Network as a founding expert. We've received your application and it's now in review.",
    ],
    sections: [
      {
        title: "Here's what to expect",
        paragraphs: [
          "Within the next 5 business days, our team will review your application. We look at your track record with aesthetic practice owners, what you teach and how it helps them, and how well it fits our members. We review carefully because protecting member trust is the whole point of curation.",
        ],
      },
      {
        title: "If your application is approved",
        items: [
          "You'll receive an approval email with a link to book a 30-minute onboarding conversation with our team.",
          "During onboarding, we'll set up your expert profile and walk you through how it works. You share one recording of you teaching your topic, and we turn it into a full playbook for our members, published by ASN with your name and expertise front and center. Members who want more help can book time straight onto your calendar.",
          `Your founding terms lock in. ${providerTermsSentence(null, { expert: true })} You pay nothing while we build.`,
        ],
      },
      {
        title: "If we have follow-up questions",
        paragraphs: [
          `We may email you to clarify parts of your application or ask for more detail about your work. Watch for a message from ${EXPERTS_EMAIL}.`,
        ],
      },
      {
        title: "A few things worth knowing while you wait",
        items: [
          "Founding expert spots are limited. We're choosing launch experts carefully so they cover the full range of practice growth topics without too much overlap in any one area.",
          HOTLINE_FIT_LINE,
          "Have a company with a product or service for practice owners? It can join as a partner, and a partner account includes the expert side. One account covers both.",
        ],
      },
    ],
    closing: "If you have questions in the meantime, reply to this email and we'll get back to you within one business day.",
    signoff: ["Thanks for your interest in helping us build the network.", ...TEAM_SIGNOFF],
    footerNote: "Expert application received",
    footerLines: [
      "This is an automated confirmation of your Aesthetic Success Network expert application.",
      `Application reference: ${input.referenceId} · Submitted: ${submitted}`,
      `Aesthetic Success Network · ${EXPERTS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: ACCENT.expert,
  };
}

export async function sendExpertConfirmationEmail(input: ExpertConfirmationInput): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }
  const ok = await sendEmailDraft({
    to: input.application.email,
    audience: "expert",
    draft: expertApplicationDraft(input),
    tag: "expert:application",
  });
  return ok ? { sent: true } : { sent: false, reason: "missing_api_key" };
}

// ─────────────────────────────────────────────────────────────────────────
// EXPERT APPROVED
// Sent by /api/admin/experts when the team approves an application. The
// agreement (with the card step) arrives in a separate email right
// after; the portal opens once it is accepted (see joinConfirmation.ts
// for that welcome).
// ─────────────────────────────────────────────────────────────────────────

type ExpertApprovalInput = {
  email: string;
  firstName: string;
  expertId: string;
  portalLink?: string;
  /** Portal sign-in page (https://.../expert/login). */
  portalLoginUrl?: string;
  activatedAt?: string;
};

function expertApprovalDraft(input: ExpertApprovalInput): LayoutDraft {
  const approved = formatDate(input.activatedAt ?? new Date().toISOString());
  const name = (input.firstName ?? "").trim() || "there";
  return {
    subject: "You're approved: welcome to the Aesthetic Success Network bench",
    preview: "Your application is approved. Sign in, accept the agreement and save a card to open your portal.",
    eyebrow: "Expert approved",
    headline: "Welcome to the bench.",
    intro: [
      `Hi ${name},`,
      "Great news: your application is approved, and you're invited to join the Aesthetic Success Network as a founding expert.",
    ],
    sections: [
      {
        title: "Your next step: sign in and accept your agreement",
        paragraphs: [
          `Sign in to your expert portal with this email: ${input.email}. Enter it there and we'll send you a 6-digit code. Inside, review the Provider Agreement, tick "I agree" and save a card. Nothing is charged today; that step opens your portal, we email you a signed copy, and we start building your first playbook.`,
        ],
        tone: "green",
      },
      {
        title: "Your founding terms",
        paragraphs: [providerTermsSentence(null, { expert: true })],
        tone: "gold",
      },
      {
        title: "Get a head start",
        paragraphs: ["Gather these for your first onboarding call:"],
        items: [
          "A headshot, the highest resolution you have",
          "A short bio, or we'll draft one for your approval",
          "Your booking link (Calendly or similar)",
          "Your title and credentials as you want them shown",
          "One recording of you teaching your topic: a webinar, talk or podcast you've already done",
        ],
      },
    ],
    ctaTop: input.portalLoginUrl ? { label: "Sign in to your portal", url: input.portalLoginUrl } : undefined,
    ctas: input.portalLoginUrl ? [{ label: "Sign in to your portal", url: input.portalLoginUrl }] : undefined,
    closing: "Questions? Reply to this email and we'll get back to you within one business day.",
    signoff: ["Welcome to the bench.", ...TEAM_SIGNOFF],
    footerNote: "Expert approved",
    footerLines: [
      "This is an automated confirmation that your Aesthetic Success Network expert application is approved.",
      `Account reference: ${input.expertId} · Approved: ${approved}`,
      `Aesthetic Success Network · ${EXPERTS_EMAIL} · ${SITE_HOST}`,
    ],
    accent: ACCENT.expert,
  };
}

export async function sendExpertApprovalEmail(input: ExpertApprovalInput): Promise<SendResult> {
  if (process.env.WAITLIST_EMAIL_DISABLED === "true") {
    return { sent: false, reason: "disabled" };
  }
  const ok = await sendEmailDraft({
    to: input.email,
    audience: "expert",
    draft: expertApprovalDraft(input),
    tag: "expert:approved",
  });
  return ok ? { sent: true } : { sent: false, reason: "missing_api_key" };
}
