import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/analytics
 *
 * Per-resource roll-up for the partner portal:
 *   - resource: id, topic_slug, topic_title, title
 *   - views_total, views_unique_members
 *   - inquiries_open, inquiries_answered, inquiries_total
 *   - feedback_count, feedback_avg
 *
 * Plus headline totals so the dashboard card can show "X total members,
 * Y inquiries this month, Z.Z avg rating".
 */
export async function GET() {
  const guard = await requirePaidVendor();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    const { data: resources } = await admin
      .from("resources")
      .select("id, topic_slug, topic_title, title")
      .eq("originating_vendor_id", guard.vendorId);

    const resourceIds = (resources ?? []).map((r) => r.id);
    if (resourceIds.length === 0) {
      return NextResponse.json({
        resources: [],
        headline: { views: 0, members: 0, inquiries: 0, avgRating: null },
      });
    }
    const resourceMap = new Map((resources ?? []).map((r) => [r.id, r]));
    const topicSlugs = Array.from(new Set((resources ?? []).map((r) => r.topic_slug)));

    const [
      { data: views },
      { data: inquiries },
      { data: feedback },
    ] = await Promise.all([
      admin
        .from("resource_views")
        .select("resource_id, member_id")
        .in("resource_id", resourceIds),
      admin
        .from("resource_inquiries")
        .select("id, resource_id, status")
        .in("resource_id", resourceIds)
        .is("hidden_at", null),
      admin
        .from("resource_feedback")
        .select("topic_slug, rating")
        .in("topic_slug", topicSlugs),
    ]);

    // Group views per resource.
    const viewsByResource = new Map<string, { total: number; members: Set<string> }>();
    for (const v of views ?? []) {
      const cur = viewsByResource.get(v.resource_id) ?? { total: 0, members: new Set() };
      cur.total += 1;
      if (v.member_id) cur.members.add(v.member_id);
      viewsByResource.set(v.resource_id, cur);
    }

    // Group inquiries per resource.
    const inquiriesByResource = new Map<string, { open: number; answered: number; total: number }>();
    for (const i of inquiries ?? []) {
      const cur = inquiriesByResource.get(i.resource_id) ?? { open: 0, answered: 0, total: 0 };
      cur.total += 1;
      if (i.status === "open") cur.open += 1;
      else if (i.status === "answered") cur.answered += 1;
      inquiriesByResource.set(i.resource_id, cur);
    }

    // Group feedback per topic.
    const feedbackByTopic = new Map<string, { count: number; sum: number }>();
    for (const f of feedback ?? []) {
      const cur = feedbackByTopic.get(f.topic_slug) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += f.rating;
      feedbackByTopic.set(f.topic_slug, cur);
    }

    const enriched = resourceIds.map((id) => {
      const r = resourceMap.get(id)!;
      const v = viewsByResource.get(id) ?? { total: 0, members: new Set<string>() };
      const i = inquiriesByResource.get(id) ?? { open: 0, answered: 0, total: 0 };
      const f = feedbackByTopic.get(r.topic_slug) ?? { count: 0, sum: 0 };
      return {
        id,
        topic_slug: r.topic_slug,
        topic_title: r.topic_title,
        title: r.title,
        views_total: v.total,
        views_unique_members: v.members.size,
        inquiries_open: i.open,
        inquiries_answered: i.answered,
        inquiries_total: i.total,
        feedback_count: f.count,
        feedback_avg: f.count ? Math.round((f.sum / f.count) * 10) / 10 : null,
      };
    });

    const allMembers = new Set<string>();
    let totalViews = 0;
    let totalInquiries = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    for (const r of enriched) {
      totalViews += r.views_total;
      totalInquiries += r.inquiries_total;
      if (r.feedback_avg !== null) {
        ratingSum += r.feedback_avg * r.feedback_count;
        ratingCount += r.feedback_count;
      }
    }
    for (const v of views ?? []) if (v.member_id) allMembers.add(v.member_id);

    return NextResponse.json({
      resources: enriched.sort((a, b) => b.views_total - a.views_total),
      headline: {
        views: totalViews,
        members: allMembers.size,
        inquiries: totalInquiries,
        avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
      },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/vendor/analytics" });
  }
}
