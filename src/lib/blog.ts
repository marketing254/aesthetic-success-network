import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Public blog reads. Backed by `blog_posts` (0012), always read through
 * the service-role client — same pattern as /api/directory/* — since
 * there's no anon-key policy for this table. Only `status = 'published'`
 * rows are ever returned to a page.
 */

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  authorName: string;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
};

export type BlogPost = BlogPostSummary & {
  body: string;
};

const SUMMARY_COLUMNS =
  "slug, title, excerpt, cover_image_url, author_name, category, tags, published_at";

function toSummary(row: Record<string, unknown>): BlogPostSummary {
  return {
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    coverImageUrl: (row.cover_image_url as string) ?? null,
    authorName: (row.author_name as string) ?? "Aesthetic Success Network",
    category: (row.category as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    publishedAt: (row.published_at as string) ?? null,
  };
}

export async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(`${SUMMARY_COLUMNS}, body`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...toSummary(data), body: data.body as string };
}

/** Up to `limit` other published posts, for the "keep reading" rail. */
export async function getRelatedPosts(excludeSlug: string, limit = 3): Promise<BlogPostSummary[]> {
  const all = await getPublishedPosts();
  return all.filter((p) => p.slug !== excludeSlug).slice(0, limit);
}
