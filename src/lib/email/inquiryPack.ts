import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";

/**
 * Sends the Beacon inquiry pack email. Transactional-first: if the
 * dedicated aestheticsuccessnetwork.com mailbox is configured (SMTP_TX_*)
 * it sends From support@aestheticsuccessnetwork.com; otherwise it falls
 * back to the marketing mailbox so From stays SPF-aligned with whatever
 * domain actually authenticates. Reply-To is always support@.
 */

const SUPPORT = process.env.MAIL_REPLYTO_SUPPORT ?? "support@aestheticsuccessnetwork.com";
const HOTLINE_PHONE = "(855) 567-5323";

type TransportChoice = { transport: Transporter; from: string };

function pickTransport(): TransportChoice | null {
  // 1. Transactional mailbox (support@) — preferred.
  if (process.env.SMTP_TX_HOST && process.env.SMTP_TX_USER && process.env.SMTP_TX_PASS) {
    const port = Number(process.env.SMTP_TX_PORT ?? "465");
    return {
      transport: nodemailer.createTransport({
        host: process.env.SMTP_TX_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_TX_USER, pass: process.env.SMTP_TX_PASS },
      }),
      from: process.env.MAIL_FROM_TX ?? "Aesthetic Success Network <support@aestheticsuccessnetwork.com>",
    };
  }
  // 2. Marketing mailbox (hello@) — fallback so it still delivers.
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT ?? "465");
    return {
      transport: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      }),
      from: process.env.WAITLIST_EMAIL_FROM ?? "Aesthetic Success Network <hello@aestheticsuccessnetwork.com>",
    };
  }
  return null;
}

function renderHtml(input: { memberName: string; pdfUrl: string; question: string }): string {
  const q = input.question
    ? `<p style="margin:0 0 18px;color:#3B4A55;font-style:italic">You asked: &ldquo;${escapeHtml(input.question)}&rdquo;</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FBF8F1;font-family:Arial,Helvetica,sans-serif;color:#3B4A55">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <img src="${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com"}/asn-logo-email.png" alt="Aesthetic Success Network" width="180" style="display:block;margin:0 0 12px;max-width:180px;height:auto;" />
    <h1 style="font-size:22px;color:#0A1A2F;margin:0 0 14px">Thanks, the team will be in touch</h1>
    <p style="margin:0 0 14px">Hi ${escapeHtml(input.memberName)}, we have your question and a member of the team will get back to you in writing, by text and email, within <strong>2 to 3 business days</strong>.</p>
    ${q}
    <p style="margin:0 0 20px">In the meantime, here is a pack of everything your membership gives you right now: every expert, partner offer, and kit in the portal.</p>
    <p style="margin:0 0 26px">
      <a href="${escapeHtml(input.pdfUrl)}" style="display:inline-block;background:#0A1A2F;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px">Download your ASN pack (PDF)</a>
    </p>
    <p style="margin:0 0 4px;font-size:13px">It is also attached to this email, and waiting in your portal Inbox.</p>
    <hr style="border:none;border-top:1px solid #E6DDCF;margin:24px 0" />
    <p style="font-size:12px;color:#7A8590;margin:0 0 8px">Prefer to leave a voicemail? Call the Expert Hotline on <strong>${HOTLINE_PHONE}</strong>, or reply to this email. It reaches <a href="mailto:${escapeHtml(SUPPORT)}" style="color:#A07823">${escapeHtml(SUPPORT)}</a>.</p>
    <p style="font-size:12px;color:#7A8590;margin:0">Aesthetic Success Network &middot; Powered by Business of Aesthetics</p>
  </div></body></html>`;
}

export async function sendInquiryPackEmail(input: {
  to: string;
  memberName: string;
  pdfUrl: string;
  pdfBuffer: Buffer;
  question: string;
}): Promise<{ sent: boolean }> {
  const choice = pickTransport();
  if (!choice) {
    console.info("[inquiry-pack] no SMTP configured; email skipped", { to: input.to });
    return { sent: false };
  }
  await choice.transport.sendMail(
    applyEmailSandbox({
      from: choice.from,
      to: input.to,
      replyTo: SUPPORT,
      subject: "Your Aesthetic Success Network pack",
      html: renderHtml(input),
      attachments: [{ filename: "ASN-member-pack.pdf", content: input.pdfBuffer, contentType: "application/pdf" }],
    }),
  );
  return { sent: true };
}
