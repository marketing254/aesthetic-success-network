import { Box, Stack, Typography } from "@mui/material";
import BlogPostForm from "../BlogPostForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewBlogPostPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          CONTENT
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          New blog post
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
          Publish an article to the public Aesthetic Success Network blog.
        </Typography>
      </Box>

      <BlogPostForm />
    </Stack>
  );
}
