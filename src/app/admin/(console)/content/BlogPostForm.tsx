"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export type BlogPostFormInitial = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author_name: string;
  category: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default function BlogPostForm({ initial }: { initial?: BlogPostFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url ?? "");
  const [authorName, setAuthorName] = useState(
    initial?.author_name ?? "Aesthetic Success Network",
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    initial?.status ?? "draft",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const onSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(value);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        title,
        slug: slug || slugify(title),
        excerpt,
        body,
        coverImageUrl,
        authorName,
        category,
        tags,
        status,
      };
      const res = await fetch(isEdit ? `/api/admin/posts/${initial!.id}` : "/api/admin/posts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resBody = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !resBody.ok) throw new Error(resBody.error ?? "Could not save the post.");
      router.push("/admin/content");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        p: 2.5,
        borderRadius: "16px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "common.white",
        maxWidth: 720,
      }}
    >
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
        {isEdit ? "Edit post" : "New blog post"}
      </Typography>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="Title"
          size="small"
          required
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <TextField
          label="Slug"
          size="small"
          required
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          helperText="Used in the public URL, e.g. /blog/your-slug. Auto-filled from the title."
        />

        <TextField
          label="Excerpt"
          size="small"
          required
          multiline
          minRows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="One or two sentences shown on the blog index."
        />

        <TextField
          label="Body"
          size="small"
          required
          multiline
          minRows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Plain paragraphs, separated by a blank line."
          helperText="Write as plain paragraphs separated by a blank line — no markdown needed."
        />

        <TextField
          label="Cover image URL"
          size="small"
          type="url"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://…"
        />

        <TextField
          label="Author name"
          size="small"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />

        <TextField
          label="Category"
          size="small"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Pricing & Margins"
        />

        <TextField
          label="Tags"
          size="small"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated, tags"
        />

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          size="small"
        >
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </Select>

        <Stack direction="row" spacing={1.5}>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create post"}
          </Button>
          <Button variant="outlined" onClick={() => router.push("/admin/content")} disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
