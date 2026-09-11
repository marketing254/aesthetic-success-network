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

export type ExpertOption = {
  id: string;
  full_name: string;
  company: string | null;
};

export type ResourceFormInitial = {
  id: string;
  expert_id: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string | null;
  resource_url: string | null;
  status: "draft" | "published" | "archived";
};

export default function ResourceForm({
  experts,
  initial,
}: {
  experts: ExpertOption[];
  initial?: ResourceFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [expertId, setExpertId] = useState(initial?.expert_id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [resourceUrl, setResourceUrl] = useState(initial?.resource_url ?? "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    initial?.status ?? "draft",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        expertId,
        title,
        category,
        summary,
        content,
        resourceUrl,
        status,
      };
      const res = await fetch(
        isEdit ? `/api/admin/resources/${initial!.id}` : "/api/admin/resources",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not save the resource.");
      router.push("/admin/resources");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the resource.");
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
        {isEdit ? "Edit resource" : "New expert kit"}
      </Typography>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Stack spacing={2}>
        <Select
          value={expertId}
          onChange={(e) => setExpertId(e.target.value)}
          displayEmpty
          size="small"
          required
        >
          <MenuItem value="" disabled>
            Select owning expert
          </MenuItem>
          {experts.map((ex) => (
            <MenuItem key={ex.id} value={ex.id}>
              {ex.full_name}
              {ex.company ? ` — ${ex.company}` : ""}
            </MenuItem>
          ))}
        </Select>

        <TextField
          label="Title"
          size="small"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <TextField
          label="Category"
          size="small"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Pricing, Staffing, Marketing"
        />

        <TextField
          label="Summary"
          size="small"
          multiline
          minRows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two sentences shown on the resource card."
        />

        <TextField
          label="Content"
          size="small"
          multiline
          minRows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="The full body of the kit."
        />

        <TextField
          label="Resource URL"
          size="small"
          type="url"
          value={resourceUrl}
          onChange={(e) => setResourceUrl(e.target.value)}
          placeholder="https://…"
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
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create resource"}
          </Button>
          <Button variant="outlined" onClick={() => router.push("/admin/resources")} disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
