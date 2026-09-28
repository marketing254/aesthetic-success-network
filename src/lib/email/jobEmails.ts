import "server-only";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox, auditBccList, isEmailSandbox, queueAlertList } from "@/lib/email/sandbox";

/**
 * The emails the job board sends.
 *
 *   1. team      — "a job is waiting in the queue" → EMAIL_QUEUE_ALERT_TO
 *   2. member    — approved: "Your {Role} post is live" (approved draft)
 *   3. member    — rejected, ALWAYS with the reason. Never reject silently.
 *   4. member    — day 25, "renew in one click" before the day-30 expiry
 *   5. practice  — a new application, CV attached, reply-to set to the
 *                  applicant so hitting Reply reaches the candidate
 *                  (approved draft)
 *   6. applicant — their own copy, only if they asked (approved draft)
 *
 * Bodies 2, 5 and 6 follow the approved DMN job-board drafts, swapped to
 * the ASN brand: ASN logo header, first-name greeting, short paragraphs,
 * one gold button per action, Lester's sign-off and the standard footer.
 * 3 and 4 follow the same format.
 *
 * Every sender returns a boolean and never throws. An email failure must
 * not roll back an approval that already happened in the database —
 * the post being live is the thing that matters, the email is a courtesy.
 */

const FROM = "Aesthetic Success Network <jobs@aestheticsuccessnetwork.com>";
const REPLY_TO = "support@aestheticsuccessnetwork.com";
const SUPPORT_EMAIL = "support@aestheticsuccessnetwork.com";

/**
 * Who gets the "job pending review" alert in production: EMAIL_QUEUE_ALERT_TO
 * (comma list, single default inbox). Deliberately NOT the whole team
 * distribution list: the queue is one person's job. No CC.
 */
function queueAlertTo(): string {
  return queueAlertList().join(", ");
}

/**
 * Every OTHER job-board email (to a member, a practice or an applicant)
 * carries EMAIL_AUDIT_BCC on BCC, so the team sees exactly what went out
 * without the recipient seeing them. Same rule as the rest of the
 * member-facing mail.
 */
function auditBcc(): string[] {
  return auditBccList();
}

/**
 * PRODUCTION IS THE DEFAULT: real recipients, clean subjects, audit BCC as
 * documented above. Nothing has to be set in Vercel.
 *
 * TESTING SANDBOX: the shared helper in src/lib/email/sandbox.ts
 * (EMAIL_SANDBOX=true, or any non-production NODE_ENV; JOB_EMAILS_SANDBOX
 * is a legacy alias). Then EVERY job-board email — member approvals and
 * rejections, renewal reminders, applications to practices, applicant
 * copies AND the team queue alert — is redirected to EMAIL_SANDBOX_TO
 * with the real recipient named in a "[TEST …]" subject, and no CC/BCC.
 */

/**
 * APPROVAL PREVIEW — scripts only, never the app. When set, every send
 * skips the sandbox and goes to these recipients with a "[FOR APPROVAL]"
 * subject, so the team can review the real rendered emails. Refuses to
 * arm in production so it can never redirect a live send.
 */
let approvalPreview: { to: string; cc: string[]; prefix: string } | null = null;
export function setApprovalPreview(opts: { to: string; cc?: string[]; prefix?: string } | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("setApprovalPreview is for local scripts only");
  }
  approvalPreview = opts ? { to: opts.to, cc: opts.cc ?? [], prefix: opts.prefix ?? "[FOR APPROVAL]" } : null;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
}

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  /**
   * Overrides the support@ reply-to. Used by the application email so
   * the practice can just hit Reply and land in the candidate's inbox —
   * without it, every reply comes to us and we become an unwilling
   * relay between two people who want to talk to each other.
   */
  replyTo?: string;
  bcc?: string[];
  cc?: string[];
  attachments?: MailAttachment[];
}): Promise<boolean> {
  let previewArmed = false;
  if (approvalPreview) {
    const copies = [...(opts.cc?.length ? [`cc ${opts.cc.join(", ")}`] : []), ...(opts.bcc?.length ? [`bcc ${opts.bcc.join(", ")}`] : [])];
    const label = copies.length ? `${opts.to} (${copies.join("; ")})` : opts.to;
    opts = {
      ...opts,
      to: approvalPreview.to,
      cc: approvalPreview.cc,
      bcc: undefined,
      subject: `${approvalPreview.prefix} ${opts.subject}  ·  live recipient: ${label}`,
    };
    previewArmed = true;
    if (isEmailSandbox()) {
      console.info(`[jobs:${opts.tag}] approval preview armed; the reviewer address bypasses the sandbox redirect`);
    }
  }
  // The approval preview already re-addresses to an explicit local
  // reviewer (never in production); every other send goes through the
  // shared sandbox right before the transport.
  const guard = <T extends { to?: unknown; cc?: unknown; bcc?: unknown; subject?: string }>(m: T): T =>
    previewArmed ? m : applyEmailSandbox(m);
  try {
    // Transactional mail goes out through the aestheticsuccessnetwork.com
    // mailbox (SMTP_TX_*), which matches the jobs@ sender's domain so
    // send-as, SPF and DKIM line up. SMTP_* (the marketing mailbox) is
    // only a fallback for local runs without SMTP_TX_*.
    const tx = Boolean(process.env.SMTP_TX_HOST && process.env.SMTP_TX_USER && process.env.SMTP_TX_PASS);
    const smtpHost = tx ? process.env.SMTP_TX_HOST : process.env.SMTP_HOST;
    const smtpUser = tx ? process.env.SMTP_TX_USER : process.env.SMTP_USER;
    const smtpPass = tx ? process.env.SMTP_TX_PASS : process.env.SMTP_PASS;
    if (smtpHost && smtpUser && smtpPass) {
      const port = Number((tx ? process.env.SMTP_TX_PORT : process.env.SMTP_PORT) ?? "465");
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail(
        guard({
          from: FROM,
          to: opts.to,
          cc: opts.cc,
          bcc: opts.bcc,
          replyTo: opts.replyTo ?? REPLY_TO,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          attachments: opts.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        }),
      );
      console.info(`[jobs:${opts.tag}] sent via SMTP`, { to: opts.to });
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
          guard({
            from: FROM,
            to: [opts.to],
            cc: opts.cc,
            bcc: opts.bcc,
            reply_to: opts.replyTo ?? REPLY_TO,
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
            // Resend takes attachment content as base64.
            attachments: opts.attachments?.map((a) => ({
              filename: a.filename,
              content: a.content.toString("base64"),
              content_type: a.contentType,
            })),
          }),
        ),
      });
      if (!res.ok) {
        console.error(`[jobs:${opts.tag}] Resend failed`, await res.text().catch(() => ""));
        return false;
      }
      console.info(`[jobs:${opts.tag}] sent via Resend`, { to: opts.to });
      return true;
    }

    console.info(`[jobs:${opts.tag}] (no transport) email to ${opts.to} skipped`);
    return false;
  } catch (err) {
    console.error(`[jobs:${opts.tag}] send failed`, err);
    return false;
  }
}

// =====================================================================
// Branded layout — the standard ASN member-email format.
// Table-based, inline styles only, so it renders in Outlook, Gmail and
// Apple Mail alike. Every value interpolated into it goes through esc().
// =====================================================================

const BRAND = {
  ink: "#0A1A2F",
  inkSoft: "#3B4A55",
  inkMute: "#5C6770",
  cream: "#F7F5F0",
  line: "#E6DDCF",
  gold: "#A07823",
  goldSoft: "#FBF3E0",
  navy: "#0E2A3D",
};
const FONT = "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif";

/** Escaping for values interpolated into the HTML bodies (shared helper). */
const esc = escapeHtml;

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

/**
 * How a poster is addressed. Many practice owners posting on the board
 * are physicians, and the standing rule is to use the title until they
 * sign off otherwise: a name that begins with "Dr" is greeted as
 * "Dr. <last name>"; anyone else by first name.
 *
 *   ("Dr. Sarah", "Mitchell")   -> "Dr. Mitchell"
 *   ("Dr Sarah Mitchell", null) -> "Dr. Mitchell"
 *   ("Sarah", "Mitchell")       -> "Sarah"
 */
export function posterGreeting(firstName: string | null | undefined, lastName?: string | null): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const parts = first.split(/\s+/).filter(Boolean);
  if (/^dr\.?$/i.test(parts[0] ?? "")) {
    const surname = last || parts[parts.length - 1];
    if (surname && !/^dr\.?$/i.test(surname)) return `Dr. ${surname.replace(/[.,]+$/, "")}`;
  }
  return parts[0] || "there";
}

/** "Nurse injector (RN/NP)" -> "nurse injector (RN/NP)" for running text; labels keep the capital. */
function lc(roleLabel: string): string {
  return roleLabel ? roleLabel.charAt(0).toLowerCase() + roleLabel.slice(1) : roleLabel;
}

function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

/** A body paragraph. Pass pre-escaped HTML when `raw` is true. */
function p(text: string, raw = false): string {
  return `<p style="margin:0 0 16px;color:${BRAND.inkSoft};font-family:${FONT};font-size:15px;line-height:1.7;">${raw ? text : esc(text)}</p>`;
}

/** A small bold sub-heading between paragraph groups. */
function h(text: string): string {
  return `<p style="margin:22px 0 6px;color:${BRAND.ink};font-family:${FONT};font-size:15px;line-height:1.4;font-weight:700;">${esc(text)}</p>`;
}

/** Label / value rows, e.g. the applicant's details. */
function kv(rows: { label: string; value: string }[]): string {
  const body = rows
    .map(
      (r) => `<tr>
  <td valign="top" style="padding:6px 14px 6px 0;color:${BRAND.inkMute};font-family:${FONT};font-size:14px;line-height:1.5;white-space:nowrap;">${esc(r.label)}</td>
  <td valign="top" style="padding:6px 0;color:${BRAND.ink};font-family:${FONT};font-size:14px;line-height:1.5;font-weight:600;">${esc(r.value)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">${body}</table>`;
}

/** A quoted message from a person, kept visually separate from our copy. */
function quote(label: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;border-collapse:collapse;">
<tr><td style="padding:12px 16px;background:${BRAND.cream};border-left:3px solid ${BRAND.gold};border-radius:0 6px 6px 0;">
  <p style="margin:0 0 4px;color:${BRAND.inkMute};font-family:${FONT};font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;">${esc(label)}</p>
  <p style="margin:0;color:${BRAND.ink};font-family:${FONT};font-size:14.5px;line-height:1.65;white-space:pre-wrap;">${esc(text)}</p>
</td></tr></table>`;
}

/** The one gold button per action. */
function cta(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">
<tr><td bgcolor="${BRAND.gold}" style="border-radius:8px;background:${BRAND.gold};">
  <a href="${esc(url)}" style="display:inline-block;padding:13px 22px;color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${esc(label)} &nbsp;&rarr;</a>
</td></tr></table>`;
}

const SIGNOFF_LINES = ["Warmly,", "Lester De Alwis", "Co-Founder", "Aesthetic Success Network", "Powered by Business of Aesthetics"];

function signoff(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
<tr><td style="font-family:${FONT};line-height:1.55;">
  <p style="margin:0 0 10px;color:${BRAND.inkSoft};font-size:15px;">Warmly,</p>
  <p style="margin:0;color:${BRAND.ink};font-size:15px;font-weight:700;">Lester De Alwis</p>
  <p style="margin:0;color:${BRAND.inkSoft};font-size:14px;">Co-Founder</p>
  <p style="margin:0;color:${BRAND.inkSoft};font-size:14px;">Aesthetic Success Network</p>
  <p style="margin:0;color:${BRAND.inkMute};font-size:13px;">Powered by Business of Aesthetics</p>
</td></tr></table>`;
}

function layout(opts: {
  preview: string;
  greeting: string;
  body: string;
  /** Lester's sign-off for member/applicant mail; false for internal alerts. */
  signed: boolean;
  footer: string;
}): string {
  const logo = `${siteUrl()}/asn-logo-email.png`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aesthetic Success Network</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preview)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.cream};">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#FFFFFF;border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;">
    <tr><td style="height:5px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:22px 32px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="padding-right:12px;"><img src="${esc(logo)}" width="120" height="120" alt="ASN" style="display:block;width:44px;height:44px;border:0;border-radius:8px;"></td>
        <td valign="middle" style="font-family:${FONT};">
          <div style="color:${BRAND.ink};font-size:15px;font-weight:700;letter-spacing:.02em;">Aesthetic Success Network</div>
          <div style="color:${BRAND.gold};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-top:2px;">Job board</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 32px 6px;">
      <p style="margin:0 0 16px;color:${BRAND.ink};font-family:${FONT};font-size:16px;line-height:1.6;font-weight:600;">${esc(opts.greeting)}</p>
      ${opts.body}
      ${opts.signed ? signoff() : ""}
    </td></tr>
    <tr><td style="padding:22px 32px 26px;">
      <div style="height:1px;background:${BRAND.line};margin-bottom:14px;"></div>
      <p style="margin:0;color:${BRAND.inkMute};font-family:${FONT};font-size:12px;line-height:1.6;">${opts.footer}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function footerFor(reason: string): string {
  return `Aesthetic Success Network &middot; Powered by Business of Aesthetics &middot; ${esc(reason)} Questions: <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.navy};">${SUPPORT_EMAIL}</a>`;
}

function textSignoff(): string {
  return `\n${SIGNOFF_LINES.join("\n")}`;
}

// =====================================================================
// 1. Team — a post is waiting in the review queue
// =====================================================================

export async function notifyTeamNewJob(input: {
  jobId: string;
  practiceName: string;
  roleLabel: string;
  location: string;
  memberEmail: string;
  memberName?: string | null;
  employmentLabel?: string | null;
  payLine?: string | null;
  postFormat?: "detailed" | "banner" | null;
  /** True when a live post was edited and has come back for review. */
  resubmitted?: boolean;
}): Promise<boolean> {
  const queueUrl = `${siteUrl()}/admin/jobs`;
  const subject = `${input.resubmitted ? "Job edited, back for review" : "Job pending review"}: ${input.roleLabel} at ${input.practiceName}, ${input.location}`;
  const submittedAt = new Date().toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const rows = [
    { label: "Practice", value: input.practiceName },
    { label: "Role", value: input.roleLabel },
    { label: "Location", value: input.location },
    ...(input.employmentLabel ? [{ label: "Employment", value: input.employmentLabel }] : []),
    ...(input.payLine ? [{ label: "Pay", value: input.payLine }] : []),
    { label: "Format", value: input.postFormat === "banner" ? "Banner (uploaded graphic)" : "Written post" },
    { label: "Posted by", value: input.memberName ? `${input.memberName} · ${input.memberEmail}` : input.memberEmail },
    { label: "Submitted", value: submittedAt },
  ];

  const intro = input.resubmitted
    ? `A member has edited a live post on the ASN job board. It is off the board until it is approved again.`
    : `A member has submitted a new job post on the ASN job board. It stays private until it is approved.`;

  const html = layout({
    preview: `${input.roleLabel} at ${input.practiceName} is waiting for approval.`,
    greeting: "Hi there,",
    body:
      p(intro) +
      kv(rows) +
      cta("Review in the admin queue", queueUrl) +
      p(
        "Approve and publish, edit it first if something small needs fixing, or reject it with a reason the member will receive by email. Once it is live, the page is public and marked up for Google's job listings.",
      ),
    signed: false,
    footer: `Automated queue alert from the ASN job board. Recipients are set by EMAIL_QUEUE_ALERT_TO.`,
  });

  const text = [
    "Hi there,",
    "",
    intro,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    "",
    `Review in the admin queue: ${queueUrl}`,
    "",
    "Approve and publish, edit it first if something small needs fixing, or reject it with a reason the member will receive by email.",
  ].join("\n");

  return send({ to: queueAlertTo(), subject, html, text, tag: "job-submitted" });
}

// =====================================================================
// 2. Member — approved (approved draft 3: "your post is live")
// =====================================================================

export async function sendJobApproved(input: {
  to: string;
  firstName: string;
  lastName?: string | null;
  roleLabel: string;
  practiceName: string;
  slug: string;
  location: string;
  expiresAt: string | null;
  applyEmail?: string | null;
  applyUrl?: string | null;
}): Promise<boolean> {
  const postUrl = `${siteUrl()}/jobs/${input.slug}`;
  const dashboardUrl = `${siteUrl()}/dashboard/jobs`;
  const expiry = longDate(input.expiresAt);
  const externalOnly = !input.applyEmail && !!input.applyUrl;
  const name = posterGreeting(input.firstName, input.lastName);
  const role = lc(input.roleLabel);
  const nowPara = `Your post is on a public page built to be found. It is written so Google can read it as a job listing, which means it can show up when somebody searches for a ${role} role in ${input.location}, not only when they come looking for our board.`;

  const applicationsPara = externalOnly
    ? "Applicants are sent to the application link you provided, so you will see them there rather than here."
    : `Each application is emailed to you at ${input.applyEmail ?? "your application email"} with the candidate's CV attached, and every applicant is listed on your dashboard, where you can review, download CVs and mark candidates as shortlisted, not selected or hired. Candidates can see the status you set.`;

  const html = layout({
    preview: "It is public now, on a page built to be found on Google.",
    greeting: `Hi ${name},`,
    body:
      p(`Your ${role} post for ${input.practiceName} has been approved and is now live on the Aesthetic Success Network job board.`) +
      cta("View your post", postUrl) +
      h("What happens now") +
      p(nowPara) +
      h("When someone applies") +
      p(applicationsPara) +
      (expiry
        ? h("How long it runs") +
          p(`The post stays live until ${expiry}. We will email you a few days before then with a one-click option to keep it live for another 30 days.`)
        : "") +
      h("Once you have hired") +
      p("Please mark the post as filled from your dashboard so it comes off the board and candidates stop applying.") +
      cta("Go to my job posts", dashboardUrl) +
      p("If anything about the post needs changing, you can edit it from the same page. Edits to a live post are reviewed again before they appear, usually within a business day."),
    signed: true,
    footer: footerFor("You are receiving this because you posted a job on the ASN job board."),
  });

  const text = [
    `Hi ${name},`,
    "",
    `Your ${role} post for ${input.practiceName} has been approved and is now live on the Aesthetic Success Network job board.`,
    `View your post: ${postUrl}`,
    "",
    "WHAT HAPPENS NOW",
    nowPara,
    "",
    "WHEN SOMEONE APPLIES",
    applicationsPara,
    ...(expiry
      ? ["", "HOW LONG IT RUNS", `The post stays live until ${expiry}. We will email you a few days before then with a one-click option to keep it live for another 30 days.`]
      : []),
    "",
    "ONCE YOU HAVE HIRED",
    "Please mark the post as filled from your dashboard so it comes off the board and candidates stop applying.",
    `Go to my job posts: ${dashboardUrl}`,
    "",
    "If anything about the post needs changing, you can edit it from the same page. Edits to a live post are reviewed again before they appear, usually within a business day.",
    textSignoff(),
  ].join("\n");

  return send({
    to: input.to,
    bcc: auditBcc(),
    subject: `Your ${role} post is live on the ASN job board`,
    tag: "approved",
    html,
    text,
  });
}

// =====================================================================
// 3. Member — rejected. The reason is not optional.
// =====================================================================

export async function sendJobRejected(input: {
  to: string;
  firstName: string;
  lastName?: string | null;
  roleLabel: string;
  practiceName?: string | null;
  reason: string;
}): Promise<boolean> {
  const url = `${siteUrl()}/dashboard/jobs`;
  const name = posterGreeting(input.firstName, input.lastName);
  const role = lc(input.roleLabel);
  const post = input.practiceName ? `${role} post for ${input.practiceName}` : `${role} post`;

  const html = layout({
    preview: "One change is needed before it can go live.",
    greeting: `Hi ${name},`,
    body:
      p(`Thank you for posting on the Aesthetic Success Network job board. We reviewed your ${post} and it needs one change before it can go live.`) +
      quote("What needs changing", input.reason) +
      h("What to do next") +
      p("Open the post from your dashboard, make the change, and send it for review again. We usually review within a business day, and the post keeps the same web address.") +
      cta("Edit my post", url) +
      p("If anything in the note above is unclear, reply to this email and we will help."),
    signed: true,
    footer: footerFor("You are receiving this because you posted a job on the ASN job board."),
  });

  const text = [
    `Hi ${name},`,
    "",
    `Thank you for posting on the Aesthetic Success Network job board. We reviewed your ${post} and it needs one change before it can go live.`,
    "",
    `WHAT NEEDS CHANGING`,
    `"${input.reason}"`,
    "",
    "WHAT TO DO NEXT",
    "Open the post from your dashboard, make the change, and send it for review again. We usually review within a business day, and the post keeps the same web address.",
    `Edit my post: ${url}`,
    "",
    "If anything in the note above is unclear, reply to this email and we will help.",
    textSignoff(),
  ].join("\n");

  return send({ to: input.to, bcc: auditBcc(), subject: `Your ${role} post needs a change`, tag: "rejected", html, text });
}

// =====================================================================
// 4. Member — day 25, renew in one click
// =====================================================================

export async function sendJobExpiring(input: {
  to: string;
  firstName: string;
  lastName?: string | null;
  roleLabel: string;
  practiceName?: string | null;
  slug: string;
  daysLeft: number;
  renewUrl: string;
  viewCount: number;
  applicationCount?: number;
}): Promise<boolean> {
  const dashboardUrl = `${siteUrl()}/dashboard/jobs`;
  const days = input.daysLeft === 1 ? "tomorrow" : `in ${input.daysLeft} days`;
  const name = posterGreeting(input.firstName, input.lastName);
  const role = lc(input.roleLabel);
  const post = input.practiceName ? `${role} post for ${input.practiceName}` : `${role} post`;
  const stats: string[] = [];
  if (input.viewCount > 0) stats.push(`${input.viewCount} ${input.viewCount === 1 ? "view" : "views"}`);
  if ((input.applicationCount ?? 0) > 0) stats.push(`${input.applicationCount} ${input.applicationCount === 1 ? "application" : "applications"}`);
  const soFar = stats.length ? `So far it has had ${stats.join(" and ")}.` : "";

  const html = layout({
    preview: `Keep it live for another 30 days with one click.`,
    greeting: `Hi ${name},`,
    body:
      p(`Your ${post} comes off the Aesthetic Success Network job board ${days}. ${soFar}`.trim()) +
      h("Still hiring?") +
      p("Keep the post live for another 30 days. It keeps the same web address and stays indexed by Google as an open role.") +
      cta("Keep it live for 30 more days", input.renewUrl) +
      h("Already hired?") +
      p("Nothing to do. The post will come off the board on its own, or you can mark it as filled now from your dashboard so candidates stop applying.") +
      cta("Go to my job posts", dashboardUrl),
    signed: true,
    footer: footerFor("You are receiving this because you posted a job on the ASN job board."),
  });

  const text = [
    `Hi ${name},`,
    "",
    `Your ${post} comes off the Aesthetic Success Network job board ${days}. ${soFar}`.trim(),
    "",
    "STILL HIRING?",
    `Keep it live for 30 more days: ${input.renewUrl}`,
    "",
    "ALREADY HIRED?",
    `Nothing to do. The post will come off the board on its own, or mark it as filled now: ${dashboardUrl}`,
    textSignoff(),
  ].join("\n");

  return send({ to: input.to, bcc: auditBcc(), subject: `Your ${role} post expires ${days}`, tag: "expiring", html, text });
}

// =====================================================================
// 5. Practice — a candidate has applied (approved draft 1)
//
// This is the email that has to work. Everything upstream of it — the
// free account, the form, the CV upload — exists so that a practice
// receives a candidate. If this send fails the application is still
// safely stored (delivered_at stays null and the row can be retried).
//
// reply_to is the APPLICANT, not support@. A practice that hits Reply
// should reach the candidate directly.
// =====================================================================

export async function sendApplicationToPractice(input: {
  to: string;
  posterFirstName?: string | null;
  posterLastName?: string | null;
  jobId: string;
  jobSlug: string;
  roleLabel: string;
  practiceName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  message: string | null;
  cv?: MailAttachment | null;
}): Promise<boolean> {
  const applicantsUrl = `${siteUrl()}/dashboard/jobs/${input.jobId}/applicants`;
  const applicantFirst = firstNameOf(input.applicantName);
  const name = input.posterFirstName ? posterGreeting(input.posterFirstName, input.posterLastName) : "there";
  const role = lc(input.roleLabel);
  const rows = [
    { label: "Applicant", value: input.applicantName },
    { label: "Email", value: input.applicantEmail },
    { label: "Phone", value: input.applicantPhone || "Not provided" },
    { label: "CV", value: input.cv ? `${input.cv.filename}, attached to this email` : "Not attached" },
  ];

  const html = layout({
    preview: `${input.applicantName} has applied through the Aesthetic Success Network job board. Their CV is attached.`,
    greeting: `Hi ${name},`,
    body:
      p(`Good news. A candidate has applied for the ${role} position at ${input.practiceName} through the Aesthetic Success Network job board.`) +
      kv(rows) +
      (input.message ? quote("Their message to you", input.message) : "") +
      p(`To reply, simply respond to this email. It goes directly to ${applicantFirst}, not to us.`) +
      p("You can also review every applicant for this post, download CVs and update each candidate's status from your dashboard. Candidates can see the status you set, so a quick update saves them wondering.") +
      cta("View applicants", applicantsUrl) +
      p("If you have a moment, even a quick no means a lot to somebody who is waiting."),
    signed: true,
    footer: footerFor("You are receiving this because you posted a job on the ASN job board."),
  });

  const text = [
    `Hi ${name},`,
    "",
    `Good news. A candidate has applied for the ${role} position at ${input.practiceName} through the Aesthetic Success Network job board.`,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    ...(input.message ? ["", `Their message to you: "${input.message}"`] : []),
    "",
    `To reply, simply respond to this email. It goes directly to ${applicantFirst}, not to us.`,
    "",
    "You can also review every applicant for this post, download CVs and update each candidate's status from your dashboard. Candidates can see the status you set, so a quick update saves them wondering.",
    `View applicants: ${applicantsUrl}`,
    "",
    "If you have a moment, even a quick no means a lot to somebody who is waiting.",
    textSignoff(),
  ].join("\n");

  return send({
    to: input.to,
    bcc: auditBcc(),
    subject: `New applicant for your ${role} post: ${input.applicantName}`,
    html,
    text,
    tag: "application-to-practice",
    replyTo: input.applicantEmail,
    attachments: input.cv ? [input.cv] : undefined,
  });
}

// =====================================================================
// 6. Applicant — their own copy (approved draft 2)
//
// Only sent when they ticked the box. The CV is deliberately NOT
// re-attached: they have the file, they just sent it.
// =====================================================================

export async function sendApplicationCopyToApplicant(input: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  cvFilename: string | null;
  roleLabel: string;
  practiceName: string;
  message: string | null;
}): Promise<boolean> {
  const trackUrl = `${siteUrl()}/seeker`;
  const first = firstNameOf(input.applicantName);
  const role = lc(input.roleLabel);
  const rows = [
    { label: "Name", value: input.applicantName },
    { label: "Email", value: input.applicantEmail },
    { label: "Phone", value: input.applicantPhone || "Not provided" },
    { label: "CV", value: input.cvFilename || "Not attached" },
  ];

  const html = layout({
    preview: "Here is a copy of what you sent, and how to follow its progress.",
    greeting: `Hi ${first},`,
    body:
      p(`Your application for the ${role} position at ${input.practiceName} has been delivered to the practice, with your CV attached.`) +
      h("What you sent") +
      kv(rows) +
      (input.message ? quote("Your message", input.message) : "") +
      h("What happens next") +
      p("The practice will contact you directly if they would like to take things further. Replies come from them, not from us, so please keep an eye on your inbox and your spam folder.") +
      p("You can follow the status of this and any other application at any time. When the practice reviews your application or shortlists you, it will show there.") +
      cta("Track my applications", trackUrl) +
      p("We wish you the very best with it."),
    signed: true,
    footer: footerFor("You are receiving this because you applied for a job through the ASN job board and asked for a copy."),
  });

  const text = [
    `Hi ${first},`,
    "",
    `Your application for the ${role} position at ${input.practiceName} has been delivered to the practice, with your CV attached.`,
    "",
    "WHAT YOU SENT",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    ...(input.message ? ["", `Your message: "${input.message}"`] : []),
    "",
    "WHAT HAPPENS NEXT",
    "The practice will contact you directly if they would like to take things further. Replies come from them, not from us, so please keep an eye on your inbox and your spam folder.",
    "",
    `You can follow the status of this and any other application at any time: ${trackUrl}`,
    "",
    "We wish you the very best with it.",
    textSignoff(),
  ].join("\n");

  return send({
    to: input.to,
    bcc: auditBcc(),
    subject: `Your application for ${role} at ${input.practiceName} has been sent`,
    html,
    text,
    tag: "application-copy",
  });
}
