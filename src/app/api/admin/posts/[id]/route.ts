import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["draft", "published", "archived"] as const;

const POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_image_url, author_name, category, tags, status, published_at, created_at, updated_at";

type Params = { params: Promise<{ id: string }> };

function parseTags(raw: unknown): string[] {
  const s = asString(raw);
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function GET(_req: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("blog_posts")
      .select(POST_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ row: data });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH — update fields; re-validates slug uniqueness if slug changed. */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("blog_posts")
      .select("id, slug, status, published_at")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) {
      const title = asString(body.title);
      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      patch.title = title;
    }
    if (body.excerpt !== undefined) {
      const excerpt = asString(body.excerpt);
      if (!excerpt) return NextResponse.json({ error: "Excerpt is required." }, { status: 400 });
      patch.excerpt = excerpt;
    }
    if (body.body !== undefined) {
      const postBody = asString(body.body);
      if (!postBody) return NextResponse.json({ error: "Body is required." }, { status: 400 });
      patch.body = postBody;
    }
    if (body.coverImageUrl !== undefined) {
      patch.cover_image_url = asString(body.coverImageUrl) || null;
    }
    if (body.authorName !== undefined) {
      patch.author_name = asString(body.authorName) || "Aesthetic Success Network";
    }
    if (body.category !== undefined) patch.category = asString(body.category) || null;
    if (body.tags !== undefined) patch.tags = parseTags(body.tags);

    if (body.slug !== undefined) {
      const slug = asString(body.slug).toLowerCase();
      if (!slug) return NextResponse.json({ error: "Slug is required." }, { status: 400 });
      if (slug !== (existing.slug as string).toLowerCase()) {
        const { data: dupe, error: dupeError } = await supabase
          .from("blog_posts")
          .select("id")
          .ilike("slug", slug)
          .neq("id", id)
          .maybeSingle();
        if (dupeError) throw dupeError;
        if (dupe) {
          return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
        }
      }
      patch.slug = slug;
    }

    if (body.status !== undefined) {
      const status = asString(body.status);
      if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      patch.status = status;
      if (status === "published" && !existing.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "blog_post", id, "update");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "blog_post", id, "delete");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
