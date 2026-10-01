/**
 * "Why we built this" quotes on the referral join page.
 *
 * Keyed by the referrer's display name exactly as it resolves from their
 * expert/partner record (lib/referralContext). A referrer with no entry
 * here simply gets no quote block. Wording must come from the referrer's
 * own invitation email; if they send a change, edit the text here and
 * nothing else.
 *
 * Only house entries (Naren, Ekwa) are listed. Add others only with the
 * referrer's own words.
 */
export type ReferrerQuote = {
  quote: string;
  role: string;
};

export const REFERRER_QUOTES: Record<string, ReferrerQuote> = {
  // Adapted from Naren's DMN referral quote (dental wording replaced with
  // aesthetic practices and the ASN name). Owner to confirm the wording.
  "Naren Arulrajah": {
    quote:
      "Working with aesthetic practices, I see how often an owner or a team member has a question and no obvious place to take it. A staffing problem, a process that leaks money, a decision about growing. We built the Aesthetic Success Network to be that place: one dependable spot for practical answers, useful tools, and people who can actually help. Your first six months are on me.",
    role: "Founder and CEO, Ekwa Marketing",
  },
  "Ekwa Marketing Inc.": {
    quote:
      "We built the Aesthetic Success Network to be the place aesthetic practice owners take the questions they have nowhere else to take: practical answers, useful tools, and people who can actually help.",
    role: "Ekwa Marketing, the team behind the Aesthetic Success Network",
  },
};

export function quoteFor(name: string | null | undefined): ReferrerQuote | null {
  if (!name) return null;
  return REFERRER_QUOTES[name.trim()] ?? null;
}
