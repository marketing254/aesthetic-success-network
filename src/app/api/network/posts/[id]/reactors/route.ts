import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/network/posts/[id]/reactors
 *
 * Returns who reacted to a post, newest first, capped at 50. Used by the
 * hover tooltip on the reaction count chip in the feed. Caller must be a
 * recognised network participant (member/expert/partner/admin).
 *
 * Returned author_display_name + author_kind already live on the row
 * (denormalised at write time), so this is a single-table read — no joins.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("post_reactions")
      .select("kind, author_kind, author_display_name, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const reactors = (data ?? []).map((r) => ({
      kind: r.kind,
      author_kind: r.author_kind,
      author_display_name: r.author_display_name,
      reacted_at: r.created_at,
    }));
    return NextResponse.json({ reactors });
  } catch (err) {
    return serverError(err, { route: "GET /api/network/posts/[id]/reactors" });
  }
}
