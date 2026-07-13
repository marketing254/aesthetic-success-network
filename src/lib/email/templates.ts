import "server-only";
import { sendEmail } from "./send";

/**
 * Branded transactional emails for the launch phase, in the ASN visual
 * system (cream canvas, espresso band, gold accent). Email-safe font
 * stacks only — never the site's CSS variables.
 *
 * All senders here are fail-soft: they log errors and never throw, so a
 * mail outage can't block a signup.
 */

const SUPPORT_EMAIL = process.env.WAITLIST_SUPPORT_EMAIL ?? "marketing@ekwa.co";
const TEAM_LIST = (process.env.TEAM_DISTRIBUTION_LIST ?? SUPPORT_EMAIL)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const FONT_DISPLAY = "'Fraunces','Iowan Old Style',Baskerville,'Times New Roman',Georgia,serif";
const FONT_BODY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(headline: string, paragraphs: string[]): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#3d4653;">${p}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a1a1a;border-radius:16px 16px 0 0;padding:22px 32px;">
          <div style="font-family:${FONT_DISPLAY};font-size:20px;color:#f6f1e7;">Aesthetic Success Network</div>
          <div style="font-family:${FONT_BODY};font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#d9a84b;margin-top:5px;">Powered by Business of Aesthetics</div>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e5dfd2;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
          <h1 style="margin:0 0 16px;font-family:${FONT_DISPLAY};font-weight:500;font-size:24px;line-height:1.2;color:#0a1320;">${headline}</h1>
          ${body}
          <hr style="border:none;border-top:1px solid #e5dfd2;margin:22px 0;">
          <p style="margin:0;font-family:${FONT_BODY};font-size:12.5px;line-height:1.6;color:#8b8577;">
            Aesthetic Success Network &middot; Ekwa Marketing Inc. &middot; ${SUPPORT_EMAIL} &middot; (855) 567-5323
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function safeSend(kind: string, input: Parameters<typeof sendEmail>[0]) {
  try {
    await sendEmail(input);
  } catch (err) {
    console.error(`[email:${kind}] send failed:`, err);
  }
}

// ── Applicant confirmations ─────────────────────────────────────────

export async function sendWaitlistConfirmation(to: string, firstName: string) {
  const name = escapeHtml(firstName || "there");
  const paragraphs = [
    `Hi ${name},`,
    `You're on the founding waitlist for the Aesthetic Success Network. There's nothing to pay today. We'll reach out as founding spots open, and you confirm before any charge.`,
    `As a founding member you'd lock in <b>$49/mo for as long as your membership stays active</b> (the standard rate after the first 100 is $199/mo), with a 30-day money-back guarantee and the option to cancel anytime.`,
    `Questions in the meantime? Just reply to this email.`,
  ];
  await safeSend("waitlist-confirm", {
    to,
    subject: "You're on the founding waitlist | Aesthetic Success Network",
    html: shell("You're on the list.", paragraphs),
    text: [
      `Hi ${firstName || "there"},`,
      "",
      "You're on the founding waitlist for the Aesthetic Success Network. There's nothing to pay today. We'll reach out as founding spots open, and you confirm before any charge.",
      "",
      "As a founding member you'd lock in $49/mo for as long as your membership stays active (the standard rate after the first 100 is $199/mo), with a 30-day money-back guarantee and the option to cancel anytime.",
      "",
      `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
      "",
      "— Aesthetic Success Network · Powered by Business of Aesthetics",
    ].join("\n"),
    replyTo: SUPPORT_EMAIL,
  });
}

export async function sendExpertConfirmation(to: string, firstName: string) {
  const name = escapeHtml(firstName || "there");
  const paragraphs = [
    `Hi ${name},`,
    `Thanks for applying to become an expert on the Aesthetic Success Network. Our team reviews every application personally, for fit, and we'll be in touch soon.`,
    `A quick reminder of how it works: you share one recording, we produce your full content kit in your branding, and interested members book straight onto your calendar. Months 1–6 are free, then $49/mo, then $199/mo from month 13. Paid courses: you keep 70%.`,
  ];
  await safeSend("expert-confirm", {
    to,
    subject: "Application received | Aesthetic Success Network experts",
    html: shell("Application received.", paragraphs),
    text: [
      `Hi ${firstName || "there"},`,
      "",
      "Thanks for applying to become an expert on the Aesthetic Success Network. Our team reviews every application personally, for fit, and we'll be in touch soon.",
      "",
      "How it works: you share one recording, we produce your full content kit in your branding, and interested members book straight onto your calendar. Months 1-6 are free, then $49/mo, then $199/mo from month 13. Paid courses: you keep 70%.",
      "",
      `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
      "",
      "— Aesthetic Success Network · Powered by Business of Aesthetics",
    ].join("\n"),
    replyTo: SUPPORT_EMAIL,
  });
}

export async function sendPartnerConfirmation(to: string, contactName: string) {
  const name = escapeHtml(contactName.split(" ")[0] || "there");
  const paragraphs = [
    `Hi ${name},`,
    `Thanks for applying to become a founding partner of the Aesthetic Success Network. We vet and list partners per category, so spots are limited. Our team reviews every application personally and we'll be in touch soon.`,
    `A quick reminder of the terms: months 1–6 are free, then $49/mo (locked launch rate), then $199/mo from month 13. Founding partners get priority placement in their category.`,
  ];
  await safeSend("partner-confirm", {
    to,
    subject: "Partner application received | Aesthetic Success Network",
    html: shell("Application received.", paragraphs),
    text: [
      `Hi ${contactName.split(" ")[0] || "there"},`,
      "",
      "Thanks for applying to become a founding partner of the Aesthetic Success Network. We vet and list partners per category, so spots are limited. Our team reviews every application personally and we'll be in touch soon.",
      "",
      "Terms reminder: months 1-6 are free, then $49/mo (locked launch rate), then $199/mo from month 13. Founding partners get priority placement in their category.",
      "",
      `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
      "",
      "— Aesthetic Success Network · Powered by Business of Aesthetics",
    ].join("\n"),
    replyTo: SUPPORT_EMAIL,
  });
}

// ── Team notification ───────────────────────────────────────────────

export async function notifyTeam(subject: string, lines: [string, string][]) {
  const rows = lines
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;font-family:${FONT_BODY};font-size:13px;color:#8b8577;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;font-family:${FONT_BODY};font-size:13px;color:#0a1320;">${escapeHtml(v || "—")}</td></tr>`,
    )
    .join("");
  const html = shell(subject, [
    `<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`,
    `Review it in the <a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "https://aestheticsuccessnetwork.com") + "/admin"}" style="color:#a87d2c;">admin console</a>.`,
  ]);
  const text = [subject, "", ...lines.map(([k, v]) => `${k}: ${v || "—"}`)].join("\n");
  for (const to of TEAM_LIST) {
    await safeSend("team-notify", { to, subject: `[ASN] ${subject}`, html, text });
  }
}
