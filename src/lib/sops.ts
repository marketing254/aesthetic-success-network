/**
 * Systems: the member-portal SOP & template library.
 *
 * One entry per approved SOP. Each arrives from the ASN content team as a
 * PDF + a duotone portal card (same treatment as the kit cards), both
 * uploaded to Supabase storage:
 *   card -> kit-thumbnails/sops/<slug>-card.jpg   (public bucket)
 *   pdf  -> member-resources/sops/<slug>.pdf
 *
 * Publishing a new SOP = upload the two files + add an entry here.
 * Every SOP is expert-approved IN WRITING before it appears. Never add
 * one without that approval on record.
 *
 * ASN launches with no SOPs, so the registry is empty; the Systems pages
 * render a friendly empty state until the first one is added.
 */

// Derived from the project's own Supabase URL so the registry never points
// at another project's storage.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CARD_BASE = `${SUPABASE_URL}/storage/v1/object/public/kit-thumbnails/sops`;
const PDF_BASE = `${SUPABASE_URL}/storage/v1/object/public/member-resources/sops`;

export type Sop = {
  slug: string;
  title: string;
  category: string;
  expert: {
    name: string;
    /** experts.id, links to /dashboard/experts/[id]. */
    id: string;
  };
  cardUrl: string;
  pdfUrl: string;
  /** Date the expert approved it in writing. */
  approved: string;
};

/** Build the two storage URLs for a slug (use when registering a new SOP). */
export function sopAssetUrls(slug: string): { cardUrl: string; pdfUrl: string } {
  return {
    cardUrl: `${CARD_BASE}/${slug}-card.jpg`,
    pdfUrl: `${PDF_BASE}/${slug}.pdf`,
  };
}

export const SOPS: Sop[] = [];
