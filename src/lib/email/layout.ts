import "server-only";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";
import { replyToFor, senderFor, type EmailAudience } from "@/lib/email/senders";

/**
 * One layout for every client-facing ASN email.
 *
 * The expert, company and member emails used to be built in four
 * different files with four different font stacks. This module owns the
 * fonts, palette, table-based shell and the single transport, and every
 * email is just an EmailDraft (headline, intro, sections, buttons,
 * footer). Keep copy in the callers; keep looks here.
 */

export const BRAND_NAME = "Aesthetic Success Network";
export const LEGAL_LINE = "Aesthetic Success Network, operated by Ekwa Marketing Inc.";
export const POWERED_BY = "Powered by Business of Aesthetics";
export const SITE_HOST = "aestheticsuccessnetwork.com";
export const TEAM_SIGNOFF = ["The Aesthetic Success Network Team", POWERED_BY];

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
export const EXPERTS_EMAIL = process.env.WAITLIST_EXPERTS_EMAIL ?? "experts@aestheticsuccessnetwork.com";
export const PARTNERSHIPS_EMAIL = process.env.WAITLIST_PARTNERSHIPS_EMAIL ?? "partners@aestheticsuccessnetwork.com";
export const SUPPORT_EMAIL = process.env.FOUNDING_SUPPORT_EMAIL ?? "support@aestheticsuccessnetwork.com";

export const PALETTE = {
  ink: "#0A1A2F",
  inkSoft: "#3B4A55",
  inkMute: "#5C6770",
  cream: "#F7F5F0",
  creamSoft: "#FBF8F1",
  line: "#E6DDCF",
  goldDeep: "#A07823",
  gold: "#D9A84B",
  goldLight: "#F0C16E",
  goldTint: "#F7EED9",
  green: "#2C7A52",
  greenTint: "#EAF4EE",
} as const;

export const ACCENT = {
  expert: "#2C7A52",
  partner: "#A07823",
  member: "#0E2A3D",
} as const;

// Email-safe font stacks. Display is Fraunces (loaded for clients that
// honour <link>, warm serif fallback elsewhere); body is a humanist serif
// so the emails read like a letter; UI chrome (buttons, labels, footer)
// is Inter / system sans so it stays crisp.
export const FONT_DISPLAY =
  "'Fraunces','Iowan Old Style','Apple Garamond','Baskerville','Times New Roman', Georgia, serif";
export const FONT_BODY =
  "'Charter','Iowan Old Style','Apple Garamond','Palatino Linotype','Book Antiqua', Georgia,'Times New Roman', serif";
export const FONT_UI = "'Inter','Helvetica Neue', Helvetica,'Segoe UI', Roboto, Arial, sans-serif";

export type EmailSection = {
  /** Uppercase label above the block, e.g. "YOUR FOUNDING TERMS". */
  title: string;
  /** Paragraphs. */
  paragraphs?: string[];
  /** Bulleted list. */
  items?: string[];
  /** Tinted callout box instead of plain text. */
  tone?: "plain" | "gold" | "green";
};

export type EmailCta = { label: string; url: string; /** Secondary = outlined. */ secondary?: boolean };

export type EmailDraft = {
  subject: string;
  /** Inbox preview line. */
  preview: string;
  /** Small chip at the top right, e.g. "EXPERT APPROVED". */
  eyebrow: string;
  headline: string;
  /** Paragraphs under the headline. */
  intro: string[];
  /** A button right under the intro, for the action nobody should have to scroll for. */
  ctaTop?: EmailCta;
  sections?: EmailSection[];
  /** Buttons rendered after the sections (first is primary). */
  ctas?: EmailCta[];
  /** Small-print lines under the buttons (link expiry, cancellation rule). */
  notes?: string[];
  /** Closing paragraph before the sign-off. */
  closing?: string;
  signoff?: string[];
  /** Dark footer label, e.g. "Expert portal active". */
  footerNote: string;
  footerLines: string[];
  accent: string;
};

function p(text: string, opts: { size?: number; last?: boolean; color?: string } = {}): string {
  const size = opts.size ?? 16;
  return `<p style="margin:0 0 ${opts.last ? 0 : 14}px;color:${opts.color ?? PALETTE.inkSoft};font-family:${FONT_BODY};font-size:${size}px;line-height:1.7;letter-spacing:-.003em;">${escapeHtml(text)}</p>`;
}

function list(items: string[], accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 0;width:100%;">${items
    .map(
      (item) => `
      <tr>
        <td valign="top" width="20" style="padding:9px 10px 0 0;"><div style="width:6px;height:6px;border-radius:50%;background:${accent};"></div></td>
        <td valign="top" style="padding:4px 0;color:${PALETTE.inkSoft};font-family:${FONT_BODY};font-size:15px;line-height:1.65;letter-spacing:-.003em;">${escapeHtml(item)}</td>
      </tr>`,
    )
    .join("")}</table>`;
}

function section(s: EmailSection, accent: string): string {
  const paragraphs = (s.paragraphs ?? [])
    .map((t, i, arr) => p(t, { size: 15, last: i === arr.length - 1 && !s.items }))
    .join("");
  const items = s.items?.length ? list(s.items, accent) : "";
  const label = `<div style="font-family:${FONT_UI};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${s.tone === "green" ? PALETTE.green : s.tone === "gold" ? PALETTE.goldDeep : PALETTE.inkMute};margin:0 0 10px;">${escapeHtml(s.title)}</div>`;
  if (s.tone === "gold" || s.tone === "green") {
    const bg = s.tone === "gold" ? PALETTE.goldTint : PALETTE.greenTint;
    const border = s.tone === "gold" ? PALETTE.gold : "#BFE0CC";
    return `
    <tr><td style="padding:22px 0 0;">
      <div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 18px;">
        ${label}${paragraphs}${items}
      </div>
    </td></tr>`;
  }
  return `
    <tr><td style="padding:26px 0 0;">
      <div style="display:inline-block;height:3px;width:24px;background:${accent};border-radius:2px;margin-bottom:10px;"></div>
      ${label}${paragraphs}${items}
    </td></tr>`;
}

function buttons(ctas: EmailCta[], accent: string): string {
  if (!ctas.length) return "";
  const cells = ctas
    .map((c) =>
      c.secondary
        ? `<td style="padding:0 10px 10px 0;"><a href="${escapeHtml(c.url)}" style="display:inline-block;padding:12px 22px;color:${PALETTE.ink};font-family:${FONT_UI};font-size:14px;font-weight:700;text-decoration:none;border:1.5px solid ${PALETTE.ink};border-radius:8px;">${escapeHtml(c.label)}</a></td>`
        : `<td style="padding:0 10px 10px 0;"><a href="${escapeHtml(c.url)}" style="display:inline-block;padding:14px 24px;color:#FFFFFF;background:${accent};font-family:${FONT_UI};font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(c.label)} &nbsp;&rarr;</a></td>`,
    )
    .join("");
  return `<tr><td style="padding:28px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;
}

export function renderEmailHtml(d: EmailDraft): string {
  const intro = d.intro.map((t, i) => p(t, { last: i === d.intro.length - 1 })).join("");
  const ctaTop = d.ctaTop
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td><a href="${escapeHtml(d.ctaTop.url)}" style="display:inline-block;padding:14px 24px;color:#FFFFFF;background:${d.accent};font-family:${FONT_UI};font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(d.ctaTop.label)} &nbsp;&rarr;</a></td></tr></table>`
    : "";
  const sections = (d.sections ?? []).map((s) => section(s, d.accent)).join("");
  const ctas = buttons(d.ctas ?? [], d.accent);
  const notes = d.notes?.length
    ? `<tr><td style="padding:14px 0 0;">${d.notes.map((n) => p(n, { size: 13, color: PALETTE.inkMute })).join("")}</td></tr>`
    : "";
  const closing = d.closing
    ? `<tr><td style="padding:22px 0 0;"><div style="height:1px;background:${PALETTE.line};margin-bottom:18px;"></div>${p(d.closing, { size: 14.5, last: true })}</td></tr>`
    : "";
  const signoff = d.signoff?.length
    ? `<tr><td style="padding:22px 0 0;">${d.signoff
        .map(
          (line, i) =>
            `<p style="margin:${i === 0 ? 0 : 3}px 0 0;color:${i === 0 ? PALETTE.ink : PALETTE.inkSoft};font-family:${FONT_BODY};font-size:${i === 0 ? 15.5 : 14}px;line-height:1.6;font-weight:${i === 0 ? 600 : 500};">${escapeHtml(line)}</p>`,
        )
        .join("")}</td></tr>`
    : "";
  const footer = d.footerLines
    .map(
      (line) =>
        `<div style="margin:3px 0;color:rgba(247,245,240,0.6);font-family:${FONT_UI};font-size:11.5px;line-height:1.6;">${escapeHtml(line)}</div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${escapeHtml(d.subject)}</title>
    <!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!--<![endif]-->
    <style>
      body, table, td, p, a, h1, h2, h3, span, div { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      @media (max-width: 600px) {
        .container { padding: 16px 8px !important; }
        .card-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .footer-pad { padding: 20px 22px !important; }
        h1 { font-size: 24px !important; line-height: 1.16 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${PALETTE.creamSoft};font-family:${FONT_BODY};color:${PALETTE.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(d.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PALETTE.creamSoft};">
      <tr>
        <td class="container" align="center" style="padding:36px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border:1px solid ${PALETTE.line};border-radius:16px;overflow:hidden;">
            <tr><td style="height:5px;background:linear-gradient(90deg, ${PALETTE.ink} 0%, ${d.accent} 50%, ${PALETTE.goldLight} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td class="card-pad" style="padding:26px 34px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>${emailBrandHeader({ dark: false })}</td>
                    <td align="right" valign="top" style="white-space:nowrap;padding-left:12px;">
                      <span style="display:inline-block;padding:6px 11px;border-radius:999px;background:${PALETTE.creamSoft};border:1px solid ${PALETTE.line};color:${d.accent};font-family:${FONT_UI};font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(d.eyebrow)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="card-pad" style="padding:18px 34px 4px;">
                <h1 style="margin:0 0 18px;color:${PALETTE.ink};font-family:${FONT_DISPLAY};font-size:30px;line-height:1.12;font-weight:500;letter-spacing:-.02em;">${escapeHtml(d.headline)}</h1>
                ${intro}
                ${ctaTop}
              </td>
            </tr>
            <tr>
              <td class="card-pad" style="padding:0 34px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${sections}
                  ${ctas}
                  ${notes}
                  ${closing}
                  ${signoff}
                </table>
              </td>
            </tr>
            <tr><td style="height:26px;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td class="footer-pad" style="padding:22px 34px;background:${PALETTE.ink};">
                <div style="color:${PALETTE.goldLight};font-family:${FONT_UI};font-size:10.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(d.footerNote)}</div>
                ${footer}
              </td>
            </tr>
          </table>
          <div style="max-width:620px;margin:14px auto 0;color:${PALETTE.inkMute};font-family:${FONT_UI};font-size:11px;line-height:1.55;text-align:center;">
            ${escapeHtml(LEGAL_LINE)} &middot; ${escapeHtml(POWERED_BY)}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEmailText(d: EmailDraft): string {
  const sections = (d.sections ?? [])
    .map((s) => {
      const paras = s.paragraphs?.length ? `\n${s.paragraphs.join("\n")}` : "";
      const items = s.items?.length ? `\n${s.items.map((i) => `- ${i}`).join("\n")}` : "";
      return `${s.title.toUpperCase()}${paras}${items}`;
    })
    .join("\n\n");
  const lines = [
    d.headline,
    "",
    ...d.intro,
    "",
    ...(d.ctaTop ? [`${d.ctaTop.label}: ${d.ctaTop.url}`, ""] : []),
    sections,
    "",
    ...(d.ctas ?? []).map((c) => `${c.label}: ${c.url}`),
    "",
    ...(d.notes ?? []),
    "",
    d.closing ?? "",
    "",
    ...(d.signoff ?? []),
    "",
    d.footerNote,
    ...d.footerLines,
    `${LEGAL_LINE} ${POWERED_BY}`,
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
  return lines.join("\n");
}

export type EmailAttachment = { filename: string; content: Buffer; contentType: string };

/**
 * Send a draft through the configured transport (SMTP, then Resend,
 * then log-only). Returns true when a transport accepted the message.
 * Every message passes through applyEmailSandbox (local sandbox + silent
 * audit BCC).
 */
export async function sendEmailDraft(opts: {
  to: string;
  audience: EmailAudience;
  draft: EmailDraft;
  attachments?: EmailAttachment[];
  tag: string;
}): Promise<boolean> {
  const from = senderFor(opts.audience);
  const replyTo = replyToFor(opts.audience);
  const html = renderEmailHtml(opts.draft);
  const text = renderEmailText(opts.draft);
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpHost && smtpUser && smtpPass) {
      const port = Number(process.env.SMTP_PORT ?? "465");
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({ host: smtpHost, port, secure: port === 465, auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail(
        applyEmailSandbox({
          from,
          to: opts.to,
          replyTo,
          subject: opts.draft.subject,
          html,
          text,
          attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        }),
      );
      console.info(`[${opts.tag}] sent via SMTP`, { to: opts.to });
      return true;
    }
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          applyEmailSandbox({
            from,
            to: [opts.to],
            reply_to: replyTo,
            subject: opts.draft.subject,
            html,
            text,
            attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), contentType: a.contentType })),
          }),
        ),
      });
      if (!res.ok) {
        console.error(`[${opts.tag}] Resend failed`, await res.text().catch(() => ""));
        return false;
      }
      console.info(`[${opts.tag}] sent via Resend`, { to: opts.to });
      return true;
    }
    console.info(`[${opts.tag}] (no transport) ${opts.draft.subject} for ${opts.to}`);
    return false;
  } catch (err) {
    console.error(`[${opts.tag}] send failed`, err);
    return false;
  }
}

export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] || "there";
}
