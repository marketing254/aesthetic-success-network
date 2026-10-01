import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { sortPartnersHouseFirst } from "@/lib/houseOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/partners
 *
 * Every live partner company plus a count of its approved member offers.
 * Powers the member-portal "Partners" directory. Multi-company partners
 * show as several cards; a covered company is only listed while its paying
 * partner is itself live (approved + verified).
 */
export async function GET() {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    // Publish-ready gate (same rule as the public directory): a partner
    // must have a logo AND a description before members see them. Internal
    // test vendors / half-set listings never reach the directory.
    const { data: vendors, error } = await admin
      .from("vendors")
      .select(
        "id, company_name, display_name, category, description, logo_url, avatar_url, website, billing_parent_id",
      )
      .eq("status", "approved")
      .eq("verified", true)
      .not("logo_url", "is", null)
      .not("description", "is", null)
      // First come, first listed — house anchors are pinned on top afterwards.
      .order("created_at", { ascending: true });
    if (error) throw error;

    // A covered company is only visible while its paying partner is also
    // live, so it disappears with the partner rather than lingering.
    const liveIds = new Set((vendors ?? []).map((v) => v.id));
    const visible = (vendors ?? []).filter(
      (v) => !v.billing_parent_id || liveIds.has(v.billing_parent_id),
    );

    const ids = visible.map((v) => v.id);
    const offerCounts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: offers } = await admin
        .from("offers")
        .select("vendor_id")
        .in("vendor_id", ids)
        .eq("review_status", "approved");
      for (const o of offers ?? []) {
        offerCounts.set(o.vendor_id, (offerCounts.get(o.vendor_id) ?? 0) + 1);
      }
      // Offers published as "feature" spotlights — the standard format on
      // profile pages (SpotlightOfferCard) — count too, so the card's offer
      // count matches what the member actually sees on the profile.
      const { data: spots } = await admin
        .from("profile_spotlights")
        .select("vendor_id")
        .in("vendor_id", ids)
        .eq("kind", "feature")
        .eq("is_published", true);
      for (const s of spots ?? []) {
        if (s.vendor_id) {
          offerCounts.set(s.vendor_id, (offerCounts.get(s.vendor_id) ?? 0) + 1);
        }
      }
    }

    const shaped = visible.map((v) => ({
      id: v.id,
      name: v.display_name || v.company_name || "(unnamed partner)",
      category: v.category,
      description: v.description,
      logo_url: v.logo_url ?? v.avatar_url ?? null,
      website: v.website,
      offer_count: offerCounts.get(v.id) ?? 0,
    }));

    return NextResponse.json({ partners: sortPartnersHouseFirst(shaped, (p) => p.name) });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/partners" });
  }
}
