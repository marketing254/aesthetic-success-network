import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/top-kits
 *
 * Network-wide kit popularity: how many times members have opened a
 * resource in each kit, grouped by topic. Powers the dynamic ordering of
 * the dashboard "Top 5" rail. Returns aggregate counts only — no member
 * data leaves the server.
 *
 * Reads the kit_access_counts SQL view (migration 0053) so the count is
 * one aggregate query. Falls back to aggregating in the API if the view
 * hasn't been created in this environment yet.
 */
export async function GET() {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    const { data: viewRows, error: viewErr } = await admin
      .from("kit_access_counts")
      .select("slug, views")
      .order("views", { ascending: false });
    if (!viewErr) {
      return NextResponse.json({ ranks: viewRows ?? [] });
    }

    const [{ data: rows, error: pErr }, { data: resources, error: rErr }] = await Promise.all([
      admin.from("member_resource_progress").select("resource_id"),
      admin
        .from("resources")
        .select("id, topic_slug")
        .eq("is_published", true)
        .eq("submission_status", "approved"),
    ]);
    if (pErr) throw pErr;
    if (rErr) throw rErr;

    const topicByResource = new Map((resources ?? []).map((r) => [r.id, r.topic_slug]));
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      const slug = topicByResource.get(row.resource_id);
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }

    const ranks = [...counts.entries()]
      .map(([slug, views]) => ({ slug, views }))
      .sort((a, b) => b.views - a.views);

    return NextResponse.json({ ranks });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/top-kits" });
  }
}
