import "server-only";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox, auditBccList, queueAlertList, suppressedEmails } from "@/lib/email/sandbox";

/**
 * Abandoned registration sequence. Someone starts the /join/member signup,
 * reaches their work email, and doesn't pay:
 *
 *   email 1  +1 hour    resume link, two lines
 *   email 2  +24 hours  what they'd have on day one
 *   email 3  +7 days    one-month-free code, expires 48h  (the ONLY email
 *                       with a code — never shown on the signup page)
 *
 * Runs UNATTENDED from the hourly cron (explicitly NOT the outbox agent).
 * Stop conditions, all immediate: purchase for that email from any path,
 * unsubscribe click, and a second abandon starts nothing new (one
 * sequence per email per 30 days).
 *
 * Copy follows the approved DMN sequence, swapped to the ASN brand and
 * canon. Do not edit wording without the owner.
 */

const FOUNDING_EMAIL = process.env.MAIL_REPLYTO_FOUNDING ?? "founding@aestheticsuccessnetwork.com";
const FROM = `Lester De Alwis <${FOUNDING_EMAIL}>`;
const REPLY_TO = FOUNDING_EMAIL;
// Monitoring copies: EMAIL_AUDIT_BCC (comma list, single default inbox).
const BCC = auditBccList();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const RESUME_TOKEN_TTL_DAYS = 14;
const SEQUENCE_WINDOW_DAYS = 30;
export const CODE_TTL_HOURS = 48;
/** One month free, then the founding $29/mo like everyone else. */
export const RECOVERY_TRIAL_DAYS = 30;

// pending_registrations (migration 0059) isn't in the generated DB
// types yet — use an untyped client for this module (same escape hatch
// as other post-typegen tables).
function db(): SupabaseClient {
  return getSupabaseAdmin() as unknown as SupabaseClient;
}

function origin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
}

function transport(): Transporter | null {
  if (process.env.SMTP_TX_HOST && process.env.SMTP_TX_USER && process.env.SMTP_TX_PASS) {
    const port = Number(process.env.SMTP_TX_PORT ?? "465");
    return nodemailer.createTransport({
      host: process.env.SMTP_TX_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_TX_USER, pass: process.env.SMTP_TX_PASS },
    });
  }
  return null;
}

function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** 8 chars, unambiguous (no 0/O, 1/I/l) — per the SPEC's code rules. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateRecoveryCode(): string {
  let s = "";
  for (let i = 0; i < 8; i += 1) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// ── capture ─────────────────────────────────────────────────────────────

export type CapturePayload = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  practiceName?: string | null;
  role?: string | null;
  plan?: string | null;
  utm?: Record<string, string> | null;
};

/**
 * Record (or enrich) a partial registration. Called from /join/member when the
 * work-email field completes or Continue is clicked. Never throws.
 *
 *   - Email already belongs to a paying member → no capture.
 *   - An open or recent (<30 days) sequence exists for this email → only
 *     the field values are refreshed; the schedule does NOT restart.
 */
// Emails the recovery sequence must never touch, regardless of capture
// (handled manually / separately). SUPPRESSED_EMAILS env list, lower-case,
// default empty.
const SUPPRESSED_EMAILS = suppressedEmails();

export async function captureAbandon(p: CapturePayload): Promise<void> {
  const sb = db();
  const email = p.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
  if (SUPPRESSED_EMAILS.has(email)) return;

  // Already a paying member? Nothing to recover.
  const { data: member } = await sb
    .from("members")
    .select("subscription_status")
    .eq("email", email)
    .maybeSingle();
  if (member?.subscription_status === "active" || member?.subscription_status === "trialing") return;

  const { data: existing } = await sb
    .from("pending_registrations")
    .select("id, captured_at, stopped_at")
    .ilike("email", email)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const within30d =
    existing && Date.now() - new Date(existing.captured_at).getTime() < SEQUENCE_WINDOW_DAYS * DAY;

  const fields = {
    first_name: p.firstName?.trim() || null,
    last_name: p.lastName?.trim() || null,
    practice_name: p.practiceName?.trim() || null,
    role: p.role?.trim() || null,
    plan: p.plan ?? null,
    utm: p.utm ?? null,
  };

  if (existing && within30d) {
    // Second abandon inside the window: refresh what they filled, restart
    // nothing (the schedule stays anchored to the FIRST abandon).
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v != null) patch[k] = v;
    if (Object.keys(patch).length > 0) {
      await sb.from("pending_registrations").update(patch as never).eq("id", existing.id);
    }
    return;
  }

  await sb.from("pending_registrations").insert({
    email,
    ...fields,
    resume_token: token(),
    unsubscribe_token: token(),
  } as never);
}

// ── resume ──────────────────────────────────────────────────────────────

export type ResumeContext = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  practiceName: string | null;
  role: string | null;
  plan: string | null;
  /** State of the one-month-free code attached to this sequence. */
  codeState: "none" | "active" | "expired";
};

/** Resolve a resume token → prefill fields. Null when invalid/expired. */
export async function resolveResumeToken(tokenValue: string): Promise<ResumeContext | null> {
  if (!tokenValue || tokenValue.length < 16 || tokenValue.length > 64) return null;
  const sb = db();
  const { data: row } = await sb
    .from("pending_registrations")
    .select("email, first_name, last_name, practice_name, role, plan, captured_at, code, code_expires_at, code_used_at")
    .eq("resume_token", tokenValue)
    .maybeSingle();
  if (!row) return null;
  if (Date.now() - new Date(row.captured_at).getTime() > RESUME_TOKEN_TTL_DAYS * DAY) return null;

  // Reporting: first successful resume-open counts as "resumed".
  await sb
    .from("pending_registrations")
    .update({ resumed_at: new Date().toISOString() })
    .eq("resume_token", tokenValue)
    .is("resumed_at", null);

  let codeState: ResumeContext["codeState"] = "none";
  if (row.code && !row.code_used_at) {
    codeState =
      row.code_expires_at && new Date(row.code_expires_at).getTime() > Date.now()
        ? "active"
        : "expired";
  }
  return {
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    practiceName: row.practice_name,
    role: row.role,
    plan: row.plan,
    codeState,
  };
}

/**
 * Validate a resume token for CHECKOUT code application (server-side
 * only — the code itself never travels through the browser). Returns the
 * trial grant when the sequence's code is active, unused and matches the
 * buyer's email.
 */
export async function recoveryGrantForCheckout(
  tokenValue: string,
  email: string,
): Promise<{ rowId: string; code: string } | null> {
  const sb = db();
  const { data: row } = await sb
    .from("pending_registrations")
    .select("id, email, code, code_expires_at, code_used_at")
    .eq("resume_token", tokenValue)
    .maybeSingle();
  if (!row?.code || row.code_used_at) return null;
  if (row.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  if (!row.code_expires_at || new Date(row.code_expires_at).getTime() <= Date.now()) return null;
  return { rowId: row.id, code: row.code };
}

// ── stop conditions ─────────────────────────────────────────────────────

/** Purchase confirmed for this email, from any path → stop everything. */
export async function stopSequenceOnPurchase(email: string, recoveryRowId?: string | null): Promise<void> {
  const sb = db();
  try {
    const { data: rows } = await sb
      .from("pending_registrations")
      .select("id, email1_sent_at, email2_sent_at, email3_sent_at, stopped_at")
      .ilike("email", email.trim().toLowerCase())
      .is("stopped_at", null);
    for (const row of rows ?? []) {
      const via = row.email3_sent_at ? 3 : row.email2_sent_at ? 2 : row.email1_sent_at ? 1 : null;
      await sb
        .from("pending_registrations")
        .update({
          stopped_at: new Date().toISOString(),
          stop_reason: "purchased",
          purchased_at: new Date().toISOString(),
          recovered_via_email: via,
          ...(recoveryRowId && row.id === recoveryRowId
            ? { code_used_at: new Date().toISOString() }
            : {}),
        } as never)
        .eq("id", row.id);
    }
    // The single-use code is burned on purchase even if the row matched
    // by id rather than the open filter above.
    if (recoveryRowId) {
      await sb
        .from("pending_registrations")
        .update({ code_used_at: new Date().toISOString() } as never)
        .eq("id", recoveryRowId)
        .is("code_used_at", null);
    }
  } catch (err) {
    console.error("[abandoned] stop-on-purchase failed:", err);
  }
}

export async function stopSequenceOnUnsubscribe(unsubToken: string): Promise<boolean> {
  const sb = db();
  const { data: row } = await sb
    .from("pending_registrations")
    .select("id")
    .eq("unsubscribe_token", unsubToken)
    .maybeSingle();
  if (!row) return false;
  await sb
    .from("pending_registrations")
    .update({ stopped_at: new Date().toISOString(), stop_reason: "unsubscribed" } as never)
    .eq("id", row.id)
    .is("stopped_at", null);
  return true;
}

// ── the three emails ────────────────────────────────────────────────────

// Same embedded-logo pattern as the onboarding emails (CID attachment so
// it renders without remote-image blocking).
const LOGO_CID = "asn-logo";
let LOGO_BUFFER: Buffer | null | undefined;
function logoAttachment(): { filename: string; content: Buffer; cid: string }[] {
  if (LOGO_BUFFER === undefined) {
    try {
      // Square navy tile mark (128px, ~15 KB): the right asset for a 72px header slot.
      LOGO_BUFFER = readFileSync(path.join(process.cwd(), "public", "asn-logo-email.png"));
    } catch {
      LOGO_BUFFER = null;
    }
  }
  return LOGO_BUFFER ? [{ filename: "asn-logo.png", content: LOGO_BUFFER, cid: LOGO_CID }] : [];
}

function shell(bodyHtml: string, unsubscribeLink: string): string {
  // Personal letter with a branded letterhead: ASN mark, gold rule,
  // Georgia body, one centered gold button — per the SPEC's sending
  // rules (mostly text, never a marketing-blast look).
  return `<!doctype html>
<html style="background:#F6F1E7;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aesthetic Success Network</title></head>
<body style="background:#F6F1E7;margin:0;padding:32px 12px;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;">
  <tr><td style="background:#FFFFFF;border:1px solid #E6DDCF;border-radius:14px;overflow:hidden;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:28px 40px 16px;text-align:center;">
        ${emailBrandHeader({ center: true })}
      </td></tr>
      <tr><td style="padding:0 40px;"><div style="height:2px;background:#D9A84B;border-radius:2px;"></div></td></tr>
      <tr><td style="padding:26px 40px 34px;color:#243244;font-size:16px;line-height:1.75;">
${bodyHtml}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:18px 10px 0;color:#8A94A0;font-size:11px;line-height:1.7;text-align:center;font-family:Arial,Helvetica,sans-serif;">
    Aesthetic Success Network &middot; Powered by Business of Aesthetics<br>
    <a href="${escapeHtml(unsubscribeLink)}" style="color:#8A94A0;">Unsubscribe from these emails</a>
  </td></tr>
</table>
</body></html>`;
}

function button(href: string, label: string): string {
  // Centered gold pill — matches the site's founding-offer styling.
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto;"><tr><td style="background:#C89A3F;border-radius:10px;box-shadow:0 8px 18px -8px rgba(160,120,35,0.6);">
  <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 34px;color:#241A06;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;letter-spacing:0.01em;">${escapeHtml(label)} &rarr;</a>
</td></tr></table>`;
}

const SIGNOFF_LINES = ["Warmly,", "Lester De Alwis", "Co-Founder", "Aesthetic Success Network", "Powered by Business of Aesthetics"];
const SIGNOFF = `<p style="margin:22px 0 0;">${SIGNOFF_LINES.join("<br>")}</p>`;
const TEXT_SIGNOFF = SIGNOFF_LINES.join("\n");

type SequenceRow = {
  id: string;
  email: string;
  first_name: string | null;
  resume_token: string;
  unsubscribe_token: string;
  /** founding_monthly | founding_annual (what they picked before dropping off). */
  plan?: string | null;
};

/** Rate wording that matches the plan they were on — never quote $29/month to an annual chooser. */
function rateWords(plan: string | null | undefined): string {
  return plan === "founding_annual" ? "$290 a year" : "$29 a month";
}

function names(row: SequenceRow) {
  return {
    first: row.first_name?.trim() || "there",
    resume: `${origin()}/join/member?resume=${encodeURIComponent(row.resume_token)}`,
    // Email 3's destination: the member signup page's welcome-back view,
    // which prefills their saved details and auto-applies the month-free
    // code at checkout (server-side, via the token).
    resumeJoin: `${origin()}/join/member?resume=${encodeURIComponent(row.resume_token)}`,
    unsub: `${origin()}/api/ads/unsubscribe?u=${encodeURIComponent(row.unsubscribe_token)}`,
  };
}

function renderEmail1(row: SequenceRow) {
  const { first, resume, unsub } = names(row);
  return {
    subject: "You were one step from in",
    html: shell(
      `<p style="margin:0 0 16px;">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 16px;">You started joining the Aesthetic Success Network and stopped just before the payment step. That is usually a patient walking in, so here is the door, held open.</p>
${button(resume, "Pick up where you left off")}
<p style="margin:0;">Your details are still there. It takes about a minute.</p>
${SIGNOFF}`,
      unsub,
    ),
    text: `Hi ${first},\n\nYou started joining the Aesthetic Success Network and stopped just before the payment step. That is usually a patient walking in, so here is the door, held open.\n\nPick up where you left off: ${resume}\n\nYour details are still there. It takes about a minute.\n\n${TEXT_SIGNOFF}\n\nUnsubscribe: ${unsub}`,
  };
}

const EMAIL2_PARAGRAPHS = [
  "Here is what is inside, on the day you join.",
  "The Expert Hotline. Call the toll-free line with any practice problem and leave a voicemail, or ask Beacon in the portal in plain English. Beacon answers right away from our experts' own sessions, and when you need a person, our team comes back in writing, by text and email, within 2 to 3 business days with the right experts to talk to. Not a search box. A person.",
  "A growing library of done-for-you kits from working experts. Each one is a session turned into something your team can use: training video, action guide, checklist, worksheet, a wall poster for the treatment room.",
  "Templates and SOPs, written from an expert's own process, so a team can run them on a Monday morning.",
  "Member-only offers from companies that serve aesthetic practices, and monthly live AMAs and CE with the experts.",
];

function renderEmail2(row: SequenceRow) {
  const { first, resume, unsub } = names(row);
  const rateLine = `It is ${rateWords(row.plan)}, locked for as long as your membership stays active, for the first hundred founding members.`;
  const faqLine =
    "Two things people ask before they join. Can I cancel? Yes, anytime, from your account. What if it is not for me? The first thirty days carry a full money-back guarantee, so trying it costs one email to me.";
  return {
    subject: "What you would have by tomorrow",
    html: shell(
      `<p style="margin:0 0 16px;">Hi ${escapeHtml(first)},</p>
${EMAIL2_PARAGRAPHS.map((t) => `<p style="margin:0 0 16px;">${escapeHtml(t)}</p>`).join("\n")}
<p style="margin:0 0 16px;">${escapeHtml(rateLine)}</p>
<p style="margin:0 0 16px;">${escapeHtml(faqLine)}</p>
${button(resume, "Finish joining")}
${SIGNOFF}`,
      unsub,
    ),
    text: `Hi ${first},\n\n${EMAIL2_PARAGRAPHS.join("\n\n")}\n\n${rateLine}\n\n${faqLine}\n\nFinish joining: ${resume}\n\n${TEXT_SIGNOFF}\n\nUnsubscribe: ${unsub}`,
  };
}

function renderEmail3(row: SequenceRow, code: string | null, codeExpires: Date | null) {
  const { first, resume, resumeJoin, unsub } = names(row);
  const joinLink = code ? resumeJoin : resume;
  // If the code system is unavailable, email 3 still sends without the
  // code paragraph and with the shorter subject.
  const expiresWords = codeExpires
    ? codeExpires.toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short",
      })
    : null;
  const withCode = !!(code && expiresWords);
  const offerLine = `Join in the next two days and your first month is free. After that it is ${rateWords(row.plan)}, locked for as long as your membership stays active, same as everyone in the founding hundred.`;
  const closingLine =
    "The first thing I would do once you are in is send the hotline the problem that has been sitting on your desk longest. That is what it is for.";
  return {
    subject: withCode ? "Last one from me, and a month on us" : "Last one from me",
    html: shell(
      `<p style="margin:0 0 16px;">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 16px;">This is the last email about this, and I would rather end with something useful than another reminder.</p>
${
  withCode
    ? `<p style="margin:0 0 16px;">${escapeHtml(offerLine)}</p>
<p style="margin:0 0 16px;">Your code: <strong style="letter-spacing:0.08em;">${escapeHtml(code)}</strong><br>It works until ${escapeHtml(expiresWords)}, and it is yours alone.</p>`
    : ""
}
${button(joinLink, withCode ? "Join with a month free" : "Finish joining")}
<p style="margin:0;">${escapeHtml(closingLine)}</p>
${SIGNOFF}`,
      unsub,
    ),
    text: `Hi ${first},\n\nThis is the last email about this, and I would rather end with something useful than another reminder.\n\n${withCode ? `${offerLine}\n\nYour code: ${code}\nIt works until ${expiresWords}, and it is yours alone.\n\n` : ""}${withCode ? "Join with a month free" : "Finish joining"}: ${joinLink}\n\n${closingLine}\n\n${TEXT_SIGNOFF}\n\nUnsubscribe: ${unsub}`,
  };
}

// ── the queue processor (hourly cron) ───────────────────────────────────

/**
 * Process due sequence emails. Called from the hourly cron. Insert-first
 * timestamps make each send idempotent; a purchase check runs right
 * before every send so the 30-minute wait (and any later purchase) can
 * never race a message out.
 */
export async function processAbandonedQueue(): Promise<{ sent: number; stopped: number }> {
  const sb = db();
  const tx = transport();
  if (!tx) {
    console.error("[abandoned] SMTP transport not configured — queue skipped");
    return { sent: 0, stopped: 0 };
  }

  const { data: rows } = await sb
    .from("pending_registrations")
    .select("id, email, first_name, plan, resume_token, unsubscribe_token, captured_at, email1_sent_at, email2_sent_at, email3_sent_at, code, code_expires_at")
    .is("stopped_at", null)
    .order("captured_at", { ascending: true })
    .limit(100);

  let sent = 0;
  let stopped = 0;

  const deliver = (row: SequenceRow, msg: { subject: string; html: string; text: string }) =>
    tx.sendMail(
      applyEmailSandbox({
        from: FROM,
        replyTo: REPLY_TO,
        bcc: BCC,
        to: row.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        attachments: logoAttachment(),
      }),
    );

  for (const row of rows ?? []) {
    const age = Date.now() - new Date(row.captured_at).getTime();

    // Suppressed emails are handled manually — never auto-email them.
    if (SUPPRESSED_EMAILS.has(row.email.trim().toLowerCase())) continue;

    // Purchase check immediately before anything sends (covers the
    // 30-minute wait: email 1 is only due at +1h, and a paid member at
    // ANY point stops the sequence for good).
    const { data: member } = await sb
      .from("members")
      .select("subscription_status")
      .ilike("email", row.email)
      .maybeSingle();
    if (member?.subscription_status === "active" || member?.subscription_status === "trialing") {
      await stopSequenceOnPurchase(row.email);
      stopped += 1;
      continue;
    }

    try {
      if (!row.email1_sent_at && age >= 1 * HOUR) {
        await deliver(row, renderEmail1(row));
        await sb.from("pending_registrations").update({ email1_sent_at: new Date().toISOString() } as never).eq("id", row.id);
        sent += 1;
      } else if (row.email1_sent_at && !row.email2_sent_at && age >= 24 * HOUR) {
        await deliver(row, renderEmail2(row));
        await sb.from("pending_registrations").update({ email2_sent_at: new Date().toISOString() } as never).eq("id", row.id);
        sent += 1;
      } else if (row.email2_sent_at && !row.email3_sent_at && age >= 7 * DAY) {
        // Generate the per-person single-use code at send time so the
        // 48-hour expiry anchors to when email 3 actually goes out.
        const code = generateRecoveryCode();
        const expires = new Date(Date.now() + CODE_TTL_HOURS * HOUR);
        await deliver(row, renderEmail3(row, code, expires));
        await sb
          .from("pending_registrations")
          .update({
            email3_sent_at: new Date().toISOString(),
            code,
            code_expires_at: expires.toISOString(),
            stop_reason: null,
          } as never)
          .eq("id", row.id);
        sent += 1;
      } else if (row.email3_sent_at && age >= 10 * DAY) {
        // Sequence fully played out — close the row so the open-rows
        // query stays small.
        await sb
          .from("pending_registrations")
          .update({ stopped_at: new Date().toISOString(), stop_reason: "completed" } as never)
          .eq("id", row.id);
      }
    } catch (err) {
      console.error(`[abandoned] send failed for ${row.email}:`, err);
    }
  }

  return { sent, stopped };
}

// ── draft review sends ──────────────────────────────────────────────────

/**
 * Send all three sequence emails to the review inbox (EMAIL_QUEUE_ALERT_TO)
 * so the design and copy can be approved BEFORE the sequence goes live.
 * Subjects carry a [DRAFT] prefix; no member ever receives these, and the
 * standard member-send BCC list is not used.
 *
 * When the pending_registrations table exists, a real (pre-stopped)
 * review row is created so every button in the drafts is a WORKING
 * link: resume prefill, the welcome-back 1-month page, unsubscribe —
 * exactly what a recipient would experience. The row is stopped from
 * birth, so the cron never emails it. Before the migration runs, the
 * drafts fall back to pointing every button at the plain signup page.
 */
export async function sendDraftEmails(): Promise<{ sent: string[]; liveLinks: boolean }> {
  const tx = transport();
  if (!tx) throw new Error("SMTP transport not configured (SMTP_TX_* env)");

  const reviewers = queueAlertList();
  const reviewerPrimary = reviewers[0];
  const sampleCode = generateRecoveryCode();
  const sampleExpiry = new Date(Date.now() + CODE_TTL_HOURS * HOUR);

  // Try to create a real review row so the draft links actually work.
  let sample: SequenceRow = {
    id: "draft",
    email: "sample.practice@example.com",
    first_name: "Sarah",
    resume_token: "DRAFT-PREVIEW-TOKEN-000000",
    unsubscribe_token: "DRAFT-PREVIEW-UNSUB-000000",
  };
  let liveLinks = false;
  try {
    const now = new Date().toISOString();
    const row = {
      email: reviewerPrimary,
      first_name: "Reviewer",
      practice_name: "ASN Review",
      plan: "founding_monthly",
      resume_token: token(),
      unsubscribe_token: token(),
      email1_sent_at: now,
      email2_sent_at: now,
      email3_sent_at: now,
      code: sampleCode,
      code_expires_at: sampleExpiry.toISOString(),
      // Stopped from birth — the cron skips it; the links still resolve.
      stopped_at: now,
      stop_reason: "completed",
    };
    const { data, error } = await db()
      .from("pending_registrations")
      .insert(row as never)
      .select("id")
      .single();
    if (!error && data) {
      sample = {
        id: (data as { id: string }).id,
        email: row.email,
        first_name: row.first_name,
        resume_token: row.resume_token,
        unsubscribe_token: row.unsubscribe_token,
      };
      liveLinks = true;
    }
  } catch {
    /* table not migrated yet — fall back to inert sample links */
  }

  const drafts = [
    renderEmail1(sample),
    renderEmail2(sample),
    renderEmail3(sample, sampleCode, sampleExpiry),
  ];

  // Without a real row, point the buttons at the plain signup page so
  // they still land somewhere sensible.
  const draftResume = `${origin()}/join/member?resume=${encodeURIComponent(sample.resume_token)}`;
  const draftResumeJoin = `${origin()}/join/member?resume=${encodeURIComponent(sample.resume_token)}`;
  const signupUrl = `${origin()}/join/member`;

  const sent: string[] = [];
  for (const raw of drafts) {
    const msg = liveLinks
      ? raw
      : {
          subject: raw.subject,
          html: raw.html.split(draftResumeJoin).join(signupUrl).split(draftResume).join(signupUrl),
          text: raw.text.split(draftResumeJoin).join(signupUrl).split(draftResume).join(signupUrl),
        };
    await tx.sendMail(
      applyEmailSandbox({
        from: FROM,
        replyTo: REPLY_TO,
        to: reviewers.join(", "),
        subject: `[DRAFT] ${msg.subject}`,
        html: msg.html,
        text: msg.text,
        attachments: logoAttachment(),
      }),
    );
    sent.push(msg.subject);
  }
  return { sent, liveLinks };
}
