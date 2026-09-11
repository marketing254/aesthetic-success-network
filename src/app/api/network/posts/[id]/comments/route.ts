import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { clientIp } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/network/posts/[id]/comments — full flat thread, oldest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("network_post_comments")
      .select("id, author_kind, author_display_name, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/network/posts/[id]/comments
 * Body: { content: string }
 * Flat comments only — no threading/replies in this pass, matching TD v1.
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
  const content = String((json as { content?: unknown })?.content ?? "").trim();
  if (content.length < 1 || content.length > 2000) {
    return NextResponse.json({ error: "Comment must be 1–2000 characters." }, { status: 400 });
  }

  const rl = checkRateLimit(`network-comment:${clientIp(req)}:${userData.user.id}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "You're commenting a lot right now. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: post } = await admin.from("network_posts").select("id").eq("id", postId).maybeSingle();
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    const { data, error } = await admin
      .from("network_post_comments")
      .insert({
        post_id: postId,
        auth_user_id: userData.user.id,
        author_kind: author.kind,
        author_display_name: author.displayName,
        content,
      })
      .select("id, author_kind, author_display_name, content, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, comment: data });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
