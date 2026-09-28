import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/resources/[id]/progress
 *
 * Upserts the member's progress row for a resource.
 * Body: { action: 'view' | 'complete', watch_seconds?: number }
 *   - 'view'     → set last_viewed_at = now(), optionally bump watch_seconds
 *   - 'complete' → set completed_at = now() and last_viewed_at = now()
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id: resourceId } = await ctx.params;
  if (!resourceId) {
    return NextResponse.json({ error: "Missing resource id." }, { status: 400 });
  }

  let body: { action?: "view" | "complete"; watch_seconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const action = body.action ?? "view";
  if (action !== "view" && action !== "complete") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Confirm the resource exists and is published.
  const { data: resource } = await sb
    .from("resources")
    .select("id, is_published")
    .eq("id", resourceId)
    .maybeSingle();
  if (!resource || !resource.is_published) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const row: {
    member_id: string;
    resource_id: string;
    last_viewed_at: string;
    completed_at?: string;
    watch_seconds?: number;
  } = {
    member_id: guard.memberId,
    resource_id: resourceId,
    last_viewed_at: now,
  };
  if (action === "complete") row.completed_at = now;
  if (typeof body.watch_seconds === "number" && body.watch_seconds >= 0) {
    row.watch_seconds = Math.floor(body.watch_seconds);
  }

  const { error } = await sb
    .from("member_resource_progress")
    .upsert(row, { onConflict: "member_id,resource_id" });
  if (error) return serverError(error, { route: "POST /api/member/resources/[id]/progress" });

  // Record an explicit view event for the analytics dashboard. Best-effort —
  // a failed insert here mustn't block the progress update.
  if (action === "view") {
    try {
      await sb.from("resource_views").insert({
        resource_id: resourceId,
        member_id: guard.memberId,
        user_agent: req.headers.get("user-agent")?.slice(0, 256) ?? null,
      });
    } catch {
      /* analytics best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}
