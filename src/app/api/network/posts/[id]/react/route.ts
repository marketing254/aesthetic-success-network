import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REACTION_KINDS = new Set(["heart", "insightful", "helpful", "agree"]);

/**
 * POST /api/network/posts/[id]/react
 * Body: { kind: "heart" | "insightful" | "helpful" | "agree" }
 *
 * One reaction per viewer per post. Sending the same kind again removes
 * it (toggle off); sending a different kind switches it.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return NextResponse.json({ error: "No network profile." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const kind = String((json as { kind?: unknown })?.kind ?? "heart");
  if (!REACTION_KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown reaction kind." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: post } = await admin.from("network_posts").select("id").eq("id", postId).maybeSingle();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    const { data: existing } = await admin
      .from("network_post_reactions")
      .select("id, kind")
      .eq("post_id", postId)
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (existing && existing.kind === kind) {
      const { error } = await admin.from("network_post_reactions").delete().eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, reaction: null });
    }

    if (existing) {
      const { error } = await admin.from("network_post_reactions").update({ kind }).eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, reaction: kind });
    }

    const { error } = await admin.from("network_post_reactions").insert({
      post_id: postId,
      auth_user_id: userData.user.id,
      author_kind: author.kind,
      author_display_name: author.displayName,
      kind,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, reaction: kind });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
