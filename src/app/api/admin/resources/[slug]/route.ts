import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ slug: string }>;

/**
 * PATCH /api/admin/resources/[slug]
 *
 * Updates every row in the kit that shares this topic_slug. Used by the
 * admin portal's Approve / Reject / Publish / Unpublish actions.
 *
 * Body:
 *   { action: "approve" } | { action: "reject", reason?: string } |
 *   { action: "publish" } | { action: "unpublish" } |
 *   { action: "set_thumbnail", portalCardUrl: string }
 */
export async function PATCH(req: Request, { params }: { params: RouteParams }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "publish" | "unpublish" | "set_thumbnail";
    reason?: string;
    portalCardUrl?: string;
  };

  if (!body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // We update every row that shares the slug — the kit is a logical unit.
  // Typed as Partial<ResourcesRow> shape (subset of columns we ever touch
  // here) so the supabase-js generic accepts it without a cast.
  type Patch = {
    submission_status?: "approved" | "rejected";
    approved_by?: string | null;
    rejected_reason?: string | null;
    is_published?: boolean;
    portal_card_url?: string;
  };
  let update: Patch;

  switch (body.action) {
    case "set_thumbnail": {
      // The member-portal card image. Only accept files that live in OUR
      // kit-thumbnails bucket — never an arbitrary external URL.
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kit-thumbnails/`;
      const url = (body.portalCardUrl ?? "").trim();
      if (!url.startsWith(prefix)) {
        return NextResponse.json({ error: "Thumbnail must be uploaded to the kit-thumbnails bucket first." }, { status: 400 });
      }
      update = { portal_card_url: url };
      break;
    }
    case "approve":
      update = {
        submission_status: "approved",
        approved_by: guard.adminId,
        // approved_at is stamped by the trigger when transitioning into approved
        rejected_reason: null,
      };
      break;
    case "reject":
      update = {
        submission_status: "rejected",
        rejected_reason: body.reason ?? null,
      };
      break;
    case "publish":
      update = { is_published: true };
      break;
    case "unpublish":
      update = { is_published: false };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error, count } = await sb
    .from("resources")
    .update(update, { count: "exact" })
    .eq("topic_slug", slug);

  if (error) return serverError(error, { route: "PATCH /api/admin/resources/[slug]" });

  return NextResponse.json({ ok: true, rowsUpdated: count ?? 0 });
}

/**
 * DELETE /api/admin/resources/[slug]
 *
 * Deletes every row in the kit (cascade also removes the member_resource_progress
 * rows automatically via the foreign-key relationship). The Storage files
 * remain in place — admins can clean them up via the Supabase dashboard if
 * they want, but leaving them is harmless since nothing references them.
 */
export async function DELETE(_req: Request, { params }: { params: RouteParams }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { slug } = await params;
  const sb = getSupabaseAdmin();

  const { error, count } = await sb
    .from("resources")
    .delete({ count: "exact" })
    .eq("topic_slug", slug);

  if (error) return serverError(error, { route: "DELETE /api/admin/resources/[slug]" });
  return NextResponse.json({ ok: true, rowsDeleted: count ?? 0 });
}
