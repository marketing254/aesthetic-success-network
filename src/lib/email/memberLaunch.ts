import "server-only";
import {
  ACCENT,
  SITE_HOST,
  TEAM_SIGNOFF,
  firstNameOf,
  sendEmailDraft,
  type EmailDraft,
} from "@/lib/email/layout";

/**
 * The ONE email a waitlist member receives, and only when the team sends
 * it from the admin Waitlist page after the launch switch is on:
 * "The doors are open, claim your founding spot." It links to the member
 * signup with their details prefilled; they confirm, pick monthly or
 * annual and pay. Nothing is charged from this email.
 */
export type MemberLaunchEmailInput = {
  to: string;
  fullName: string | null;
  /** /join/member?wl=<signup id>, prefilled. */
  joinUrl: string;
};

export async function sendMemberLaunchEmail(input: MemberLaunchEmailInput): Promise<boolean> {
  const name = firstNameOf(input.fullName);
  const draft: EmailDraft = {
    subject: "The doors are open: claim your founding spot",
    preview: "Your founding rate of $29 a month is reserved. Confirm your details and you're in.",
    eyebrow: "Founding member",
    headline: `The doors are open, ${name}.`,
    intro: [
      "You reserved a founding spot on the Aesthetic Success Network waitlist. The member portal is now live, and your spot is ready.",
      "Your founding rate is $29 a month or $290 a year, locked for as long as your membership stays active. The first 100 members get it; after that the standard rate is $99 a month.",
    ],
    sections: [
      {
        title: "What you get from day one",
        items: [
          "The Expert Hotline. Call, leave a voicemail with your question, and get a written action plan by text and email within 2 to 3 business days.",
          "The resource library: playbooks, checklists, calculators and recordings from vetted experts, with new material added as experts join.",
          "Member-only offers from companies we've vetted.",
          "Directories of experts and companies, so you can find the right help fast.",
        ],
      },
      {
        title: "How to claim your spot",
        paragraphs: [
          "Click the button, check the details we saved for you, choose monthly or annual, and add your card. Your portal opens straight after, and you sign in with a 6-digit code to the email you joined with.",
        ],
        tone: "gold",
      },
    ],
    ctas: [{ label: "Claim my founding spot", url: input.joinUrl }],
    notes: ["30-day money-back guarantee. Cancel anytime."],
    closing: "Questions? Reply to this email. Our team reads every reply.",
    signoff: TEAM_SIGNOFF,
    footerNote: "Founding spot reserved",
    footerLines: [
      "You're receiving this because you joined the Aesthetic Success Network founding waitlist.",
      `Aesthetic Success Network · members@${SITE_HOST} · ${SITE_HOST}`,
    ],
    accent: ACCENT.member,
  };
  return sendEmailDraft({ to: input.to, audience: "member", draft, tag: "member:launch" });
}
