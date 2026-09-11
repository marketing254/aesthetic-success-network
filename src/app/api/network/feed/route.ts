import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/network/feed?before=<ISO>&limit=<n>
 *
 * Cursor-paginated network feed, newest first. Any signed-in member,
 * expert, partner or admin can read it. The client polls this on an
 * interval rather than subscribing to Supabase Realtime — see
 * 0024_network_feed.sql for why realtime was deferred this pass.
 */
export async function GET(req: Request) {
  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return NextResponse.json({ error: "No network profile." }, { status: 403 });
  }

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));

  try {
    const admin = getSupabaseAdmin();

    let query = admin
      .from("network_posts")
      .select(
        "id, expert_id, partner_id, author_name, content, link_url, published_at, reaction_count, comment_count, created_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (before) query = query.lt("published_at", before);

    const { data: posts, error } = await query;
    if (error) throw error;

    const postIds = (posts ?? []).map((p) => p.id as string);

    const viewerReactions = new Map<string, string>();
    if (postIds.length > 0) {
      const { data: reactions } = await admin
        .from("network_post_reactions")
        .select("post_id, kind")
        .in("post_id", postIds)
        .eq("auth_user_id", userData.user.id);
      for (const r of reactions ?? []) viewerReactions.set(r.post_id as string, r.kind as string);
    }

    const recentComments = new Map<string, { id: string; author_display_name: string; content: string; created_at: string }[]>();
    if (postIds.length > 0) {
      const { data: comments } = await admin
        .from("network_post_comments")
        .select("id, post_id, author_display_name, content, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false });
      for (const c of comments ?? []) {
        const bucket = recentComments.get(c.post_id as string) ?? [];
        if (bucket.length < 2) bucket.push(c as never);
        recentComments.set(c.post_id as string, bucket);
      }
    }

    const shaped = (posts ?? []).map((p) => ({
      id: p.id,
      authorKind: p.expert_id ? "expert" : "partner",
      authorName: p.author_name,
      content: p.content,
      linkUrl: p.link_url,
      publishedAt: p.published_at ?? p.created_at,
      reactionCount: p.reaction_count,
      commentCount: p.comment_count,
      viewerReaction: viewerReactions.get(p.id as string) ?? null,
      recentComments: (recentComments.get(p.id as string) ?? []).reverse(),
    }));

    const cursor = shaped.length === limit ? shaped[shaped.length - 1]!.publishedAt : null;

    return NextResponse.json({ posts: shaped, cursor, viewer: { kind: author.kind, displayName: author.displayName } });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
