/**
 * Lead-magnet registry for `/api/lead-magnets/[slug]`.
 *
 * Each entry maps a public slug to the PDF that gets emailed (a path
 * relative to `public/`) and the copy the email needs. The registry is
 * EMPTY for ASN's launch: the homepage FreeKitMagnet section only
 * renders when NEXT_PUBLIC_LEAD_MAGNET_ENABLED=true, and the API returns
 * 404 for any slug that is not listed here.
 *
 * The homepage FreeKitMagnet form posts to /api/lead-magnets/starter-kit
 * by default, so "starter-kit" is the slug to register first. Uncomment
 * the example below and drop the PDF into public/free-kit/ when
 * NEXT_PUBLIC_LEAD_MAGNET_ENABLED is switched on:
 *
 *   "starter-kit": {
 *     title: "The ASN starter kit",
 *     filePath: "free-kit/asn-starter-kit.pdf",
 *     buttonLabel: "Open the starter kit",
 *   },
 */
export type LeadMagnet = {
  /** Human title used in the subject line and the email body. */
  title: string;
  /** Path relative to `public/` (no leading slash). */
  filePath: string;
  /** Label of the download button in the email. */
  buttonLabel: string;
};

export const LEAD_MAGNETS: Record<string, LeadMagnet> = {};

export function getLeadMagnet(slug: string | null | undefined): LeadMagnet | null {
  if (!slug) return null;
  return Object.prototype.hasOwnProperty.call(LEAD_MAGNETS, slug) ? LEAD_MAGNETS[slug] : null;
}

/** Slugs are short, lowercase and hyphenated so they are safe to log and to use as rate-limit keys. */
export const LEAD_MAGNET_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
