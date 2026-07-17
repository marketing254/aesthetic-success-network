import "server-only";

/**
 * Email transport, tiered like the DMN reference:
 *   1. Generic SMTP  — SMTP_HOST + SMTP_USER + SMTP_PASS
 *   2. Gmail SMTP    — GMAIL_USER + GMAIL_APP_PASSWORD (dev/legacy)
 *   3. Resend API    — RESEND_API_KEY
 *   4. Console log   — no provider configured (dev fallback, never throws)
 *
 * All sends are fail-soft for callers: wrap in try/catch at the call site
 * so a mail outage never blocks a signup.
 */

const FROM_EMAIL =
  process.env.WAITLIST_EMAIL_FROM ??
  "Aesthetic Success Network <support@aestheticsuccessnetwork.com>";

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Per-purpose sender (e.g. members@/experts@/partners@). The SMTP auth
   * account stays the same; Rackspace allows same-domain send-as. */
  from?: string;
};

export async function sendEmail(
  input: SendInput,
): Promise<{ id?: string; transport: "smtp" | "gmail" | "resend" | "log" }> {
  const { to, subject, html, text, replyTo } = input;
  const from = input.from ?? FROM_EMAIL;

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
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    console.info("[email] sent via SMTP", { to, messageId: info.messageId });
    return { id: info.messageId, transport: "smtp" };
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    console.info("[email] sent via Gmail SMTP", { to, messageId: info.messageId });
    return { id: info.messageId, transport: "gmail" };
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      throw new Error(`Resend failed with ${res.status}: ${details.slice(0, 300)}`);
    }
    const data = (await res.json()) as { id?: string };
    console.info("[email] sent via Resend", { to, messageId: data?.id });
    return { id: data?.id, transport: "resend" };
  }

  console.info("[email] no provider configured — logging instead", { to, subject });
  console.info(text);
  return { transport: "log" };
}
