import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMMENT = 2000;

/**
 * GET /api/network/posts/[id]/comments
 *
 * Returns all visible comments on a post, oldest first. Open to anyone
 * signed in who resolves to a network author.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("post_comments")
      .select(
        "id, post_id, author_auth_user_id, author_kind, author_display_name, author_subtitle, content, created_at",
      )
      .eq("post_id", postId)
      .is("hidden_at", null)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({
      comments: data ?? [],
      viewer: { authUserId: author.authUserId, kind: author.kind },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/network/posts/[id]/comments" });
  }
}

/**
 * POST /api/network/posts/[id]/comments
 *
 * Body: { content: string }
 * Creates a comment authored by the current signed-in user. Identity
 * (kind, display name, subtitle) is captured server-side from the
 * resolver — clients can't spoof.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }

  const content = (body.content ?? "").trim();
  if (content.length < 1 || content.length > MAX_COMMENT) {
    return apiError.validation(
      `Comment must be between 1 and ${MAX_COMMENT} characters.`,
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: post } = await admin
      .from("expert_posts")
      .select("id, status")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.status !== "published") return apiError.notFound();

    const { data: inserted, error } = await admin
      .from("post_comments")
      .insert({
        post_id: postId,
        author_auth_user_id: author.authUserId,
        author_kind: author.kind,
        author_display_name: author.displayName,
        author_subtitle: author.subtitle,
        content,
      })
      .select(
        "id, post_id, author_auth_user_id, author_kind, author_display_name, author_subtitle, content, created_at",
      )
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, comment: inserted });
  } catch (err) {
    return serverError(err, { route: "POST /api/network/posts/[id]/comments" });
  }
}

/**
 * DELETE /api/network/posts/[id]/comments?comment_id=<uuid>
 *
 * Authors can delete their own comments. The post's expert can also
 * delete any comment on their own post (light moderation).
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  const url = new URL(req.url);
  const commentId = url.searchParams.get("comment_id");
  if (!commentId) return apiError.badRequest();

  try {
    const admin = getSupabaseAdmin();
    const { data: comment } = await admin
      .from("post_comments")
      .select("id, author_auth_user_id, post_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment || comment.post_id !== postId) return apiError.notFound();

    let canDelete = comment.author_auth_user_id === author.authUserId;
    if (!canDelete && author.kind === "expert") {
      // The post's owning expert can also delete (mod on own post).
      const { data: post } = await admin
        .from("expert_posts")
        .select("expert_id")
        .eq("id", postId)
        .maybeSingle();
      if (post?.expert_id === author.roleId) canDelete = true;
    }
    if (!canDelete) return apiError.forbidden();

    const { error } = await admin.from("post_comments").delete().eq("id", commentId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "DELETE /api/network/posts/[id]/comments" });
  }
}
