import "server-only";

/**
 * Per-audience sender addresses. One Rackspace mailbox (support@)
 * authenticates SMTP; Rackspace allows same-domain send-as, so each
 * audience sees the inbox that matches their relationship.
 */
const BRAND = "Aesthetic Success Network";
const DOMAIN = "aestheticsuccessnetwork.com";

export type EmailAudience = "member" | "expert" | "partner" | "both" | "support";

export function senderFor(audience: EmailAudience): string {
  switch (audience) {
    case "member":
      return process.env.EMAIL_FROM_MEMBERS ?? `${BRAND} <members@${DOMAIN}>`;
    case "expert":
      return process.env.EMAIL_FROM_EXPERTS ?? `${BRAND} <experts@${DOMAIN}>`;
    case "partner":
    case "both":
      return process.env.EMAIL_FROM_PARTNERS ?? `${BRAND} <partners@${DOMAIN}>`;
    default:
      return process.env.EMAIL_FROM_SUPPORT ?? process.env.MAIL_FROM_TX ?? `${BRAND} <support@${DOMAIN}>`;
  }
}

export function replyToFor(audience: EmailAudience): string {
  switch (audience) {
    case "member":
      return `members@${DOMAIN}`;
    case "expert":
      return process.env.WAITLIST_EXPERTS_EMAIL ?? `experts@${DOMAIN}`;
    case "partner":
    case "both":
      return process.env.WAITLIST_PARTNERSHIPS_EMAIL ?? `partners@${DOMAIN}`;
    default:
      return process.env.MAIL_REPLYTO_SUPPORT ?? `support@${DOMAIN}`;
  }
}
