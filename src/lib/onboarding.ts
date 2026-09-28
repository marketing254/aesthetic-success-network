import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getOpenAI, ASSISTANT_MODEL } from "@/lib/ai/assistant";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox, auditBccList, testMemberEmails } from "@/lib/email/sandbox";

/**
 * Member onboarding — the FULLY AUTOMATED four-email sequence.
 * (The BCC keeps eyes on every send.)
 *
 *   Day 0  "You're in! Start here (2 minutes)"  — sent by the Stripe
 *          webhook the moment payment completes. Founding number + tour.
 *   Day 3  "Start with this one"                — AI matches the member's
 *          signup "biggest challenge" to a kit. Out-of-box challenge →
 *          NO kit email; member details go to the team Slack channel.
 *   Day 7  "Stuck on something? We'll go find the answer" — the hotline.
 *   Day 14 "Quick one: what's working, what isn't" — feedback ask.
 *
 * Days 3/7/14 are processed by the hourly cron (/api/cron/onboarding),
 * anchored to the Day 0 send time. Every send:
 *   - goes out as Lester De Alwis <founding@aestheticsuccessnetwork.com>
 *   - is BCC'd to EMAIL_AUDIT_BCC (standing team rule)
 *   - is recorded in member_onboarding_emails (one row per member+kind,
 *     enforced by a unique index — double-sends are impossible)
 * Members who cancel or get deactivated drop out of the sequence.
 */

const FOUNDING_EMAIL = process.env.MAIL_REPLYTO_FOUNDING ?? "founding@aestheticsuccessnetwork.com";
const FROM_MEMBER_FACING = `Lester De Alwis <${FOUNDING_EMAIL}>`;
const REPLY_TO = FOUNDING_EMAIL;
// Every member-facing send is silently copied to the team (BCC — the
// member never sees these addresses). EMAIL_AUDIT_BCC, comma separated.
const MEMBER_SEND_BCC = auditBccList();

// Internal test accounts — excluded from founding-number math so real
// members get honest numbers (#1, #2, …). TEST_MEMBER_EMAILS, default empty.
const TEST_MEMBER_EMAILS = testMemberEmails();

const DAY_MS = 24 * 60 * 60 * 1000;
export const SEQUENCE_DAYS = { kit_recommendation: 3, day7_hotline: 7, day14_feedback: 14 } as const;

// ── transport + branding ────────────────────────────────────────────────

function origin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
}

function tourUrl(): string {
  return `${origin()}/#tour`;
}

/** Optional poster image for the Day 0 tour link. Unset = no image (never a broken one). */
function tourPosterUrl(): string | null {
  const v = process.env.ONBOARDING_TOUR_POSTER_URL?.trim();
  return v ? v : null;
}

function txTransport(): Transporter | null {
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

/** Branded shell shared by every member-facing onboarding email. */
export function memberEmailLayout(bodyHtml: string): string {
  return `<!doctype html>
<html style="background:#F6F1E7;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aesthetic Success Network</title></head>
<body style="background:#F6F1E7;margin:0;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;">
  <tr><td style="background:#FFFFFF;border:1px solid #E6DDCF;border-radius:14px;overflow:hidden;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:26px 28px 18px;text-align:center;">
        <img src="cid:${LOGO_CID}" alt="Aesthetic Success Network" width="200" style="display:inline-block;max-width:200px;height:auto;">
      </td></tr>
      <tr><td style="padding:0 28px;"><div style="height:2px;background:#D9A84B;border-radius:2px;"></div></td></tr>
      <tr><td style="padding:24px 32px 8px;color:#1A1A1A;font-size:15px;line-height:1.65;">
${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 32px 24px;">
        <div style="border-top:1px solid #EFE8DA;padding-top:16px;color:#7A8590;font-size:12px;line-height:1.6;text-align:center;">
          Aesthetic Success Network &middot; Powered by Business of Aesthetics<br>
          Questions? Just reply. A real person reads every message.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function emailCtaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;"><tr>
<td style="background:#C8922E;border-radius:10px;text-align:center;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 34px;color:#14181F;font-weight:800;font-size:15px;text-decoration:none;">${label}</a>
</td></tr></table>`;
}

const SIGNATURE = `<p style="margin:0;">Warmly,<br>
<b style="color:#0A1A2F;">Lester De Alwis</b><br>
<span style="color:#3B4A55;">Co-Founder<br>Aesthetic Success Network<br>Powered by Business of Aesthetics</span></p>`;

// ── templates ───────────────────────────────────────────────────────────

function renderWelcome(
  firstName: string,
  foundingNumber: number | null,
  interval: string | null = null,
): { subject: string; html: string } {
  // Annual founding members pay $490/yr; everyone else on founding is $49/mo.
  const isAnnual = interval === "year" || interval === "annual";
  const rateLine = isAnnual
    ? "Your rate is locked at $490 a year for as long as your membership stays active, even once it goes up for everyone who joins after you."
    : "Your rate is locked at $49 a month for as long as your membership stays active, even once it goes up for everyone who joins after you.";
  const badge =
    foundingNumber !== null && foundingNumber <= 100
      ? `<div style="background:#FBF8F1;border:1px solid #D9A84B;border-radius:10px;padding:14px 18px;margin:0 0 16px;text-align:center;">
  <span style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A07823;text-transform:uppercase;">Founding member #${foundingNumber}</span><br>
  <span style="font-size:13.5px;color:#3B4A55;">${rateLine}</span>
</div>`
      : "";
  const poster = tourPosterUrl();
  const posterHtml = poster
    ? `<p style="text-align:center;margin:18px 0;">
<a href="${escapeHtml(tourUrl())}"><img src="${escapeHtml(poster)}" alt="Watch the 2 minute portal tour" width="540" style="max-width:100%;border-radius:10px;border:1px solid #E6DDCF;"></a></p>`
    : "";
  const body = `<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>

<p style="margin:0 0 14px;">Welcome, you're in! Thank you for joining us.</p>

${badge}

<p style="margin:0 0 14px;"><b>Before anything else, watch this. It takes two minutes</b> and shows
you exactly what's inside and where to find it, which is quicker than us writing it all out.</p>
${posterHtml}
${emailCtaButton(tourUrl(), "Watch the 2 minute tour &rarr;")}

<p style="margin:0 0 14px;">That's the only thing to do today. There's a growing library of kits in
there and it's tempting to try to see it all at once. Don't. We'll point you at a great place to
start in a couple of days.</p>

<p style="margin:0 0 14px;">And that's not all that's coming. There's more in the works beyond the
library, we'll tell you about it properly soon.</p>

<p style="margin:0 0 18px;"><b>One more thing, and we mean it.</b> If anything is confusing, broken,
missing, or just plain annoying, reply to this email or write to
<a href="mailto:${escapeHtml(FOUNDING_EMAIL)}" style="color:#A07823;font-weight:700;">${escapeHtml(FOUNDING_EMAIL)}</a>.
A real person reads every message.</p>

${SIGNATURE}`;
  return { subject: "You're in! Start here (2 minutes)", html: memberEmailLayout(body) };
}

function renderKit(opts: {
  firstName: string;
  challenge: string;
  kitTitle: string;
  kitUrl: string;
  matchKind: "best" | "closest";
}): { subject: string; html: string } {
  const { firstName, challenge, kitTitle, kitUrl, matchKind } = opts;
  const intro =
    matchKind === "best"
      ? `You mentioned your biggest challenge right now is <b>${escapeHtml(challenge)}</b>, so rather than pointing you at the whole library, here's the one place to start.`
      : `You mentioned your biggest challenge right now is <b>${escapeHtml(challenge)}</b>. There isn't a kit aimed squarely at that yet, but this is the closest starting point in the library today, and we're adding new kits every week.`;
  const body = `<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>

<p style="margin:0 0 14px;">${intro}</p>

<div style="background:#FBF8F1;border:1px solid #E6DDCF;border-radius:10px;padding:18px 20px;margin:18px 0;">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A07823;text-transform:uppercase;margin-bottom:6px;">Your starting kit</div>
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0A1A2F;line-height:1.3;">${escapeHtml(kitTitle)}</div>
  <div style="font-size:13.5px;color:#3B4A55;margin-top:6px;">Action guide &middot; checklist &middot; worksheet &middot; training video</div>
  ${emailCtaButton(kitUrl, "Open the kit &rarr;")}
  <div style="font-size:12.5px;color:#7A8590;text-align:center;">You'll be asked to sign in first. Use the email you joined with, and the kit opens right after.</div>
</div>

<p style="margin:0 0 14px;">Open the action guide and the worksheet together. You'll finish knowing
something about your practice you didn't know this morning.</p>

<p style="margin:0 0 14px;">While you're in there, worth knowing: members already get real savings
from our partners, and every deal is listed with its full terms on the partner's page in the
portal. We're adding more of these as partners confirm them.</p>

<p style="margin:0 0 18px;">If something else is more pressing right now, just reply and tell us
what it is. We'll point you at the right kit ourselves.</p>

${SIGNATURE}`;
  return { subject: "Start with this one", html: memberEmailLayout(body) };
}

function renderHotline(firstName: string): { subject: string; html: string } {
  const body = `<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>

<p style="margin:0 0 14px;">A week in, so here's the part of your membership almost nobody uses
without being told about it.</p>

<div style="background:#FBF8F1;border:1px solid #E6DDCF;border-radius:10px;padding:18px 20px;margin:18px 0;text-align:center;">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A07823;text-transform:uppercase;margin-bottom:6px;">The Expert Hotline</div>
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;color:#0A1A2F;line-height:1.35;">Bring us any practice problem,<br>and we'll go and find you the answer.</div>
</div>

<p style="margin:0 0 14px;">Here's how it works. You leave the question as a voicemail on the
hotline (or reply to this email), our team routes it to the right experts in the network, and
within <b>2 to 3 business days</b> you get a written action plan back by text and email, plus who
to talk to if you want to go further. It's not a live line, and nobody can pay to jump the queue.
It's a real answer from people who've actually solved that exact problem.</p>

<p style="margin:0 0 14px;">Ask us anything you're genuinely stuck on. Staffing, scheduling,
pricing, consult conversion, a number that won't move, a conversation you're dreading. Nothing is
too small.</p>

<p style="margin:0 0 18px;"><b>Reply to this email with the one thing on your mind</b> and we'll
get it started.</p>

${SIGNATURE}`;
  return { subject: "Stuck on something? We'll go find the answer", html: memberEmailLayout(body) };
}

function renderFeedback(firstName: string): { subject: string; html: string } {
  const body = `<p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>

<p style="margin:0 0 14px;">Two weeks in, and this is the email where we ask you for something.</p>

<p style="margin:0 0 14px;">You joined early enough to shape this rather than just use a finished
product, so we'd rather have your honest take than your polite one.</p>

<div style="background:#FBF8F1;border:1px solid #E6DDCF;border-radius:10px;padding:18px 22px;margin:18px 0;">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A07823;text-transform:uppercase;margin-bottom:10px;">Three quick questions. Short answers are perfect.</div>
  <p style="margin:0 0 10px;font-size:14.5px;"><b>1. What were you expecting from us when you joined?</b><br><span style="color:#3B4A55;">Not what we said, what you actually hoped membership would do for you.</span></p>
  <p style="margin:0 0 10px;font-size:14.5px;"><b>2. What would you want us to build or improve next?</b><br><span style="color:#3B4A55;">Big or small, nothing is too minor to mention.</span></p>
  <p style="margin:0;font-size:14.5px;"><b>3. What have you actually opened or used so far?</b><br><span style="color:#3B4A55;">Not what looked interesting, what you opened.</span></p>
</div>

<p style="margin:0 0 14px;"><b>Reply straight to this email.</b> It comes to Lester directly, and
every reply gets read.</p>

<p style="margin:0 0 14px;">One thing we're building right now, since you asked what's next before
we even sent this email: <b>monthly live AMAs and CE sessions</b> where you can put questions to
the experts directly. No date yet. We'll tell you the moment there is one.</p>

<p style="margin:0 0 18px;">And if anything has been disappointing, say so plainly. We'd rather hear
it now, while we can still do something about it.</p>

${SIGNATURE}`;
  return { subject: "Quick one: what's working, what isn't", html: memberEmailLayout(body) };
}

// ── sending + audit ─────────────────────────────────────────────────────

type SequenceKind =
  | "day0_welcome"
  | "kit_recommendation"
  | "day7_hotline"
  | "day14_feedback"
  | "trial_payment_reminder";

/** Send one member email (BCC team) and record it. Insert-first: the
 *  unique (member_id, kind) index makes a concurrent duplicate a no-op. */
async function sendAndRecord(opts: {
  memberId: string;
  memberEmail: string;
  kind: SequenceKind;
  subject: string;
  html: string;
  challenge?: string | null;
  kitSlug?: string | null;
  kitTitle?: string | null;
  matchKind?: string | null;
}): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data: row, error: insErr } = await sb
    .from("member_onboarding_emails")
    .insert({
      member_id: opts.memberId,
      kind: opts.kind,
      challenge: opts.challenge ?? null,
      kit_slug: opts.kitSlug ?? null,
      kit_title: opts.kitTitle ?? null,
      match_kind: opts.matchKind ?? null,
      subject: opts.subject,
      html: opts.html,
      status: "sending",
      approved_by: "auto (sequence)",
    })
    .select("id")
    .single();
  if (insErr || !row) {
    // Unique-index conflict = another run already claimed this send.
    if (!/duplicate|unique/i.test(insErr?.message ?? "")) {
      console.error(`[onboarding] ${opts.kind} insert failed:`, insErr);
    }
    return false;
  }

  const transport = txTransport();
  if (!transport) {
    console.error("[onboarding] SMTP_TX not configured — cannot send");
    await sb.from("member_onboarding_emails").update({ status: "transport_failed" }).eq("id", row.id);
    return false;
  }

  try {
    await transport.sendMail(
      applyEmailSandbox({
        from: FROM_MEMBER_FACING,
        to: opts.memberEmail,
        bcc: MEMBER_SEND_BCC,
        replyTo: REPLY_TO,
        attachments: logoAttachment(),
        subject: opts.subject,
        html: opts.html,
      }),
    );
    await sb
      .from("member_onboarding_emails")
      .update({ status: "sent", sent_to_member_at: new Date().toISOString() })
      .eq("id", row.id);
    return true;
  } catch (err) {
    console.error(`[onboarding] ${opts.kind} send failed:`, err);
    // Row is removed so the next cron run retries the send cleanly.
    await sb.from("member_onboarding_emails").delete().eq("id", row.id);
    return false;
  }
}

/** Position among founding members (test accounts excluded). Null when
 *  past #100 — the welcome then simply drops the founding line. */
async function foundingNumberFor(memberId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .from("members")
    .select("id, email, created_at")
    .eq("founding_member_locked", true)
    .order("created_at", { ascending: true });
  const real = (rows ?? []).filter((r) => !TEST_MEMBER_EMAILS.has(r.email.toLowerCase()));
  const idx = real.findIndex((r) => r.id === memberId);
  if (idx === -1) return null;
  const n = idx + 1;
  return n <= 100 ? n : null;
}

// ── AI kit matching ─────────────────────────────────────────────────────

type KitOption = { slug: string; title: string; summary: string | null };
type MatchResult = { match: "best" | "closest" | "none"; slug: string | null; reason: string };

async function loadKitCatalog(): Promise<KitOption[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("resources")
    .select("topic_slug, topic_title, topic_summary")
    .eq("is_published", true)
    .eq("submission_status", "approved");
  const seen = new Map<string, KitOption>();
  for (const r of data ?? []) {
    if (!seen.has(r.topic_slug)) {
      seen.set(r.topic_slug, { slug: r.topic_slug, title: r.topic_title, summary: r.topic_summary });
    }
  }
  return [...seen.values()];
}

async function matchKit(challenge: string, kits: KitOption[]): Promise<MatchResult> {
  const openai = getOpenAI();
  const catalog = kits
    .map((k) => `- slug: ${k.slug} | title: ${k.title}${k.summary ? ` | about: ${k.summary}` : ""}`)
    .join("\n");
  const completion = await openai.chat.completions.create({
    model: ASSISTANT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You match an aesthetic practice owner's stated biggest challenge to ONE kit from a catalog.",
          "Rules:",
          '- If a kit clearly addresses the challenge, answer match:"best" with its slug.',
          '- If nothing addresses it squarely but one is a reasonable nearby starting point, answer match:"closest" with its slug.',
          '- If the challenge is outside anything the catalog covers (or is not a practice-management topic at all), answer match:"none" with slug:null. Do NOT stretch a kit to fit.',
          'Respond as JSON: {"match":"best"|"closest"|"none","slug":string|null,"reason":"one sentence"}',
        ].join("\n"),
      },
      { role: "user", content: `Member's biggest challenge: "${challenge}"\n\nKit catalog:\n${catalog}` },
    ],
  });
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Partial<MatchResult>;
    const slug = typeof parsed.slug === "string" ? parsed.slug : null;
    const valid = slug ? kits.some((k) => k.slug === slug) : false;
    if ((parsed.match === "best" || parsed.match === "closest") && valid) {
      return { match: parsed.match, slug, reason: parsed.reason ?? "" };
    }
    return { match: "none", slug: null, reason: parsed.reason ?? "no valid match" };
  } catch {
    return { match: "none", slug: null, reason: "model response unparsable" };
  }
}

/** Escape the three characters Slack mrkdwn treats specially. */
function slackText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Day-3 no-match note for the team. Posts only when SLACK_ENABLED=true and
 * credentials exist (bot token + channel, or an incoming webhook);
 * otherwise logs a console.info line and returns false.
 */
async function postNoMatchToSlack(
  member: { name: string; email: string; practice: string | null; challenge: string },
  reason: string,
): Promise<boolean> {
  const text = [
    ":mailbox_with_no_mail: *New member: no kit matched their challenge*",
    `*Member:* ${slackText(member.name)} (${slackText(member.email)})`,
    member.practice ? `*Practice:* ${slackText(member.practice)}` : null,
    `*Their biggest challenge:* ${slackText(member.challenge)}`,
    `*Why no kit was sent:* ${slackText(reason)}`,
    `No day-3 kit email was sent. Someone should reply to them personally from ${FOUNDING_EMAIL}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const enabled = process.env.SLACK_ENABLED === "true";
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_INQUIRIES_CHANNEL_ID;
  const webhook = process.env.SLACK_INQUIRIES_WEBHOOK_URL;
  if (!enabled || !((token && channel) || webhook)) {
    console.info(
      `[onboarding] slack ${enabled ? "not configured" : "disabled (SLACK_ENABLED != true)"}; no-match note for ${member.email} logged only`,
    );
    return false;
  }
  try {
    if (token && channel) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, text }),
      });
      const body = (await res.json()) as { ok?: boolean };
      return !!body.ok;
    }
    await fetch(webhook as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    return false;
  }
}

function renderTrialReminder(opts: {
  firstName: string;
  amountLabel: string; // e.g. "$49/mo" or "$441/yr"
  chargeDate: string; // formatted
}): { subject: string; html: string } {
  const body = `<p style="margin:0 0 14px;">Hi ${escapeHtml(opts.firstName)},</p>

<p style="margin:0 0 14px;">A quick heads-up, exactly as we promised when you joined: your free
months end soon.</p>

<div style="background:#FBF8F1;border:1px solid #D9A84B;border-radius:10px;padding:16px 20px;margin:18px 0;text-align:center;">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#A07823;text-transform:uppercase;margin-bottom:6px;">Your first payment</div>
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0A1A2F;">${escapeHtml(opts.amountLabel)} on ${escapeHtml(opts.chargeDate)}</div>
  <div style="font-size:13px;color:#3B4A55;margin-top:6px;">Your founding rate, locked for as long as your membership stays active, even when the price rises for everyone else.</div>
</div>

<p style="margin:0 0 14px;">If you're staying, there's nothing to do. Your card on file will be
charged on that date and nothing changes in your portal.</p>

<p style="margin:0 0 18px;">If you'd rather not continue, cancel any time before then from the
billing section of your portal, or just reply to this email and we'll take care of it. You won't
be charged anything.</p>

${SIGNATURE}`;
  return { subject: `Your membership starts ${opts.chargeDate}: a heads-up`, html: memberEmailLayout(body) };
}

/**
 * Amount label per tier. ASN has two prices: founding ($49/mo, or the
 * $441/yr promo-annual) and standard ($199/mo, $1,990/yr). There is no
 * $99 tier; the legacy "early" plan key maps to the standard amounts so
 * an old row can never crash the cron.
 */
const TIER_AMOUNT: Record<string, { monthly: string; annual: string }> = {
  founding: { monthly: "$49/mo", annual: "$441/yr" },
  standard: { monthly: "$199/mo", annual: "$1,990/yr" },
  early: { monthly: "$199/mo", annual: "$1,990/yr" },
};

/**
 * The spec's promise on the payment card: "We will remind you by email
 * 7 days before your first payment." Run hourly by the cron: any TRIALING
 * member whose first charge (current_period_end) is within the next
 * 7 days gets exactly one reminder. This is what prevents chargebacks —
 * people don't object to being charged, they object to being surprised.
 */
export async function processTrialReminders(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const sent: string[] = [];
  const now = Date.now();

  const { data: trialing } = await sb
    .from("members")
    .select("id, first_name, last_name, email, status, subscription_status, tier, subscription_interval, current_period_end")
    .eq("subscription_status", "trialing")
    .eq("status", "active")
    .not("current_period_end", "is", null);

  for (const m of trialing ?? []) {
    if (TEST_MEMBER_EMAILS.has(m.email.toLowerCase())) continue;
    const chargeAt = new Date(m.current_period_end!).getTime();
    // Window: charge is in the future but 7 days or less away.
    if (!(chargeAt > now && chargeAt - now <= 7 * DAY_MS)) continue;

    const { data: existing } = await sb
      .from("member_onboarding_emails")
      .select("id")
      .eq("member_id", m.id)
      .eq("kind", "trial_payment_reminder")
      .limit(1);
    if (existing && existing.length > 0) continue;

    const amounts = TIER_AMOUNT[m.tier ?? "founding"] ?? TIER_AMOUNT.founding;
    const amountLabel = m.subscription_interval === "year" || m.subscription_interval === "annual" ? amounts.annual : amounts.monthly;
    const chargeDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(chargeAt));
    const rendered = renderTrialReminder({
      firstName: m.first_name ?? "there",
      amountLabel,
      chargeDate,
    });
    const ok = await sendAndRecord({
      memberId: m.id,
      memberEmail: m.email,
      kind: "trial_payment_reminder",
      subject: rendered.subject,
      html: rendered.html,
    });
    if (ok) sent.push(m.email);
  }
  return sent;
}

// ── entry points ────────────────────────────────────────────────────────

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  practice_name: string | null;
  biggest_challenge: string | null;
  status: string;
  subscription_status: string | null;
};

function memberEligible(m: MemberRow): boolean {
  return (
    m.status === "active" &&
    (m.subscription_status === "active" || m.subscription_status === "trialing") &&
    !TEST_MEMBER_EMAILS.has(m.email.toLowerCase())
  );
}

/**
 * Called by the Stripe webhook the moment payment completes: sends the
 * Day 0 welcome immediately. Idempotent; never throws (the webhook must
 * always succeed).
 */
export async function onMemberActivated(memberId: string): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data: existing } = await sb
      .from("member_onboarding_emails")
      .select("id")
      .eq("member_id", memberId)
      .eq("kind", "day0_welcome")
      .limit(1);
    if (existing && existing.length > 0) return;

    const { data: member } = await sb
      .from("members")
      .select("id, first_name, last_name, email, practice_name, biggest_challenge, status, subscription_status, subscription_interval")
      .eq("id", memberId)
      .maybeSingle();
    if (!member || TEST_MEMBER_EMAILS.has(member.email.toLowerCase())) return;

    const foundingNumber = await foundingNumberFor(memberId);
    const rendered = renderWelcome(member.first_name ?? "there", foundingNumber, member.subscription_interval ?? null);
    await sendAndRecord({
      memberId,
      memberEmail: member.email,
      kind: "day0_welcome",
      subject: rendered.subject,
      html: rendered.html,
    });
  } catch (err) {
    console.error("[onboarding] day0 failed:", err);
  }
}

/**
 * Hourly cron: advance every member through days 3/7/14, anchored to
 * their Day 0 send time. Returns a small summary for the cron log.
 */
export async function processOnboardingQueue(): Promise<{
  checked: number;
  sent: string[];
  slack: string[];
}> {
  const sb = getSupabaseAdmin();
  const sent: string[] = [];
  const slack: string[] = [];

  // Every member with a Day 0 send is in the sequence.
  const { data: anchors } = await sb
    .from("member_onboarding_emails")
    .select("member_id, sent_to_member_at")
    .eq("kind", "day0_welcome")
    // "approved_sent" = rows from a retired approval flow.
    .in("status", ["sent", "approved_sent"])
    .not("sent_to_member_at", "is", null);
  if (!anchors || anchors.length === 0) return { checked: 0, sent, slack };

  const memberIds = anchors.map((a) => a.member_id);
  const [{ data: members }, { data: allRows }] = await Promise.all([
    sb
      .from("members")
      .select("id, first_name, last_name, email, practice_name, biggest_challenge, status, subscription_status")
      .in("id", memberIds),
    sb.from("member_onboarding_emails").select("member_id, kind").in("member_id", memberIds),
  ]);
  const memberMap = new Map((members ?? []).map((m) => [m.id, m as MemberRow]));
  const haveKind = new Set((allRows ?? []).map((r) => `${r.member_id}:${r.kind}`));

  let kits: KitOption[] | null = null; // lazy — only loaded if a day-3 is due
  const now = Date.now();

  for (const anchor of anchors) {
    const member = memberMap.get(anchor.member_id);
    if (!member || !memberEligible(member)) continue;
    const day0At = new Date(anchor.sent_to_member_at!).getTime();
    const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email;

    // Day 3 — AI kit recommendation
    if (
      now >= day0At + SEQUENCE_DAYS.kit_recommendation * DAY_MS &&
      !haveKind.has(`${member.id}:kit_recommendation`)
    ) {
      const challenge = (member.biggest_challenge ?? "").trim();
      kits = kits ?? (await loadKitCatalog());
      const match: MatchResult =
        challenge && kits.length > 0
          ? await matchKit(challenge, kits)
          : { match: "none", slug: null, reason: challenge ? "no kits published" : "member gave no challenge at signup" };

      if (match.match === "none" || !match.slug) {
        await postNoMatchToSlack(
          { name, email: member.email, practice: member.practice_name, challenge: challenge || "(not provided)" },
          match.reason,
        );
        await sb.from("member_onboarding_emails").insert({
          member_id: member.id,
          kind: "kit_recommendation",
          challenge: challenge || null,
          match_kind: "none",
          subject: "(no email: routed to Slack)",
          html: "",
          status: "no_match_slack",
          approved_by: "auto (sequence)",
        });
        slack.push(member.email);
      } else {
        const kit = kits.find((k) => k.slug === match.slug)!;
        const rendered = renderKit({
          firstName: member.first_name ?? "there",
          challenge,
          kitTitle: kit.title,
          kitUrl: `${origin()}/dashboard/resources/${kit.slug}`,
          matchKind: match.match,
        });
        const ok = await sendAndRecord({
          memberId: member.id,
          memberEmail: member.email,
          kind: "kit_recommendation",
          subject: rendered.subject,
          html: rendered.html,
          challenge,
          kitSlug: kit.slug,
          kitTitle: kit.title,
          matchKind: match.match,
        });
        if (ok) sent.push(`day3→${member.email}`);
      }
    }

    // Day 7 — hotline
    if (now >= day0At + SEQUENCE_DAYS.day7_hotline * DAY_MS && !haveKind.has(`${member.id}:day7_hotline`)) {
      const rendered = renderHotline(member.first_name ?? "there");
      const ok = await sendAndRecord({
        memberId: member.id,
        memberEmail: member.email,
        kind: "day7_hotline",
        subject: rendered.subject,
        html: rendered.html,
      });
      if (ok) sent.push(`day7→${member.email}`);
    }

    // Day 14 — feedback
    if (now >= day0At + SEQUENCE_DAYS.day14_feedback * DAY_MS && !haveKind.has(`${member.id}:day14_feedback`)) {
      const rendered = renderFeedback(member.first_name ?? "there");
      const ok = await sendAndRecord({
        memberId: member.id,
        memberEmail: member.email,
        kind: "day14_feedback",
        subject: rendered.subject,
        html: rendered.html,
      });
      if (ok) sent.push(`day14→${member.email}`);
    }
  }

  return { checked: anchors.length, sent, slack };
}
