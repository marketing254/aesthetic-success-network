import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/inquiries?status=open|answered|all&limit=20
 *
 * Returns member inquiries on resources where this vendor is listed as the
 * originating author (resources.originating_vendor_id = me). Mirrors
 * /api/expert/inquiries — same shape, same join, just scoped to vendor.
 */
export async function GET(req: Request) {
  const guard = await requirePaidVendor();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") ?? "all").toLowerCase();
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

  try {
    const admin = getSupabaseAdmin();

    // 1. Fetch the resources this vendor authored. Empty array → empty inbox.
    const { data: myResources, error: resErr } = await admin
      .from("resources")
      .select("id, topic_slug, topic_title, title")
      .eq("originating_vendor_id", guard.vendorId);
    if (resErr) throw resErr;
    const resourceIds = (myResources ?? []).map((r) => r.id);
    if (resourceIds.length === 0) {
      return NextResponse.json({ inquiries: [], resources: [] });
    }
    const resourceMap = new Map((myResources ?? []).map((r) => [r.id, r]));

    // 2. Fetch inquiries on those resources.
    let query = admin
      .from("resource_inquiries")
      .select(
        "id, resource_id, author_auth_user_id, author_display_name, author_subtitle, body, reply_count, status, created_at, updated_at",
      )
      .in("resource_id", resourceIds)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (statusFilter === "open" || statusFilter === "answered") {
      query = query.eq("status", statusFilter);
    }
    const { data, error } = await query;
    if (error) throw error;

    // 3. Hydrate with resource title for fast display.
    const enriched = (data ?? []).map((inq) => {
      const resource = resourceMap.get(inq.resource_id);
      return {
        ...inq,
        resource_topic_slug: resource?.topic_slug ?? null,
        resource_topic_title: resource?.topic_title ?? null,
        resource_title: resource?.title ?? null,
      };
    });

    return NextResponse.json({
      inquiries: enriched,
      resources: myResources ?? [],
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/vendor/inquiries" });
  }
}
