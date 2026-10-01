import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";
import type { PostReactionKind } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: ReadonlyArray<PostReactionKind> = [
  "heart",
  "insightful",
  "helpful",
  "agree",
];

/**
 * POST /api/network/posts/[id]/react
 *
 * Body: { kind?: PostReactionKind }  (defaults to 'heart')
 *
 * Toggle behavior: if the user already has a reaction on this post and
 * it matches `kind`, the reaction is removed. If it doesn't match, the
 * existing reaction is updated to the new kind. If they have no
 * reaction yet, one is inserted.
 *
 * Reaction counts on expert_posts are maintained by Postgres triggers
 * (see 0021_network_feed.sql).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  let body: { kind?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawKind = (body.kind ?? "heart").toLowerCase();
  const kind: PostReactionKind = VALID_KINDS.includes(rawKind as PostReactionKind)
    ? (rawKind as PostReactionKind)
    : "heart";

  try {
    const admin = getSupabaseAdmin();

    // Confirm the post exists and is published (else we shouldn't accept).
    const { data: post } = await admin
      .from("expert_posts")
      .select("id, status")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.status !== "published") return apiError.notFound();

    // Existing reaction by this user on this post?
    const { data: existing } = await admin
      .from("post_reactions")
      .select("id, kind")
      .eq("post_id", postId)
      .eq("author_auth_user_id", author.authUserId)
      .maybeSingle();

    if (existing) {
      if (existing.kind === kind) {
        // Toggle off — delete.
        const { error: delErr } = await admin
          .from("post_reactions")
          .delete()
          .eq("id", existing.id);
        if (delErr) throw delErr;
        return NextResponse.json({ ok: true, my_reaction: null });
      }
      // Update to the new kind.
      const { error: updErr } = await admin
        .from("post_reactions")
        .update({ kind })
        .eq("id", existing.id);
      if (updErr) throw updErr;
      return NextResponse.json({ ok: true, my_reaction: kind });
    }

    // Insert fresh.
    const { error: insErr } = await admin.from("post_reactions").insert({
      post_id: postId,
      author_auth_user_id: author.authUserId,
      author_kind: author.kind,
      author_display_name: author.displayName,
      kind,
    });
    if (insErr) throw insErr;
    return NextResponse.json({ ok: true, my_reaction: kind });
  } catch (err) {
    return serverError(err, { route: "POST /api/network/posts/[id]/react" });
  }
}
