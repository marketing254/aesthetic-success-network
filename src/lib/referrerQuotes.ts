/**
 * "Why we built this" quotes on the referral join page.
 *
 * Keyed by the referrer's display name exactly as it resolves from their
 * expert/partner record (lib/referralContext). A referrer with no entry
 * here simply gets no quote block. Wording must come from the referrer's
 * own invitation email; if they send a change, edit the text here and
 * nothing else.
 *
 * ASN launches with an EMPTY list: no DMN referrer quote is carried over
 * and none is invented. Add an entry only with the referrer's own words.
 */
export type ReferrerQuote = {
  quote: string;
  role: string;
};

export const REFERRER_QUOTES: Record<string, ReferrerQuote> = {};

export function quoteFor(name: string | null | undefined): ReferrerQuote | null {
  if (!name) return null;
  return REFERRER_QUOTES[name.trim()] ?? null;
}
