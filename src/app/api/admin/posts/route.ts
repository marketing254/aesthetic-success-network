import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT = 4000;
const MAX_URL = 500;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * POST /api/admin/posts
 *
 * Admin composer for the network feed. Posts on behalf of an expert —
 * useful when an expert is too busy to publish themselves but the team
 * wants to announce a new kit, a podcast episode, or an upcoming event.
 *
 * Body: { expert_id, content, link_url?, image_url?, draft? }
 *
 * The resulting row is identical to one the expert would have posted
 * themselves; the feed renders it under their name + headshot.
 */
export async function POST(req: Request) {
  const route = "POST /api/admin/posts";
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    expert_id?: string;
    content?: string;
    link_url?: string;
    image_url?: string;
    draft?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const expertId = (body.expert_id ?? "").trim();
  if (!expertId) return apiError.validation("Choose an expert to post as.", route);

  const content = (body.content ?? "").trim();
  if (content.length < 1 || content.length > MAX_CONTENT) {
    return apiError.validation(`Content must be 1–${MAX_CONTENT} chars.`, route);
  }

  const linkUrl = (body.link_url ?? "").trim() || null;
  if (linkUrl && (linkUrl.length > MAX_URL || !URL_RE.test(linkUrl))) {
    return apiError.validation("Paste a full https:// URL.", route);
  }

  const imageUrl = (body.image_url ?? "").trim() || null;
  if (imageUrl && imageUrl.length > MAX_URL) {
    return apiError.validation("Image URL is too long.", route);
  }

  const draft = !!body.draft;

  try {
    const admin = getSupabaseAdmin();

    // Confirm the expert exists + isn't archived/suspended.
    const { data: expert } = await admin
      .from("experts")
      .select("id, status")
      .eq("id", expertId)
      .maybeSingle();
    if (!expert) return apiError.notFound(route);
    if (expert.status === "archived" || expert.status === "suspended") {
      return apiError.validation("Expert is not active.", route);
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await admin
      .from("expert_posts")
      .insert({
        expert_id: expertId,
        content,
        link_url: linkUrl,
        image_url: imageUrl,
        status: draft ? "draft" : "published",
        published_at: draft ? null : now,
        // Flag the row so an audit can trace admin-authored posts later.
        composed_by_admin_id: guard.adminId,
      })
      .select("id, content, status, published_at, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, post: inserted });
  } catch (err) {
    return serverError(err, { route });
  }
}
