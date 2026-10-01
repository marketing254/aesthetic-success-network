/**
 * Slack notifications for the ASN Inquiries channel.
 *
 * Two supported configs:
 *   - Bot token + channel id (SLACK_BOT_TOKEN + SLACK_INQUIRIES_CHANNEL_ID)
 *     → chat.postMessage, returns the message ts for later threading.
 *   - Incoming webhook (SLACK_INQUIRIES_WEBHOOK_URL) → simpler, no ts.
 *
 * Nothing posts unless SLACK_ENABLED=true AND one of the configs above is
 * set; otherwise the call logs one console.info line and returns null.
 *
 * All failures are swallowed and logged — Slack being down must never
 * fail the member's request (the inquiry row + email are source of truth).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
const SUPPORT_EMAIL = process.env.MAIL_REPLYTO_SUPPORT ?? "support@aestheticsuccessnetwork.com";

/** Escape the three characters Slack mrkdwn treats specially. */
function mrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildBlocks(input: { memberName: string; email: string; question: string }): unknown[] {
  // Block-quote every line so multi-line questions stay inside the quote.
  const question = mrkdwn(input.question.slice(0, 2500))
    .split("\n")
    .map((l) => `>${l}`)
    .join("\n");
  const email = mrkdwn(input.email);
  return [
    { type: "header", text: { type: "plain_text", text: "New Member Inquiry", emoji: false } },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "*Beacon* · Aesthetic Success Network · Member portal" }],
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Member*\n${mrkdwn(input.memberName)}` },
        { type: "mrkdwn", text: `*Reply to*\n<mailto:${email}|${email}>` },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: `*Question*\n${question}` } },
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `✓ Member Pack emailed automatically  ·  ⏱ Reply within *2 to 3 business days* from ${SUPPORT_EMAIL}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Open Hotline Triage", emoji: false },
          url: `${APP_URL}/admin/hotline`,
        },
      ],
    },
  ];
}

export async function notifyInquirySlack(input: {
  memberName: string;
  email: string;
  question: string;
}): Promise<string | null> {
  const enabled = process.env.SLACK_ENABLED === "true";
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_INQUIRIES_CHANNEL_ID;
  const webhook = process.env.SLACK_INQUIRIES_WEBHOOK_URL;
  const configured = Boolean((token && channel) || webhook);

  if (!enabled || !configured) {
    console.info(
      `[slack] ${enabled ? "not configured" : "disabled (SLACK_ENABLED != true)"}; inquiry notification for ${input.email} skipped`,
    );
    return null;
  }

  const blocks = buildBlocks(input);
  const text = `New Beacon inquiry from ${input.memberName}`;

  try {
    if (token && channel) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ channel, text, blocks }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; ts?: string; error?: string };
      if (!j.ok) console.warn("[slack] chat.postMessage failed", j.error);
      return j.ts ?? null;
    }
    await fetch(webhook as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    return null;
  } catch (err) {
    console.warn("[slack] notify failed", err instanceof Error ? err.message : err);
    return null;
  }
}
