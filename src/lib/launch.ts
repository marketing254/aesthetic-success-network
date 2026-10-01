/**
 * Member launch switch. While MEMBER_LAUNCH_ENABLED is not "true":
 *  - member signups are recorded on the waitlist only (no confirmation email)
 *  - no member sign-in codes, no member checkout, no member portal
 *  - no member email sequences (onboarding, abandoned, welcome)
 * Experts and companies are unaffected. Flip to "true" at launch.
 */
export const MEMBER_LAUNCH_ENABLED =
  process.env.MEMBER_LAUNCH_ENABLED === "true" || process.env.NEXT_PUBLIC_MEMBER_LAUNCH_ENABLED === "true";

export const MEMBER_LAUNCH_MESSAGE =
  "Member sign-in opens when the network launches. You are on the founding waitlist and we will email you first.";
