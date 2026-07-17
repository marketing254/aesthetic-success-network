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

const SUPPORT_EMAIL =
  process.env.WAITLIST_SUPPORT_EMAIL ?? "support@aestheticsuccessnetwork.com";
const TEAM_LIST = (process.env.TEAM_DISTRIBUTION_LIST ?? SUPPORT_EMAIL)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// Per-purpose senders on the ASN domain. One Rackspace mailbox (support@)
// authenticates the SMTP session; Rackspace permits same-domain send-as,
// so each audience sees the inbox that matches their relationship.
const BRAND = "Aesthetic Success Network";
const FROM_MEMBERS =
  process.env.EMAIL_FROM_MEMBERS ?? `${BRAND} <members@aestheticsuccessnetwork.com>`;
const FROM_EXPERTS =
  process.env.EMAIL_FROM_EXPERTS ?? `${BRAND} <experts@aestheticsuccessnetwork.com>`;
const FROM_PARTNERS =
  process.env.EMAIL_FROM_PARTNERS ?? `${BRAND} <partners@aestheticsuccessnetwork.com>`;
const FROM_SUPPORT =
  process.env.EMAIL_FROM_SUPPORT ?? `${BRAND} <support@aestheticsuccessnetwork.com>`;
const REPLY_MEMBERS = "members@aestheticsuccessnetwork.com";
const REPLY_EXPERTS = "experts@aestheticsuccessnetwork.com";
const REPLY_PARTNERS = "partners@aestheticsuccessnetwork.com";

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

// ── Rich branded journey template (DMN reference shell) ────────────
// Preheader + eyebrow chip + Fraunces headline + bullet sections with a
// gold accent dot + pill CTA + signoff + reference footer. Table-based,
// fully inline-styled so it renders in Outlook/Apple Mail/Gmail.

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
const ACCENT = "#d9a84b";
const ACCENT_DEEP = "#a87d2c";

type BrandedSection = { title: string; paragraphs?: string[]; bullets?: string[] };

type BrandedEmail = {
  subject: string;
  preview: string;
  eyebrow: string;
  headline: string;
  intro: string[];
  sections: BrandedSection[];
  cta?: { label: string; url: string };
  closing: string;
  signoff: string[];
  footerLines: string[];
};

function renderBranded(e: BrandedEmail): { html: string; text: string } {
  const p = (t: string, extra = "") =>
    `<p style="margin:0 0 14px;font-family:${FONT_BODY};font-size:15px;line-height:1.7;color:#3d4653;${extra}">${t}</p>`;

  const sectionsHtml = e.sections
    .map((s) => {
      const bullets = (s.bullets ?? [])
        .map(
          (b) =>
            `<tr><td style="width:18px;vertical-align:top;padding:5px 0;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ACCENT};"></span></td><td style="padding:3px 0;font-family:${FONT_BODY};font-size:14.5px;line-height:1.65;color:#3d4653;">${b}</td></tr>`,
        )
        .join("");
      return `
        <h2 style="margin:26px 0 10px;font-family:${FONT_DISPLAY};font-weight:500;font-size:17px;color:#0a1320;">${s.title}</h2>
        ${(s.paragraphs ?? []).map((t) => p(t)).join("")}
        ${bullets ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${bullets}</table>` : ""}`;
    })
    .join("");

  const ctaHtml = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:26px 0 8px;">
         <a href="${e.cta.url}" style="display:inline-block;background:${ACCENT};color:#0a1320;font-family:${FONT_BODY};font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;padding:14px 34px;">${escapeHtml(e.cta.label)}</a>
       </td></tr></table>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f0;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(e.preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
        <tr><td style="height:4px;background:linear-gradient(90deg,${ACCENT_DEEP},${ACCENT},${ACCENT_DEEP});border-radius:16px 16px 0 0;"></td></tr>
        <tr><td style="background:#1a1a1a;padding:24px 34px;">
          <div style="font-family:${FONT_DISPLAY};font-size:21px;color:#f6f1e7;">Aesthetic Success Network</div>
          <div style="font-family:${FONT_BODY};font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${ACCENT};margin-top:5px;">Powered by Business of Aesthetics</div>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e5dfd2;border-top:none;padding:34px;">
          <div style="display:inline-block;background:rgba(217,168,75,0.12);border:1px solid rgba(217,168,75,0.4);border-radius:999px;padding:5px 14px;font-family:${FONT_BODY};font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ACCENT_DEEP};margin-bottom:16px;">${escapeHtml(e.eyebrow)}</div>
          <h1 style="margin:0 0 18px;font-family:${FONT_DISPLAY};font-weight:500;font-size:27px;line-height:1.2;color:#0a1320;">${escapeHtml(e.headline)}</h1>
          ${e.intro.map((t) => p(t)).join("")}
          ${sectionsHtml}
          ${ctaHtml}
          <hr style="border:none;border-top:1px solid #e5dfd2;margin:26px 0 18px;">
          ${p(e.closing)}
          ${e.signoff
            .map(
              (l, i) =>
                `<p style="margin:0 0 2px;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${i === 0 ? "#0a1320" : "#5c6673"};font-weight:${i === 0 ? 600 : 400};">${escapeHtml(l)}</p>`,
            )
            .join("")}
        </td></tr>
        <tr><td style="background:#121212;border-radius:0 0 16px 16px;padding:20px 34px;">
          ${e.footerLines
            .map(
              (l) =>
                `<p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:11.5px;line-height:1.6;color:#8b8577;">${l}</p>`,
            )
            .join("")}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const strip = (t: string) => t.replace(/<[^>]+>/g, "");
  const text = [
    e.headline,
    "",
    ...e.intro.map(strip),
    ...e.sections.flatMap((s) => [
      "",
      s.title.toUpperCase(),
      ...(s.paragraphs ?? []).map(strip),
      ...(s.bullets ?? []).map((b) => `  • ${strip(b)}`),
    ]),
    ...(e.cta ? ["", `${e.cta.label}  ${e.cta.url}`] : []),
    "",
    e.closing,
    "",
    ...e.signoff,
    "",
    ...e.footerLines.map((l) => l.replace(/<[^>]+>/g, "")),
  ].join("\n");

  return { html, text };
}

// ── Applicant confirmations ─────────────────────────────────────────

/**
 * Waitlist-join email — the member's first touch (DMN memberDraft shape,
 * launch-phase copy: no portal claims, no charge until they confirm).
 */
export async function sendWaitlistConfirmation(
  to: string,
  firstName: string,
  referenceId?: string,
  submittedAt?: string,
) {
  const name = escapeHtml(firstName || "there");
  const submitted = submittedAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
        new Date(submittedAt),
      )
    : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
        new Date(),
      );

  const { html, text } = renderBranded({
    subject: "Your founding spot is reserved | Aesthetic Success Network",
    preview:
      "You're on the founding waitlist. $49/month founding rate, locked while active. Nothing to pay today.",
    eyebrow: "Founding Waitlist",
    headline: "You're on the list.",
    intro: [
      `Hi ${name},`,
      `Welcome to the Aesthetic Success Network. Your spot on the founding waitlist is reserved, and there is <b>nothing to pay today</b>. As founding spots open we'll reach out personally, and you confirm before any charge.`,
    ],
    sections: [
      {
        title: "What you get as a founding member",
        bullets: [
          `<b>The Expert Hotline.</b> Call our toll-free line, leave a voicemail, and get a written action plan by text and email within 2 to 3 business days, routed to the right experts by fit.`,
          `<b>A growing resource library.</b> Training videos, action guides, checklists and worksheets, with new expert kits added weekly.`,
          `<b>Member-only partner deals.</b> Exclusive pricing from vetted vendors across devices, injectables, skincare, software and services.`,
          `<b>Live AMAs and CE.</b> Monthly live sessions with the field's best experts, plus continuing-education opportunities.`,
        ],
      },
      {
        title: "A few things to know",
        bullets: [
          `Your founding rate is <b>$49/month</b> (or $490/year, two months free), locked for as long as your membership stays active. After the first 100 members, the standard rate is $199/month.`,
          `Every membership comes with a 30-day money-back guarantee, and you can cancel anytime.`,
          `We'll email you before the doors open with everything you need. No payment happens until you confirm.`,
        ],
      },
    ],
    cta: { label: "Visit the network", url: SITE_URL },
    closing:
      "Questions in the meantime? Reply to this email. We read and respond to every message.",
    signoff: ["Welcome aboard.", "The Aesthetic Success Network Team", "Powered by Business of Aesthetics"],
    footerLines: [
      `This is an automated confirmation of your waitlist signup on ${submitted}. Please don't reply to report a problem with someone else's signup — if this wasn't you, just ignore it.`,
      referenceId ? `Reference: ${referenceId}` : "",
      `Aesthetic Success Network · ${SUPPORT_EMAIL} · aestheticsuccessnetwork.com`,
    ].filter(Boolean),
  });

  await safeSend("waitlist-confirm", {
    to,
    subject: "Your founding spot is reserved | Aesthetic Success Network",
    html,
    text,
    from: FROM_MEMBERS,
    replyTo: REPLY_MEMBERS,
  });
}

/**
 * Member activation welcome — sent when the team activates a member from
 * the admin console (waitlist promotion or manual add). Launch-phase copy:
 * confirms the locked rate, promises the personal follow-up, claims no
 * portal access or billing (those arrive with the Agree-and-Pay phase).
 */
export async function sendMemberWelcomeEmail(to: string, firstName: string) {
  const name = escapeHtml(firstName || "there");
  const { html, text } = renderBranded({
    subject: "Your founding spot is confirmed | Aesthetic Success Network",
    preview:
      "Your founding membership is confirmed at the locked $49/month rate. Here's what happens next.",
    eyebrow: "Founding Member · Confirmed",
    headline: `Welcome, ${firstName || "there"}.`,
    intro: [
      `Hi ${name},`,
      `Your founding spot on the Aesthetic Success Network is confirmed. Your <b>$49/month founding rate is locked in</b> and never increases for as long as your membership stays active.`,
    ],
    sections: [
      {
        title: "What happens next",
        bullets: [
          `Our team will reach out to you personally with your membership setup and payment details. Exactly as promised, <b>you confirm before any charge</b>.`,
          `The member portal opens with the network: the Expert Hotline (written action plans in 2 to 3 business days), the full resource library with new kits weekly, member-only partner deals, and monthly live AMAs and CE.`,
        ],
      },
      {
        title: "A few things to know",
        bullets: [
          `Your founding status is permanent: as the network grows, you keep every new feature at the same $49/month (or $490/year) rate for as long as your membership stays active.`,
          `Every membership comes with a 30-day money-back guarantee, and you can cancel anytime.`,
        ],
      },
    ],
    cta: { label: "Visit the network", url: SITE_URL },
    closing:
      "Questions? Reply to this email. Our team reads and responds to every message.",
    signoff: ["Welcome aboard.", "The Aesthetic Success Network Team", "Powered by Business of Aesthetics"],
    footerLines: [
      `You're receiving this because our team confirmed your founding membership on the Aesthetic Success Network.`,
      `Aesthetic Success Network · ${SUPPORT_EMAIL} · aestheticsuccessnetwork.com`,
    ],
  });

  await safeSend("member-welcome", {
    to,
    subject: "Your founding spot is confirmed | Aesthetic Success Network",
    html,
    text,
    from: FROM_MEMBERS,
    replyTo: REPLY_MEMBERS,
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
    from: FROM_EXPERTS,
    replyTo: REPLY_EXPERTS,
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
    from: FROM_PARTNERS,
    replyTo: REPLY_PARTNERS,
  });
}

// ── Approval emails (sent on first admin approval) ─────────────────

export async function sendExpertApprovalEmail(to: string, firstName: string) {
  const name = escapeHtml(firstName || "there");
  const { html, text } = renderBranded({
    subject: "You're approved | Aesthetic Success Network experts",
    preview:
      "Your expert application is approved. Our team will reach out to schedule your onboarding.",
    eyebrow: "Expert Application · Approved",
    headline: `Welcome to the bench, ${firstName || "there"}.`,
    intro: [
      `Hi ${name},`,
      `Great news: your application to join the Aesthetic Success Network as a <b>founding expert</b> is approved. We review every expert personally, and you're exactly the kind of fit the network was built around.`,
    ],
    sections: [
      {
        title: "What happens next",
        bullets: [
          `Our team will reach out to you personally to schedule your onboarding conversation and walk you through everything.`,
          `You share <b>one recording</b> of you teaching your topic. We produce your full content kit (training video, action guide, checklist, worksheet, slide deck) in your branding, and you approve it before anything goes live.`,
          `Every resource carries a book-a-meeting button, so interested members reach out to you directly.`,
        ],
      },
      {
        title: "Your founding terms",
        bullets: [
          `Months 1 to 6 are <b>free</b>, then $49/month (locked launch rate) for months 7 to 12, then $199/month from month 13.`,
          `Paid courses: you keep <b>70%</b> of net course revenue; the network retains 30%.`,
          `Expert Hotline referrals are routed by fit, never pay-to-play.`,
        ],
      },
    ],
    cta: { label: "Visit the network", url: SITE_URL },
    closing:
      "Questions before we talk? Reply to this email and our team will get back to you within one business day.",
    signoff: ["Welcome aboard.", "The Aesthetic Success Network Team", "Powered by Business of Aesthetics"],
    footerLines: [
      `You're receiving this because our team approved your expert application on the Aesthetic Success Network.`,
      `Aesthetic Success Network · ${REPLY_EXPERTS} · aestheticsuccessnetwork.com`,
    ],
  });

  await safeSend("expert-approved", {
    to,
    subject: "You're approved | Aesthetic Success Network experts",
    html,
    text,
    from: FROM_EXPERTS,
    replyTo: REPLY_EXPERTS,
  });
}

export async function sendPartnerApprovalEmail(
  to: string,
  contactName: string,
  companyName: string,
) {
  const first = escapeHtml(contactName.split(" ")[0] || "there");
  const company = escapeHtml(companyName || "your company");
  const { html, text } = renderBranded({
    subject: "You're approved | Aesthetic Success Network partners",
    preview: `${companyName} is approved as a founding partner. Our team will reach out to finalize your listing.`,
    eyebrow: "Partner Application · Approved",
    headline: `You're in, ${contactName.split(" ")[0] || "there"}.`,
    intro: [
      `Hi ${first},`,
      `Great news: <b>${company}</b> is approved as a <b>founding partner</b> of the Aesthetic Success Network. We vet and list partners per category, and you've earned one of the limited founding spots.`,
    ],
    sections: [
      {
        title: "What happens next",
        bullets: [
          `Our team will reach out to you personally to finalize your listing: your logo, the exact wording of your member deal, and your booking link.`,
          `As a founding partner you get <b>priority placement</b> in your category, and the Verified Partner badge goes live with your listing when the network opens.`,
          `Member leads route directly to you, and you'll see the channel working through your dashboard as the platform rolls out.`,
        ],
      },
      {
        title: "Your founding terms",
        bullets: [
          `Months 1 to 6 are <b>free</b>, then $49/month (locked launch rate) for months 7 to 12, then $199/month from month 13.`,
          `The five partner commitments apply: your best deal for members, one-business-day responses to leads, a working booking link, 30 days' notice on offer changes, and the fee after your free period.`,
        ],
      },
    ],
    cta: { label: "Visit the network", url: SITE_URL },
    closing:
      "Questions before we talk? Reply to this email and our partnerships team will get back to you within one business day.",
    signoff: ["Welcome aboard.", "The Aesthetic Success Network Team", "Powered by Business of Aesthetics"],
    footerLines: [
      `You're receiving this because our team approved ${company}'s partner application on the Aesthetic Success Network.`,
      `Aesthetic Success Network · ${REPLY_PARTNERS} · aestheticsuccessnetwork.com`,
    ],
  });

  await safeSend("partner-approved", {
    to,
    subject: "You're approved | Aesthetic Success Network partners",
    html,
    text,
    from: FROM_PARTNERS,
    replyTo: REPLY_PARTNERS,
  });
}

// ── Admin sign-in code ──────────────────────────────────────────────
// Sent by /api/admin/login through OUR transport (not Supabase's SMTP),
// so admin sign-in never depends on the Supabase dashboard email config.
// NOT fail-soft on purpose: the login route must know if delivery failed.

export async function sendAdminCodeEmail(to: string, code: string) {
  const safeCode = code.replace(/[^0-9]/g, "");
  const paragraphs = [
    `Enter this code on the admin sign-in page to access the console. It expires shortly and can only be used once.`,
    `<div style="text-align:center;padding:6px 0 10px;"><span style="display:inline-block;background:#f7f5f0;border:1px solid #d9a84b;border-radius:14px;padding:16px 30px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0a1320;">${safeCode}</span></div>`,
    `If you didn't try to sign in to the Aesthetic Success Network admin console, you can ignore this email. The code is useless without access to this inbox.`,
  ];
  await sendEmail({
    to,
    subject: `Your Aesthetic Success Network sign-in code: ${safeCode}`,
    html: shell("Your admin sign-in code", paragraphs),
    text: [
      "Your Aesthetic Success Network admin sign-in code:",
      "",
      `    ${safeCode}`,
      "",
      "Enter it on the admin sign-in page. It expires shortly and can only be used once.",
      "If you didn't try to sign in, you can ignore this email.",
    ].join("\n"),
    from: FROM_SUPPORT,
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
    await safeSend("team-notify", { to, subject: `[ASN] ${subject}`, html, text, from: FROM_SUPPORT });
  }
}
