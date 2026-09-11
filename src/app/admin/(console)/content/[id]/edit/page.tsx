import { notFound } from "next/navigation";
import { Box, Stack, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import BlogPostForm, { type BlogPostFormInitial } from "../../BlogPostForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let post: BlogPostFormInitial | null = null;
  let error: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error: rowError } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, body, cover_image_url, author_name, category, tags, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (rowError) throw rowError;
    post = (data as BlogPostFormInitial | null) ?? null;
  } catch (err) {
    error = errMessage(err);
  }

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          CONTENT
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Edit post
        </Typography>
        <Typography sx={{ color: "error.main" }}>Could not load this post: {error}</Typography>
      </Box>
    );
  }

  if (!post) return notFound();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          CONTENT
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Edit post
        </Typography>
      </Box>

      <BlogPostForm initial={post} />
    </Stack>
  );
}
