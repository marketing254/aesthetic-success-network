import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox, teamDistributionList } from "@/lib/email/sandbox";

/**
 * Team notification + lead-magnet email helpers.
 *
 * Sends through the same Rackspace SMTP transport configured for the
 * waitlist emails. The team distribution list comes from the
 * TEAM_DISTRIBUTION_LIST env var (comma separated); with nothing set it
 * falls back to the single default inbox in sandbox.ts.
 */

export const TEAM_DISTRIBUTION_LIST = teamDistributionList();

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";

function fromAddress(): string {
  return (
    process.env.WAITLIST_EMAIL_FROM ||
    "Aesthetic Success Network <hello@aestheticsuccessnetwork.com>"
  );
}

/**
 * Fire an internal-only email to the team distribution list. Used for
 * lead-magnet downloads + Stripe payment notifications. Returns true on
 * success, false on any transport failure — never throws.
 */
export async function notifyTeam(opts: {
  subject: string;
  html: string;
  text: string;
  tag: string; // e.g. "lead-magnet" / "stripe-payment" — used in server logs
}): Promise<boolean> {
  try {
    const from = fromAddress();

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
          to: TEAM_DISTRIBUTION_LIST.join(", "),
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      );
      console.info(`[team-notify:${opts.tag}] sent via SMTP`, { recipients: TEAM_DISTRIBUTION_LIST.length });
      return true;
    }

    // Resend fallback
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          applyEmailSandbox({
            from,
            to: TEAM_DISTRIBUTION_LIST,
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
          }),
        ),
      });
      if (!res.ok) {
        console.error(`[team-notify:${opts.tag}] Resend failed`, await res.text().catch(() => ""));
        return false;
      }
      console.info(`[team-notify:${opts.tag}] sent via Resend`);
      return true;
    }

    // No transport configured → log-only mode (dev / pre-launch)
    console.info(`[team-notify:${opts.tag}] (no transport) ${opts.subject}`);
    return false;
  } catch (err) {
    console.error(`[team-notify:${opts.tag}] send failed`, err);
    return false;
  }
}

// =====================================================================
// Lead magnet delivery (generic)
// =====================================================================

/**
 * Registry of known magnets. Any slug not listed here still works: the
 * email falls back to the generic ASN starter-kit wording and sends
 * without an attachment. Paths are relative to /public.
 */
const LEAD_MAGNETS: Record<
  string,
  { title: string; pdfPath: string | null; attachmentFilename: string | null; buttonLabel: string }
> = {
  "starter-kit": {
    title: "your free starter kit",
    pdfPath: null,
    attachmentFilename: null,
    buttonLabel: "Download your kit",
  },
};

export type LeadMagnetSlug = string;

export type LeadMagnetEmailInput = {
  to: string;
  firstName?: string | null;
  /** Registry key. Unknown slugs use the generic defaults. */
  magnetSlug?: LeadMagnetSlug;
  /** Human title, e.g. "your free starter kit" (used mid-sentence). */
  magnetTitle?: string | null;
  /** Path under /public to a PDF to attach. Optional; a missing file is skipped, never thrown. */
  pdfPath?: string | null;
  /** Attachment filename shown to the recipient. */
  attachmentFilename?: string | null;
  /** Button label. */
  buttonLabel?: string | null;
  /** Where the button points. Defaults to the site origin. */
  downloadUrl?: string | null;
};

/** Registry-shaped magnet, as /api/lead-magnets/[slug] passes it (src/lib/leadMagnets.ts). */
export type LeadMagnetSpec = {
  title: string;
  /** Path relative to `public/` (no leading slash). Optional. */
  filePath?: string | null;
  buttonLabel?: string | null;
  attachmentFilename?: string | null;
  downloadUrl?: string | null;
  slug?: string;
};

/**
 * Send a lead-magnet email to the requester. Used by the homepage lead
 * magnet form. The attachment is optional: when the PDF path is unset or
 * the file is missing on disk the email still goes out with the button
 * only. Returns true on success, false otherwise; never throws.
 *
 * Two call shapes are accepted:
 *   sendLeadMagnetEmail({ to, firstName, magnetTitle, pdfPath, buttonLabel })
 *   sendLeadMagnetEmail(to, firstName, { title, filePath, buttonLabel })
 */
export async function sendLeadMagnetEmail(opts: LeadMagnetEmailInput): Promise<boolean>;
export async function sendLeadMagnetEmail(
  to: string,
  firstName: string | null | undefined,
  magnet: LeadMagnetSpec,
): Promise<boolean>;
export async function sendLeadMagnetEmail(
  a: LeadMagnetEmailInput | string,
  b?: string | null,
  c?: LeadMagnetSpec,
): Promise<boolean> {
  if (typeof a === "string") {
    const magnet = c ?? { title: "your free starter kit" };
    return sendLeadMagnetEmailImpl({
      to: a,
      firstName: b ?? null,
      magnetSlug: magnet.slug,
      magnetTitle: magnet.title,
      pdfPath: magnet.filePath ?? null,
      attachmentFilename: magnet.attachmentFilename ?? null,
      buttonLabel: magnet.buttonLabel ?? null,
      downloadUrl: magnet.downloadUrl ?? null,
    });
  }
  return sendLeadMagnetEmailImpl(a);
}

async function sendLeadMagnetEmailImpl(opts: LeadMagnetEmailInput): Promise<boolean> {
  try {
    const registry = (opts.magnetSlug && LEAD_MAGNETS[opts.magnetSlug]) || LEAD_MAGNETS["starter-kit"];
    const slug = opts.magnetSlug ?? "starter-kit";
    const title = (opts.magnetTitle ?? registry.title).trim() || "your free starter kit";
    const buttonLabel = (opts.buttonLabel ?? registry.buttonLabel).trim() || "Download your kit";
    const downloadUrl = opts.downloadUrl?.trim() || `${SITE_URL}/`;
    const pdfRelative = opts.pdfPath === undefined ? registry.pdfPath : opts.pdfPath;

    let pdfBuffer: Buffer | null = null;
    let attachmentFilename: string | null = null;
    if (pdfRelative) {
      const pdfPath = path.join(process.cwd(), "public", pdfRelative.replace(/^\/+/, ""));
      if (existsSync(pdfPath)) {
        pdfBuffer = await fs.readFile(pdfPath);
        attachmentFilename =
          opts.attachmentFilename?.trim() || registry.attachmentFilename || path.basename(pdfPath);
      } else {
        console.warn(`[lead-magnet:${slug}] PDF missing on disk, sending without attachment`, pdfPath);
      }
    }

    const from = fromAddress();
    const firstName = opts.firstName ? opts.firstName.trim().split(/\s+/)[0] || "there" : "there";
    const safeName = escapeHtml(firstName);
    const safeTitle = escapeHtml(title);
    const safeButton = escapeHtml(buttonLabel);
    const safeUrl = escapeHtml(downloadUrl);
    const subject = `Here is ${title}, ${firstName}`;
    const preheader = "Yours to keep. Here is how to get the most out of it this week.";
    const attachedLine = pdfBuffer
      ? `<p style="font-size:13px;color:#7A8590;margin:0 0 16px;">The PDF is also attached to this email.</p>`
      : "";

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.65;color:#0A1A2F;max-width:600px;">
        <span style="display:none!important;visibility:hidden;mso-hide:all;max-height:0;overflow:hidden;color:#FBF8F1;">
          ${escapeHtml(preheader)}
        </span>

        <p>Hi ${safeName},</p>

        <p>Here it is: <strong>${safeTitle}</strong>. No strings, yours to keep.</p>

        <p style="margin:22px 0;">
          <a href="${safeUrl}"
             style="display:inline-block;padding:12px 20px;border-radius:6px;background:#0A1A2F;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;">
            ${safeButton}
          </a>
        </p>
        ${attachedLine}

        <p>Here is how to get the most out of it this week:</p>

        <ol style="padding-left:20px;margin:0 0 16px 0;">
          <li style="margin-bottom:10px;">
            <strong>Start with the action guide.</strong> It is written so you can hand it to your team and run it as is.
          </li>
          <li style="margin-bottom:10px;">
            <strong>Run the checklist before you change anything.</strong> Ten minutes of prep is where the results come from.
          </li>
          <li style="margin-bottom:10px;">
            <strong>Pick one thing and do it this week.</strong> You do not need to overhaul the practice. One change, measured, is how most of our members get their first win.
          </li>
        </ol>

        <p>And if it helps, hit reply and tell us how it goes. A real person reads every one.</p>

        <p style="margin-top:24px;">
          The Aesthetic Success Network team<br />
          <span style="color:#7A8590;font-size:13px;">Powered by Business of Aesthetics</span>
        </p>

        <hr style="border:none;border-top:1px solid #E6DDCF;margin:28px 0 20px 0;" />

        <p style="font-size:13px;color:#3B4A55;line-height:1.6;">
          <strong>P.S.</strong> This is one of the kits our members get. New done-for-you kits from working experts are added to the Aesthetic Success Network regularly, alongside the Expert Hotline for the problems a PDF cannot solve. If this was useful,
          <a href="${escapeHtml(SITE_URL)}" style="color:#A07823;font-weight:600;">there is a lot more where it came from</a>.
          Founding spots are <strong>$39/month</strong>, locked for as long as your membership stays active.
        </p>
      </div>
    `;

    const text = [
      `Hi ${firstName},`,
      "",
      `Here it is: ${title}. No strings, yours to keep.`,
      "",
      `${buttonLabel}: ${downloadUrl}`,
      ...(pdfBuffer ? ["(The PDF is also attached to this email.)"] : []),
      "",
      "Here is how to get the most out of it this week:",
      "",
      "1. Start with the action guide. It is written so you can hand it to your team and run it as is.",
      "2. Run the checklist before you change anything. Ten minutes of prep is where the results come from.",
      "3. Pick one thing and do it this week. You do not need to overhaul the practice. One change, measured, is how most of our members get their first win.",
      "",
      "And if it helps, hit reply and tell us how it goes. A real person reads every one.",
      "",
      "The Aesthetic Success Network team",
      "Powered by Business of Aesthetics",
      "",
      `P.S. This is one of the kits our members get. New done-for-you kits from working experts are added to the Aesthetic Success Network regularly, alongside the Expert Hotline for the problems a PDF cannot solve. If this was useful, there is a lot more where it came from: ${SITE_URL}`,
      "Founding spots are $39/month, locked for as long as your membership stays active.",
    ].join("\n");

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
          to: opts.to,
          subject,
          html,
          text,
          attachments:
            pdfBuffer && attachmentFilename
              ? [{ filename: attachmentFilename, content: pdfBuffer, contentType: "application/pdf" }]
              : undefined,
        }),
      );
      console.info(`[lead-magnet:${slug}] sent via SMTP`, { to: opts.to, attached: Boolean(pdfBuffer) });
      return true;
    }

    // Resend (uses base64-encoded attachment)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          applyEmailSandbox({
            from,
            to: [opts.to],
            subject,
            html,
            text,
            attachments:
              pdfBuffer && attachmentFilename
                ? [{ filename: attachmentFilename, content: pdfBuffer.toString("base64") }]
                : undefined,
          }),
        ),
      });
      if (!res.ok) {
        console.error(`[lead-magnet:${slug}] Resend failed`, await res.text().catch(() => ""));
        return false;
      }
      console.info(`[lead-magnet:${slug}] sent via Resend`);
      return true;
    }

    console.info(`[lead-magnet:${slug}] (no transport) would have sent to ${opts.to}`);
    return false;
  } catch (err) {
    console.error("[lead-magnet] send failed", err);
    return false;
  }
}

// =====================================================================
// New-signup team alert
// =====================================================================

export type SignupRole = "member" | "expert" | "partner";
export type NotifyRole = SignupRole | "both";

/**
 * A single labelled fact rendered as one row in the alert email.
 * `value` may be null/empty — the row is skipped when it is.
 */
export type SignupField = { label: string; value: string | null | undefined };

/**
 * The lifecycle moment this alert marks. Drives the banner label, subject
 * line, and accent colour so every team email reads the same but the team
 * can tell at a glance what happened.
 */
export type TeamEventKind = "signup" | "admin_added" | "invite_sent" | "invite_accepted";

function roleLabelFor(role: NotifyRole): string {
  if (role === "member") return "Member";
  if (role === "expert") return "Expert";
  if (role === "partner") return "Partner";
  return "Expert + Partner";
}

const EVENT_META: Record<TeamEventKind, { banner: string; accent: string; subject: (r: string, n: string) => string }> = {
  signup: {
    banner: "NEW %ROLE% SIGNUP",
    accent: "#F0C16E",
    subject: (r, n) => `New ${r} signup: ${n}`,
  },
  admin_added: {
    banner: "%ROLE% ADDED BY ADMIN",
    accent: "#F0C16E",
    subject: (r, n) => `${r} added by admin: ${n}`,
  },
  invite_sent: {
    banner: "FOUNDING INVITE SENT · %ROLE%",
    accent: "#F0C16E",
    subject: (r, n) => `Founding invite sent: ${n} (${r})`,
  },
  invite_accepted: {
    banner: "INVITE ACCEPTED · %ROLE%",
    accent: "#7BD59A",
    subject: (r, n) => `Accepted: ${n} (${r}, card on file)`,
  },
};

/**
 * Fire a standardized, professional alert to the whole team for a person
 * lifecycle event — a public signup, an admin-added expert/partner/member,
 * a founding invite being sent, or an invitee accepting (card saved, ready
 * to sign in). Every field provided renders in a clean two-column table so
 * the team can act without opening the admin panel. Best-effort — never
 * throws, never blocks the response (call it with `void`).
 */
export async function notifyTeamEvent(opts: {
  kind: TeamEventKind;
  role: NotifyRole;
  name: string;
  email: string;
  fields: SignupField[];
  adminLink?: string; // deep-link into the admin panel for this record
  at?: string; // ISO; defaults to now
  highlight?: string; // optional callout banner, e.g. "Card on file, ready to sign in"
}): Promise<boolean> {
  const roleLabel = roleLabelFor(opts.role);
  const meta = EVENT_META[opts.kind];
  const when = formatTimestamp(opts.at ?? new Date().toISOString());
  const banner = meta.banner.replace("%ROLE%", roleLabel.toUpperCase());
  const subject = meta.subject(roleLabel, opts.name);

  const rows = opts.fields
    .filter((f) => f.value != null && String(f.value).trim() !== "")
    .map((f) => ({ label: f.label, value: String(f.value).trim() }));

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 14px;border-bottom:1px solid #EDE7DA;color:#5C6770;font-size:13px;white-space:nowrap;vertical-align:top;font-weight:600;">${escapeHtml(r.label)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #EDE7DA;color:#0A1A2F;font-size:13px;">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join("");

  const highlightHtml = opts.highlight
    ? `<div style="margin:0 0 16px 0;padding:10px 14px;background:#EAF7EF;border:1px solid #BFE6CE;border-radius:8px;color:#1F6B45;font-size:13px;font-weight:600;">&#10003; ${escapeHtml(opts.highlight)}</div>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#F7F5F0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E0DACE;border-radius:12px;overflow:hidden;">
    <div style="background:#0E2A3D;padding:18px 22px;">
      <img src="${SITE_URL}/asn-logo-email-dark.png" alt="Aesthetic Success Network" width="150" style="display:block;max-width:150px;height:auto;" />
      <div style="color:${meta.accent};font-size:11px;letter-spacing:1.5px;margin-top:3px;font-weight:700;">${escapeHtml(banner)}</div>
    </div>
    <div style="padding:20px 22px;">
      <div style="font-size:18px;font-weight:700;color:#0A1A2F;margin-bottom:2px;">${escapeHtml(opts.name)}</div>
      <div style="font-size:13px;color:#5C6770;margin-bottom:16px;">${escapeHtml(opts.email)} · ${escapeHtml(when)}</div>
      ${highlightHtml}
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #EDE7DA;">${rowsHtml}</table>
      ${
        opts.adminLink
          ? `<div style="margin-top:20px;"><a href="${escapeHtml(opts.adminLink)}" style="display:inline-block;background:#0E2A3D;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;padding:10px 18px;border-radius:999px;">Open in admin panel &rarr;</a></div>`
          : ""
      }
    </div>
    <div style="padding:12px 22px;border-top:1px solid #EDE7DA;color:#9AA1A8;font-size:11px;">
      Automated notification · Aesthetic Success Network
    </div>
  </div>
</body></html>`;

  const text = [
    banner,
    "",
    opts.name,
    `${opts.email} · ${when}`,
    ...(opts.highlight ? ["", `[ok] ${opts.highlight}`] : []),
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    ...(opts.adminLink ? ["", `Admin: ${opts.adminLink}`] : []),
  ].join("\n");

  return notifyTeam({ subject, html, text, tag: `${opts.kind}-${opts.role}` });
}

/**
 * Back-compat wrapper for the public signup forms.
 */
export async function notifySignup(opts: {
  role: SignupRole;
  name: string;
  email: string;
  fields: SignupField[];
  adminLink?: string;
  submittedAt?: string;
}): Promise<boolean> {
  return notifyTeamEvent({
    kind: "signup",
    role: opts.role,
    name: opts.name,
    email: opts.email,
    fields: opts.fields,
    adminLink: opts.adminLink,
    at: opts.submittedAt,
  });
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Toronto",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
