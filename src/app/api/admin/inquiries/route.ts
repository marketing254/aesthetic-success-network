import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inquiries?status=all|open|answered|closed&limit=100
 *
 * Returns every inquiry across every resource, newest first. Used by the
 * admin inbox at /admin/inquiries. Hydrated with the resource title +
 * topic slug + originating expert name so the row is readable without
 * extra round-trips.
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const route = "GET /api/admin/inquiries";
  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") ?? "all").toLowerCase();
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Math.min(
    200,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100),
  );

  try {
    const admin = getSupabaseAdmin();

    let query = admin
      .from("resource_inquiries")
      .select(
        "id, resource_id, author_auth_user_id, author_display_name, author_subtitle, body, reply_count, status, created_at, updated_at",
      )
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (
      statusFilter === "open" ||
      statusFilter === "answered" ||
      statusFilter === "closed"
    ) {
      query = query.eq("status", statusFilter);
    }

    const { data: inquiries, error } = await query;
    if (error) throw error;
    if (!inquiries || inquiries.length === 0) {
      return NextResponse.json({ inquiries: [] });
    }

    // Hydrate with the resource title + originating expert in one round.
    const resourceIds = Array.from(new Set(inquiries.map((i) => i.resource_id)));
    const { data: resources } = await admin
      .from("resources")
      .select("id, topic_slug, topic_title, title, originating_expert_id")
      .in("id", resourceIds);
    const resourceMap = new Map(
      (resources ?? []).map((r) => [r.id, r]),
    );

    const expertIds = Array.from(
      new Set(
        (resources ?? [])
          .map((r) => r.originating_expert_id)
          .filter((v): v is string => v !== null),
      ),
    );
    const expertMap = new Map<string, { display_name: string; full_name: string }>();
    if (expertIds.length > 0) {
      const { data: experts } = await admin
        .from("experts")
        .select("id, display_name, full_name")
        .in("id", expertIds);
      for (const e of experts ?? []) {
        expertMap.set(e.id, {
          display_name: e.display_name ?? "",
          full_name: e.full_name,
        });
      }
    }

    const enriched = inquiries.map((inq) => {
      const resource = resourceMap.get(inq.resource_id);
      const expert =
        resource?.originating_expert_id != null
          ? expertMap.get(resource.originating_expert_id)
          : null;
      return {
        ...inq,
        resource_topic_slug: resource?.topic_slug ?? null,
        resource_topic_title: resource?.topic_title ?? null,
        resource_title: resource?.title ?? null,
        originating_expert_name:
          expert?.display_name || expert?.full_name || null,
      };
    });

    return NextResponse.json({ inquiries: enriched });
  } catch (err) {
    return serverError(err, { route });
  }
}
