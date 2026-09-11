import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_image_url, author_name, category, tags, status, published_at, created_at, updated_at";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("blog_posts")
      .select(POST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

const STATUSES = ["draft", "published", "archived"] as const;

function parseTags(raw: unknown): string[] {
  const s = asString(raw);
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** POST — create a blog post. Slug must be unique (case-insensitive). */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const title = asString(body.title);
  const excerpt = asString(body.excerpt);
  const postBody = asString(body.body);
  const slug = asString(body.slug).toLowerCase();
  const coverImageUrl = asString(body.coverImageUrl);
  const authorName = asString(body.authorName) || "Aesthetic Success Network";
  const category = asString(body.category);
  const tags = parseTags(body.tags);
  const statusRaw = asString(body.status) || "draft";
  const status = STATUSES.includes(statusRaw as (typeof STATUSES)[number]) ? statusRaw : "draft";

  if (!title || !excerpt || !postBody) {
    return NextResponse.json(
      { error: "Title, excerpt and body are required." },
      { status: 400 },
    );
  }
  if (!slug) {
    return NextResponse.json({ error: "Slug is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("blog_posts")
      .select("id")
      .ilike("slug", slug)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("blog_posts")
      .insert({
        slug,
        title,
        excerpt,
        body: postBody,
        cover_image_url: coverImageUrl || null,
        author_name: authorName,
        category: category || null,
        tags,
        status,
        published_at: status === "published" ? now : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "blog_post", inserted.id as string, "create");
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
