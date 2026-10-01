import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { fetchPublishedSpotlights } from "@/lib/spotlights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shape of the approved-catalog select below — the generated client types
// don't model the nested catalog_media relation, so we assert it.
type MemberCatalogRow = {
  id: string;
  type: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  price_label: string | null;
  duration_hours: number | null;
  module_count: number | null;
  highlights: string[] | null;
  catalog_media:
    | {
        id: string;
        kind: string | null;
        url: string;
        thumbnail_url: string | null;
        caption: string | null;
        duration_label: string | null;
        position: number | null;
      }[]
    | null;
};

/**
 * GET /api/member/partners/[id]
 *
 * Full public profile for one partner company plus its approved member
 * offers. Only surfaces member-safe fields — never contact email / phone
 * or billing.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing partner id." }, { status: 400 });

  try {
    const admin = getSupabaseAdmin();

    const { data: v, error } = await admin
      .from("vendors")
      .select(
        "id, company_name, display_name, category, description, logo_url, avatar_url, website, calendar_link, status, verified, billing_parent_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    // Same publish-ready gate as the directory list: no logo/description →
    // not visible to members (test rows, half-set listings).
    if (!v || v.status !== "approved" || !v.verified || !(v.logo_url ?? v.avatar_url) || !v.description) {
      return NextResponse.json({ error: "Partner not found." }, { status: 404 });
    }
    // Covered company hidden if its paying partner isn't live.
    if (v.billing_parent_id) {
      const { data: parent } = await admin
        .from("vendors")
        .select("status, verified")
        .eq("id", v.billing_parent_id)
        .maybeSingle();
      if (!parent || parent.status !== "approved" || !parent.verified) {
        return NextResponse.json({ error: "Partner not found." }, { status: 404 });
      }
    }

    const { data: offerRows } = await admin
      .from("offers")
      .select("id, headline, discount_value, promo_code, description, terms, valid_to")
      .eq("vendor_id", id)
      .eq("review_status", "approved")
      .order("created_at", { ascending: false });

    // Approved catalog — the partner's services/products/courses, exactly
    // as they submitted them (member-safe fields + media).
    const { data: catalogRows } = await admin
      .from("catalog_items")
      .select(
        "id, type, name, tagline, description, category, price_label, duration_hours, module_count, highlights, catalog_media(id, kind, url, thumbnail_url, caption, duration_label, position)",
      )
      .eq("vendor_id", id)
      .eq("review_status", "approved")
      .order("created_at", { ascending: false });

    const publishedSpotlights = await fetchPublishedSpotlights(admin, { vendorId: id });

    // Approved offers render INSIDE the spotlight carousel (that's its
    // whole purpose) — folded in as feature slides, promo code included.
    const offerSlides = (offerRows ?? []).map((o) => ({
      id: `offer-${o.id}`,
      kind: "feature" as const,
      title: o.headline,
      body: [
        o.description,
        o.promo_code ? `Promo code: ${o.promo_code}` : null,
        o.terms,
      ]
        .filter(Boolean)
        .join("\n\n"),
      link_url: null,
      link_label: null,
      image_url: null,
      event_date: null,
      published_at: null,
    }));
    const spotlights = [...offerSlides, ...publishedSpotlights];

    return NextResponse.json({
      partner: {
        id: v.id,
        name: v.display_name || v.company_name || "(unnamed partner)",
        category: v.category,
        description: v.description,
        logo_url: v.logo_url ?? v.avatar_url ?? null,
        website: v.website,
        calendar_link: v.calendar_link,
      },
      spotlights,
      offers: (offerRows ?? []).map((o) => ({
        id: o.id,
        headline: o.headline,
        discount_value: o.discount_value,
        promo_code: o.promo_code,
        description: o.description,
        terms: o.terms,
        valid_to: o.valid_to,
      })),
      catalog: ((catalogRows ?? []) as unknown as MemberCatalogRow[]).map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        category: c.category,
        price_label: c.price_label,
        duration_hours: c.duration_hours,
        module_count: c.module_count,
        highlights: c.highlights,
        media: (c.catalog_media ?? [])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((m) => ({
            id: m.id,
            kind: m.kind,
            url: m.url,
            thumbnail_url: m.thumbnail_url,
            caption: m.caption,
            duration_label: m.duration_label,
          })),
      })),
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/partners/[id]" });
  }
}
