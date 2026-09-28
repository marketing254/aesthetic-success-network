/**
 * Member Tools registry for Aesthetic Success Network.
 *
 * Three self-contained HTML tools live in `tools-html/` (NOT /public — the
 * full versions must never be publicly reachable). They're served to
 * signed-in members only via GET /api/member/tools/[id]. The 13 DMN dental
 * tools were moved out of the repo (see
 * asn-landing-launch-phase-backup-2026-09-24/dmn-assets-not-used/tools-html/).
 *
 * `blurb` is portal-level metadata only (a one-line description for the
 * directory card) — it does NOT change anything inside the tool files.
 */

export type ToolAudience = "owner" | "team";

export type MemberTool = {
  id: string;
  file: string;
  title: string;
  blurb: string;
  category: string;
  audience: ToolAudience;
  /** "expert" = credited to a bench expert; "original" = ASN-built. */
  credit: "expert" | "original";
  expert: string | null;
  kit: string | null;
};

export const MEMBER_TOOLS: MemberTool[] = [
  { id: "roi-calculator", file: "asn_roi_calculator.html", title: "Membership ROI Calculator", blurb: "Run the membership on your own numbers: partner discounts plus Expert Hotline value, minus the founding fee. Illustrative only.", category: "Operations & Compliance", audience: "owner", credit: "original", expert: null, kit: null },
  { id: "consult-conversion-calculator", file: "asn_consult_conversion_calculator.html", title: "Consult Conversion Calculator", blurb: "See the monthly and annual revenue impact of lifting your same-day close rate by a few points.", category: "Consult & Conversion", audience: "owner", credit: "original", expert: null, kit: null },
  { id: "treatment-margin-calculator", file: "asn_treatment_margin_calculator.html", title: "Treatment Margin Calculator", blurb: "Cost per unit vs. price per unit, times units per treatment: profit and margin per treatment without a spreadsheet.", category: "Pricing & Margins", audience: "owner", credit: "original", expert: null, kit: null },
];

/** Category display order + accent colors (matches the ASN resource categories). */
export const TOOL_CATEGORIES: { name: string; color: string }[] = [
  { name: "Pricing & Margins", color: "#1B3A5C" },
  { name: "Consult & Conversion", color: "#0E7490" },
  { name: "Team & Culture", color: "#A0522D" },
  { name: "Patient Experience", color: "#6D28D9" },
  { name: "Marketing & Growth", color: "#B45309" },
  { name: "Operations & Compliance", color: "#1F5C40" },
];

export function toolById(id: string): MemberTool | undefined {
  return MEMBER_TOOLS.find((t) => t.id === id);
}

/**
 * Static preview image for the PUBLIC /tools pages. ASN ships no screenshot
 * previews (public/tools/previews/* was deleted), so this always returns
 * null and every consumer renders a CSS placeholder card (category colour +
 * title) instead of an <img>. Kept as an export so the call sites and any
 * future preview pipeline keep the same seam: drop a JPG in
 * public/tools/previews/<id>.jpg and return its path here.
 */
export function toolPreviewSrc(id: string): string | null {
  void id; // reserved for the future preview lookup
  return null;
}

/**
 * Tools that run on the PUBLIC /tools/[id] page with no account. The
 * calculator works; the PDF download inside it is gated to members
 * (see /api/tools/public/[id]). Keep this list to one or two flagship
 * tools — everything else stays a locked preview.
 */
// Free access is switched OFF for launch (empty list). To open one tool
// again, add its id here, e.g. ["roi-calculator"] — the public route,
// results masking and PDF gate are all still in place (the masking script
// in /api/tools/public/[id] needs a RESULT_IDS entry for that tool first).
export const PUBLIC_TOOL_IDS: readonly string[] = [];

export function isPublicTool(id: string): boolean {
  return PUBLIC_TOOL_IDS.includes(id);
}
