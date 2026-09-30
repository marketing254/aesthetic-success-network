import "server-only";
import { emailBrandHeader } from "@/lib/email/brandHeader";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { applyEmailSandbox } from "@/lib/email/sandbox";

/**
 * Founding invite email — sends the private /founding/<code> link to a
 * hand-picked expert / partner. This is the ONLY place the link is ever
 * surfaced; it's unguessable and expires. Attaches their personalized
 * agreement PDF so they can read it before clicking through.
 */

const DEFAULT_FROM = "Aesthetic Success Network <hello@aestheticsuccessnetwork.com>";
const DEFAULT_PDF_FILENAME = "ASN-Founding-Agreement.pdf";

function fromAddress(): string {
  return process.env.WAITLIST_EMAIL_FROM ?? DEFAULT_FROM;
}

function supportEmail(): string {
  return process.env.WAITLIST_SUPPORT_EMAIL ?? "hello@aestheticsuccessnetwork.com";
}

function hasPartnerRole(role: FoundingInviteEmailInput["role"]): boolean {
  return role === "partner" || role === "both";
}

export type FoundingInviteEmailInput = {
  to: string;
  fullName: string;
  role: "expert" | "partner" | "both";
  /** Company price plan: "ladder" (default) = $39 a month for 12 months then $149; "flat_49" = $39 with no increase. */
  pricing?: "ladder" | "flat_49" | null;
  inviteUrl: string;
  pdfBuffer?: Buffer | null;
  pdfFilename?: string;
  agreementVersion: string;
};

export async function sendFoundingInviteEmail(
  input: FoundingInviteEmailInput,
): Promise<boolean> {
  const roleLabel =
    input.role === "both"
      ? "Founding Expert + Partner"
      : input.role === "partner"
        ? "Founding Partner"
        : "Founding Expert";
  const firstName = input.fullName.trim().split(/\s+/)[0] || "there";
  const subject = `Aesthetic Success Network agreement for review`;
  const pdfFilename = input.pdfFilename ?? DEFAULT_PDF_FILENAME;

  const html = buildHtml({ ...input, roleLabel, firstName });
  const text = buildText({ ...input, roleLabel, firstName });
  const attachments = input.pdfBuffer
    ? [
        {
          filename: pdfFilename,
          content: input.pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ]
    : undefined;

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
          to: input.to,
          replyTo: supportEmail(),
          subject,
          html,
          text,
          attachments: input.pdfBuffer
            ? [
                {
                  filename: pdfFilename,
                  content: input.pdfBuffer,
                  contentType: "application/pdf",
                },
              ]
            : undefined,
        }),
      );
      console.info(`[founding-invite:${input.role}] sent via SMTP`, { to: input.to });
      return true;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          applyEmailSandbox({ from, to: [input.to], reply_to: supportEmail(), subject, html, text, attachments }),
        ),
      });
      if (!res.ok) {
        console.error(`[founding-invite:${input.role}] Resend failed`, await res.text().catch(() => ""));
        return false;
      }
      console.info(`[founding-invite:${input.role}] sent via Resend`, { to: input.to });
      return true;
    }

    console.info(`[founding-invite:${input.role}] (no transport) link for ${input.to}: ${input.inviteUrl}`);
    return false;
  } catch (err) {
    console.error(`[founding-invite:${input.role}] send failed`, err);
    return false;
  }
}

function paymentLineFor(o: { role: FoundingInviteEmailInput["role"]; pricing?: FoundingInviteEmailInput["pricing"] }): string {
  const expertLine =
    "Your founding expert access is free for 12 months, then $39 a month, and it stays $39.";
  const companyLine =
    o.pricing === "flat_49"
      ? "Your founding company listing is $39 a month from acceptance, with no increase."
      : "Your founding company listing is $39 a month for the first 12 months, then $149 a month.";
  if (o.role === "both") {
    return `If you proceed, the acceptance page will securely save a payment method. ${expertLine} ${companyLine} The first $39 company charge is made on acceptance.`;
  }
  if (hasPartnerRole(o.role)) {
    return `If you proceed, the acceptance page will securely save a payment method. ${companyLine} The first $39 charge is made on acceptance.`;
  }
  return `If you proceed, the acceptance page will securely save a payment method. ${expertLine} Nothing is charged for 12 months.`;
}

function buildHtml(o: FoundingInviteEmailInput & { roleLabel: string; firstName: string }): string {
  const paymentLine = paymentLineFor(o);
  const support = supportEmail();
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0A1A2F;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E0DACE;border-radius:12px;padding:32px;">
    <div style="text-align:center;margin-bottom:22px;">
      ${emailBrandHeader({ dark: false })}
    </div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:500;margin:0 0 10px 0;color:#0A1A2F;">
      Agreement ready for review
    </h1>
    <p style="color:#3B4A55;line-height:1.6;font-size:15px;margin:0 0 16px 0;">
      Hello ${escapeHtml(o.firstName)},
    </p>
    <p style="color:#3B4A55;line-height:1.6;font-size:15px;margin:0 0 20px 0;">
      Your Aesthetic Success Network <strong>${escapeHtml(o.roleLabel)}</strong> agreement is ready
      for review. A PDF copy is attached for your reference.
    </p>
    <p style="color:#3B4A55;line-height:1.6;font-size:15px;margin:0 0 20px 0;">
      Please use the secure link below to review the agreement online and complete
      electronic acceptance. ${paymentLine} After acceptance, you will receive a signed
      copy by email along with portal access instructions.
    </p>
    <div style="text-align:center;margin:26px 0;">
      <a href="${escapeHtml(o.inviteUrl)}" style="display:inline-block;background:#0E2A3D;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px;">
        Review agreement
      </a>
    </div>
    <p style="color:#7A8590;font-size:12px;line-height:1.6;margin:20px 0 0 0;text-align:center;">
      This link is private to you and expires in 30 days. Please don't forward it.<br/>
      Questions? Reply to this email: ${escapeHtml(support)}.<br/>
      Aesthetic Success Network, operated by Ekwa Marketing Inc. &middot; Powered by Business of Aesthetics
    </p>
  </div>
</body></html>`;
}

function buildText(o: FoundingInviteEmailInput & { roleLabel: string; firstName: string }): string {
  const paymentLine = paymentLineFor(o);
  return `Agreement ready for review

Hello ${o.firstName},

Your Aesthetic Success Network ${o.roleLabel} agreement is ready for review.
A PDF copy is attached for your reference.

Please use the secure link below to review the agreement online and complete
electronic acceptance. ${paymentLine} After acceptance, you will receive a
signed copy by email along with portal access instructions.

Review agreement: ${o.inviteUrl}

This link is private to you and expires in 30 days. Please don't forward it.
Questions? Reply to this email: ${supportEmail()}.
Aesthetic Success Network, operated by Ekwa Marketing Inc. Powered by Business of Aesthetics.
`;
}
