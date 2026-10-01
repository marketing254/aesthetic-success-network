import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/kit-cards — PUBLIC.
 *
 * The card artwork for the homepage "Just dropped." marquee: one portal
 * card per published kit, newest first. Card art + title only — no
 * resource contents, no member data. The art itself is the marketing
 * asset (titles are baked into the images), so exposing it is the point.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("resources")
      .select("topic_slug, topic_title, portal_card_url, created_at")
      .eq("is_published", true)
      .eq("submission_status", "approved")
      .not("portal_card_url", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // One card per kit, keeping the newest created_at per topic (rows come
    // back newest-first, so first occurrence wins).
    const seen = new Set<string>();
    const cards: { slug: string; title: string; card: string }[] = [];
    for (const r of data ?? []) {
      if (seen.has(r.topic_slug) || !r.portal_card_url) continue;
      seen.add(r.topic_slug);
      cards.push({ slug: r.topic_slug, title: r.topic_title, card: r.portal_card_url });
      if (cards.length >= 16) break;
    }

    return NextResponse.json(
      { cards },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    return serverError(err, { route: "GET /api/kit-cards" });
  }
}
