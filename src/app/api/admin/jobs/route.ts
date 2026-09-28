import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import type { JobStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jobs
 *
 * The moderation + promotion queue in one payload: everything pending
 * review, everything live (which is the promotion worklist), and the
 * counts the dashboard badge needs.
 *
 * `?status=` narrows it; the default returns the two states an admin
 * actually works from.
 */
const VALID_STATUSES: JobStatus[] = [
  "draft",
  "pending_review",
  "live",
  "rejected",
  "expired",
  "filled",
];

export async function GET(req: Request) {
  const route = "GET /api/admin/jobs";
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as JobStatus)
    ? (statusParam as JobStatus)
    : null;

  try {
    const admin = getSupabaseAdmin();

    // `select("*")` because supabase-js only infers row types from a
    // string literal, and the admin view reads nearly every column.
    let query = admin.from("job_posts").select("*");
    if (status) {
      query = query.eq("status", status);
    } else {
      // Default view: the work. Pending first (oldest first — a queue
      // that surfaces newest first quietly starves the oldest post),
      // then live, so promotion can be ticked off in the same screen.
      query = query.in("status", ["pending_review", "live"]);
    }

    const [{ data: jobs, error }, { data: all }] = await Promise.all([
      query.order("submitted_at", { ascending: true, nullsFirst: false }).limit(300),
      admin
        .from("job_posts")
        .select("status, view_count, approved_at, promoted_facebook_at, promoted_email_at"),
    ]);
    if (error) throw error;

    // Poster identity for the queue rows. Fetched in one pass rather
    // than per row — this list is read on every admin page load.
    const memberIds = Array.from(new Set((jobs ?? []).map((j) => j.member_id)));
    const posters = new Map<string, { name: string; email: string; practice: string | null }>();
    if (memberIds.length > 0) {
      const { data: members } = await admin
        .from("members")
        .select("id, first_name, last_name, email, practice_name")
        .in("id", memberIds);
      for (const m of members ?? []) {
        posters.set(m.id, {
          name: [m.first_name, m.last_name].filter(Boolean).join(" "),
          email: m.email,
          practice: m.practice_name,
        });
      }
    }

    const rows = (all ?? []) as {
      status: JobStatus;
      view_count: number;
      approved_at: string | null;
      promoted_facebook_at: string | null;
      promoted_email_at: string | null;
    }[];
    const monthAgo = Date.now() - 30 * 86_400_000;
    const stats = {
      pending: rows.filter((r) => r.status === "pending_review").length,
      live: rows.filter((r) => r.status === "live").length,
      filled: rows.filter((r) => r.status === "filled").length,
      expired: rows.filter((r) => r.status === "expired").length,
      // "Posts this month" counts what went LIVE, not what was
      // submitted — it's the number that describes the board.
      liveThisMonth: rows.filter(
        (r) => r.approved_at && new Date(r.approved_at).getTime() >= monthAgo,
      ).length,
      totalViews: rows.reduce((n, r) => n + (r.view_count ?? 0), 0),
      // Live posts with promotion work still outstanding on EITHER
      // channel — a post already in the group but not yet in the weekly
      // email still has a job to do, so this is `||`, not `&&`.
      //
      // Approving a post is only half the work. The promotion is what
      // the member is actually paying for, so this backlog is the number
      // that says whether we are delivering the thing we sold.
      awaitingPromotion: rows.filter(
        (r) => r.status === "live" && (!r.promoted_facebook_at || !r.promoted_email_at),
      ).length,
    };

    return NextResponse.json({
      ok: true,
      jobs: (jobs ?? []).map((j) => ({ ...j, poster: posters.get(j.member_id) ?? null })),
      stats,
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
