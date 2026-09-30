import "server-only";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import { escapeHtml } from "./escapeHtml";

/**
 * Fallback sender for the admin 6-digit sign-in code.
 *
 * Primary path: Supabase Auth emails the code through the dashboard SMTP.
 * When that send fails (SMTP misconfigured, provider hiccup), the login
 * route generates the code with the Admin API and emails it here through
 * the app's own SMTP_* mailbox so admins are never locked out.
 *
 * This is an authentication code addressed to the exact inbox the admin
 * typed (already allow-listed), so it is NOT run through the email
 * sandbox redirect. It never throws silently: the caller surfaces errors.
 */
const BRAND = "Aesthetic Success Network";
const FROM =
  process.env.MAIL_FROM_TX ??
  process.env.WAITLIST_EMAIL_FROM ??
  `${BRAND} <support@aestheticsuccessnetwork.com>`;
const SUPPORT = process.env.MAIL_REPLYTO_SUPPORT ?? "support@aestheticsuccessnetwork.com";

const FONT_DISPLAY = "'Fraunces','Iowan Old Style',Baskerville,'Times New Roman',Georgia,serif";
const FONT_BODY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";

function html(code: string): string {
  const c = escapeHtml(code);
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:28px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1a1a1a;border-radius:16px 16px 0 0;padding:22px 32px;">
        ${emailBrandHeader({ dark: true })}
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e5dfd2;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
        <h1 style="margin:0 0 16px;font-family:${FONT_DISPLAY};font-weight:500;font-size:24px;line-height:1.2;color:#0a1320;">Your sign-in code</h1>
        <p style="margin:0 0 20px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#3d4653;">Enter this code on the ${BRAND} sign-in page. It expires in a few minutes and works once.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 22px;">
          <div style="display:inline-block;background:#f7f5f0;border:1px solid #d9a84b;border-radius:14px;padding:18px 34px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0a1320;">${c}</div>
        </td></tr></table>
        <p style="margin:0 0 14px;font-family:${FONT_BODY};font-size:13.5px;line-height:1.6;color:#5c6673;">If you did not try to sign in, you can ignore this email. The code is useless without access to this inbox.</p>
        <hr style="border:none;border-top:1px solid #e5dfd2;margin:22px 0;">
        <p style="margin:0;font-family:${FONT_BODY};font-size:12.5px;line-height:1.6;color:#8b8577;">${BRAND} &middot; Ekwa Marketing Inc. &middot; ${escapeHtml(SUPPORT)}</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

export async function sendAdminCodeEmail(to: string, code: string): Promise<void> {
  const nodemailer = (await import("nodemailer")).default;
  const host = process.env.SMTP_TX_HOST ?? process.env.SMTP_HOST;
  const user = process.env.SMTP_TX_USER ?? process.env.SMTP_USER;
  const pass = process.env.SMTP_TX_PASS ?? process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_TX_PORT ?? process.env.SMTP_PORT ?? "465");

  let transporter;
  if (host && user && pass) {
    transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  } else {
    throw new Error("No SMTP_* or GMAIL_* transport configured for the sign-in code fallback.");
  }

  await transporter.sendMail({
    from: FROM,
    to,
    replyTo: SUPPORT,
    subject: `Your ${BRAND} sign-in code: ${code}`,
    html: html(code),
    text: `Your ${BRAND} sign-in code is ${code}. Enter it on the sign-in page. It expires in a few minutes and works once. If you did not try to sign in, ignore this email.`,
  });
  console.info("[admin:login] sign-in code sent via app SMTP fallback", { to });
}
