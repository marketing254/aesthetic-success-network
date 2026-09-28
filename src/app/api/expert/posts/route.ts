import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT = 4000;
const MAX_URL = 500;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * GET /api/expert/posts
 *
 * Returns the signed-in expert's OWN posts (including drafts + hidden)
 * with reaction/comment counts. The /api/network/feed endpoint is what
 * shows the public feed to members/partners — this endpoint is the
 * expert's authoring view.
 */
export async function GET() {
  const route = "GET /api/expert/posts";
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("expert_posts")
      .select(
        "id, content, image_url, link_url, status, published_at, hidden_at, hidden_reason, reaction_count, comment_count, created_at",
      )
      .eq("expert_id", guard.expertId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * POST /api/expert/posts
 *
 * Body: { content: string, link_url?: string, image_url?: string, draft?: boolean }
 * Creates a new post. Defaults to status='published'; pass draft:true to
 * save without publishing.
 */
export async function POST(req: Request) {
  const route = "POST /api/expert/posts";
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  let body: {
    content?: string;
    link_url?: string;
    image_url?: string;
    draft?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest("That submission isn't valid. Please try again.", route);
  }

  const content = (body.content ?? "").trim();
  if (content.length < 1 || content.length > MAX_CONTENT) {
    return apiError.validation(
      `Post must be between 1 and ${MAX_CONTENT} characters.`,
      route,
    );
  }

  const linkUrl = (body.link_url ?? "").trim() || null;
  if (linkUrl && (linkUrl.length > MAX_URL || !URL_RE.test(linkUrl))) {
    return apiError.validation("Please paste a full https:// link.", route);
  }

  const imageUrl = (body.image_url ?? "").trim() || null;
  if (imageUrl && (imageUrl.length > MAX_URL || !URL_RE.test(imageUrl))) {
    return apiError.validation("Please paste a full https:// image URL.", route);
  }

  const status = body.draft ? "draft" : "published";
  const publishedAt = status === "published" ? new Date().toISOString() : null;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("expert_posts")
      .insert({
        expert_id: guard.expertId,
        content,
        link_url: linkUrl,
        image_url: imageUrl,
        status,
        published_at: publishedAt,
      })
      .select(
        "id, content, image_url, link_url, status, published_at, reaction_count, comment_count, created_at",
      )
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, post: data });
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * DELETE /api/expert/posts?id=<uuid>
 *
 * Soft-deletes a post (status='deleted'). Cascades to reactions+comments
 * via FK on delete cascade if the row is ever hard-removed.
 */
export async function DELETE(req: Request) {
  const route = "DELETE /api/expert/posts";
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError.badRequest("Missing post identifier.", route);

  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from("expert_posts")
      .select("id, expert_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return apiError.notFound(route);
    if (row.expert_id !== guard.expertId) {
      return apiError.forbidden(route);
    }

    const { error } = await admin
      .from("expert_posts")
      .update({ status: "deleted" })
      .eq("id", row.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}
