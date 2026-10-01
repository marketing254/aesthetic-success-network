import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/resources/feedback?topic_slug=...
 *
 * Returns { submitted: boolean } so the client can decide whether to
 * pop the mid-kit feedback prompt at 50%.
 */
export async function GET(req: Request) {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const topicSlug = url.searchParams.get("topic_slug");
  if (!topicSlug) return apiError.badRequest();

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("resource_feedback")
    .select("id")
    .eq("member_id", guard.memberId)
    .eq("topic_slug", topicSlug)
    .maybeSingle();
  return NextResponse.json({ submitted: !!data });
}

/**
 * POST /api/member/resources/feedback
 *
 * Body: { topic_slug, rating (1-5), comment?, progress_pct }
 *
 * Insert-only. Re-submission for the same (member, topic) silently
 * succeeds via onConflict do nothing — the first answer is the honest
 * one; we don't let users walk theirs back.
 */
export async function POST(req: Request) {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  let body: { topic_slug?: string; rating?: number; comment?: string; progress_pct?: number };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const topicSlug = (body.topic_slug ?? "").trim();
  const rating = Number(body.rating);
  const progressPct = Math.max(0, Math.min(100, Math.floor(Number(body.progress_pct ?? 50))));
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null;

  if (!topicSlug || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return apiError.validation("Rating must be a whole number 1–5.");
  }

  try {
    const admin = getSupabaseAdmin();
    // ignoreDuplicates so a re-submit just no-ops.
    const { error } = await admin
      .from("resource_feedback")
      .upsert(
        {
          member_id: guard.memberId,
          topic_slug: topicSlug,
          rating,
          comment: comment || null,
          progress_pct: progressPct,
        },
        { onConflict: "member_id,topic_slug", ignoreDuplicates: true },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "POST /api/member/resources/feedback" });
  }
}
