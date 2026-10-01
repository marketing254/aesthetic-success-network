import { createHash } from "node:crypto";
import { clientIp, ipHashSalt } from "@/lib/security/hashIp";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/[slug]/view
 *
 * Records one view of a public job page. Open by design — the board is
 * public, so this endpoint has to be reachable by people with no account.
 *
 * Abuse ceiling is the unique index on (job_post_id, viewer_hash,
 * viewed_on): refreshing, or hammering the endpoint, yields exactly one
 * row per viewer per day. The duplicate is swallowed rather than
 * reported, so a repeat visitor gets a silent 200.
 *
 * Never returns anything about the job. A 200 here means "noted", not
 * "this job exists" — the endpoint shouldn't become a way to enumerate
 * posts that are still in review.
 */
const REFERRER_KINDS = new Set(["direct", "facebook", "google", "internal", "other"]);


/**
 * Salted hash of IP + user agent. We never store the IP itself: this
 * only has to be stable enough to collapse one person's refreshes
 * within a day, and a raw IP on a public-traffic table is a liability
 * with no upside.
 */
function viewerHash(req: Request): string {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  // ipHashSalt() throws in production without IP_HASH_SALT (shared policy).
  return createHash("sha256").update(`${ipHashSalt()}::${ip}:${ua}`).digest("hex").slice(0, 32);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let referrerKind: string | null = null;
  try {
    const body = (await req.json()) as { referrerKind?: string };
    if (body.referrerKind && REFERRER_KINDS.has(body.referrerKind)) {
      referrerKind = body.referrerKind;
    }
  } catch {
    // No body is fine — the view still counts.
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: job } = await admin
      .from("job_posts")
      .select("id, status")
      .eq("slug", slug)
      .maybeSingle();

    // Only count views of a post that's actually on the board. A filled
    // post keeps its page but stops accruing views — the number is
    // meant to describe the hiring window, not lifetime traffic.
    if (!job || job.status !== "live") return NextResponse.json({ ok: true });

    const { error } = await admin.from("job_post_views").insert({
      job_post_id: job.id,
      viewer_hash: viewerHash(req),
      referrer_kind: referrerKind,
    });
    // 23505 = unique violation = same viewer, same day. Expected, not an error.
    if (error && error.code !== "23505") {
      console.error("[jobs:view] insert failed", { slug, code: error.code });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // A view that doesn't record must never break the page for a
    // candidate who's trying to read a job ad.
    console.error("[jobs:view] failed", err);
    return NextResponse.json({ ok: true });
  }
}
