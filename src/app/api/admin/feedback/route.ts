import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/feedback
 *
 * Returns all member feedback with member name + topic title hydrated.
 * Newest first, capped at 500. Honest at this scale — when feedback
 * volume actually crosses that we add a topic filter.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("resource_feedback")
      .select("id, member_id, topic_slug, rating, comment, progress_pct, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const memberIds = Array.from(new Set((rows ?? []).map((r) => r.member_id)));
    const topicSlugs = Array.from(new Set((rows ?? []).map((r) => r.topic_slug)));

    const [{ data: members }, { data: resources }] = await Promise.all([
      memberIds.length
        ? admin.from("members").select("id, first_name, last_name, email").in("id", memberIds)
        : Promise.resolve({ data: [] }),
      topicSlugs.length
        ? admin.from("resources").select("topic_slug, topic_title").in("topic_slug", topicSlugs)
        : Promise.resolve({ data: [] }),
    ]);

    const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
    const topicMap = new Map(
      (resources ?? []).map((r) => [r.topic_slug, r.topic_title]),
    );

    const enriched = (rows ?? []).map((r) => {
      const m = memberMap.get(r.member_id);
      return {
        ...r,
        member_name: m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() : "—",
        member_email: m?.email ?? "—",
        topic_title: topicMap.get(r.topic_slug) ?? r.topic_slug,
      };
    });

    // Per-topic aggregates (count + avg) for the dashboard summary card.
    const byTopic = new Map<string, { count: number; sum: number; title: string }>();
    for (const r of enriched) {
      const cur = byTopic.get(r.topic_slug) ?? { count: 0, sum: 0, title: r.topic_title };
      cur.count += 1;
      cur.sum += r.rating;
      byTopic.set(r.topic_slug, cur);
    }
    const summary = Array.from(byTopic, ([slug, v]) => ({
      topic_slug: slug,
      topic_title: v.title,
      count: v.count,
      average: Math.round((v.sum / v.count) * 10) / 10,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({ feedback: enriched, summary });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/feedback" });
  }
}
