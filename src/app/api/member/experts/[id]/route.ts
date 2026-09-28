import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { fetchPublishedSpotlights } from "@/lib/spotlights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/experts/[id]
 *
 * Full public profile for one expert plus the list of published kits
 * attributed to them. Powers the member-portal expert profile page
 * (/dashboard/experts/[id]). Only surfaces member-safe fields — never
 * email / phone / billing.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing expert id." }, { status: 400 });

  try {
    const admin = getSupabaseAdmin();

    const { data: expert, error } = await admin
      .from("experts")
      .select(
        "id, display_name, full_name, specialty, bio, topics, website, booking_link, company_name, headshot_url, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    // Same publish-ready gate as the directory list: no headshot/bio → not
    // visible to members (test rows, half-set profiles).
    if (
      !expert ||
      expert.status === "archived" ||
      expert.status === "suspended" ||
      !expert.headshot_url ||
      !expert.bio
    ) {
      return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    }

    // Distinct published kits this expert originated.
    const { data: rows } = await admin
      .from("resources")
      .select("topic_slug, topic_title, portal_card_url, resource_card_url, kit_type")
      .eq("originating_expert_id", id)
      .eq("is_published", true)
      .eq("submission_status", "approved")
      .order("topic_title", { ascending: true });

    const seen = new Set<string>();
    const kits: {
      slug: string;
      title: string;
      card_url: string | null;
      kit_type: string;
    }[] = [];
    for (const r of rows ?? []) {
      if (seen.has(r.topic_slug)) continue;
      seen.add(r.topic_slug);
      kits.push({
        slug: r.topic_slug,
        title: r.topic_title,
        card_url: r.portal_card_url ?? r.resource_card_url ?? null,
        kit_type: r.kit_type ?? "standard",
      });
    }

    const spotlights = await fetchPublishedSpotlights(admin, { expertId: id });

    return NextResponse.json({
      expert: {
        id: expert.id,
        name: expert.display_name || expert.full_name || "(unnamed expert)",
        specialty: expert.specialty,
        bio: expert.bio,
        topics: expert.topics,
        website: expert.website,
        booking_link: expert.booking_link,
        company_name: expert.company_name,
        headshot_url: expert.headshot_url,
      },
      spotlights,
      kits,
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/experts/[id]" });
  }
}
