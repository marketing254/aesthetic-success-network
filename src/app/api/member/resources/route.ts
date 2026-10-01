import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/resources[?topic_slug=...]
 *
 * Returns published resources joined with the signed-in member's progress.
 * If `topic_slug` is provided, narrows to that topic; otherwise returns
 * all published resources for the topics list page.
 *
 * Admin preview: admins see the same resource list but with `progress:
 * null` on every row (no member_id to key personal progress by).
 */
export async function GET(req: Request) {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const topicSlug = url.searchParams.get("topic_slug");
  const expertId = url.searchParams.get("expert");
  const sb = getSupabaseAdmin();

  let query = sb
    .from("resources")
    .select(
      "id, topic_slug, topic_title, topic_summary, category, portal_card_url, resource_card_url, title, description, kind, storage_path, external_url, thumbnail_url, mime_type, file_size_bytes, duration_label, position, is_free, is_published, created_at, kit_type, book_club_payload, originating_expert_id",
    )
    .eq("is_published", true)
    .eq("submission_status", "approved")
    .order("topic_slug", { ascending: true })
    .order("position", { ascending: true });

  if (topicSlug) query = query.eq("topic_slug", topicSlug);
  if (expertId) query = query.eq("originating_expert_id", expertId);
  // NOTE: members see EVERY published kit here — house, Book Club, and
  // expert/partner-attributed alike. Attribution only hides a kit from the
  // PUBLIC website (/api/resources), never from the member portal.

  const { data: resources, error } = await query;
  if (error) return serverError(error, { route: "GET /api/member/resources" });

  // Pull progress only for real members — admin previews have no
  // memberId to key personal progress by.
  const ids = (resources ?? []).map((r) => r.id);
  let progress: { resource_id: string; last_viewed_at: string | null; completed_at: string | null; watch_seconds: number }[] = [];
  if (!guard.isAdminPreview && ids.length > 0) {
    const { data: progressRows } = await sb
      .from("member_resource_progress")
      .select("resource_id, last_viewed_at, completed_at, watch_seconds")
      .eq("member_id", guard.memberId)
      .in("resource_id", ids);
    progress = progressRows ?? [];
  }

  const progressByResource = new Map(progress.map((p) => [p.resource_id, p]));
  const decorated = (resources ?? []).map((r) => ({
    ...r,
    progress: progressByResource.get(r.id) ?? null,
  }));

  return NextResponse.json({ resources: decorated });
}
