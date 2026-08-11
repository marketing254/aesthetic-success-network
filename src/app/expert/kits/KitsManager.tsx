"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { EmptyState, SectionCard, StatusChip, formatDate } from "@/components/portal/ui";
import { KIT_CATEGORIES } from "@/lib/portal/constants";

export type KitRow = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string | null;
  resource_url: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
};

type Draft = {
  id: string | null;
  title: string;
  category: string;
  summary: string;
  content: string;
  resourceUrl: string;
};

const EMPTY: Draft = { id: null, title: "", category: "", summary: "", content: "", resourceUrl: "" };

function toDraft(kit: KitRow): Draft {
  return {
    id: kit.id,
    title: kit.title,
    category: kit.category ?? "",
    summary: kit.summary ?? "",
    content: kit.content ?? "",
    resourceUrl: kit.resource_url ?? "",
  };
}

export default function KitsManager({ initialKits }: { initialKits: KitRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async (status: "draft" | "published") => {
    if (!draft) return;
    setErr(null);
    setBusy(status);
    const payload = { ...draft, status };
    try {
      const res = await fetch("/api/portal/expert/kits", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not save the kit.");
        setBusy(null);
        return;
      }
      setDraft(null);
      setBusy(null);
      router.refresh();
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setBusy(null);
    }
  };

  const archive = async (kit: KitRow) => {
    setBusy(kit.id);
    try {
      await fetch("/api/portal/expert/kits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toDraft(kit), status: "archived" }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionCard
        title={`${initialKits.length} kit${initialKits.length === 1 ? "" : "s"}`}
        padded={initialKits.length === 0}
        action={
          <Button size="small" variant="contained" onClick={() => setDraft({ ...EMPTY })}>
            New kit
          </Button>
        }
      >
        {initialKits.length === 0 ? (
          <EmptyState
            title="No kits yet"
            description="Publish a playbook, script or checklist. Members see it in their library the moment you publish."
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {initialKits.map((k) => (
              <Stack
                key={k.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ px: 3, py: 2.25, alignItems: { sm: "center" }, justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>{k.title}</Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                    {k.category ? `${k.category} · ` : ""}
                    {k.status === "published"
                      ? `Published ${formatDate(k.published_at)}`
                      : `Updated ${formatDate(k.updated_at)}`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <StatusChip status={k.status} />
                  <Button size="small" variant="outlined" onClick={() => setDraft(toDraft(k))}>
                    Edit
                  </Button>
                  {k.status !== "archived" && (
                    <Button
                      size="small"
                      onClick={() => void archive(k)}
                      disabled={busy === k.id}
                      sx={{ color: "text.secondary" }}
                    >
                      Archive
                    </Button>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </SectionCard>

      <Dialog
        open={draft !== null}
        onClose={() => busy === null && setDraft(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "20px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>
          {draft?.id ? "Edit kit" : "New kit"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {err && (
              <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
                {err}
              </Alert>
            )}
            <TextField
              label="Title"
              value={draft?.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <TextField
              label="Category"
              select
              value={draft?.category ?? ""}
              onChange={(e) => set("category", e.target.value)}
            >
              <MenuItem value="">
                <em>No category</em>
              </MenuItem>
              {KIT_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Summary"
              placeholder="One or two sentences on what this kit does for the reader."
              value={draft?.summary ?? ""}
              onChange={(e) => set("summary", e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 600 } }}
            />
            <TextField
              label="Content"
              placeholder="The kit itself — steps, scripts, checklists. Blank lines separate paragraphs."
              value={draft?.content ?? ""}
              onChange={(e) => set("content", e.target.value)}
              multiline
              minRows={12}
              slotProps={{ htmlInput: { maxLength: 40000 } }}
              helperText="60 characters minimum to publish."
            />
            <TextField
              label="Resource link (optional)"
              placeholder="https://…"
              value={draft?.resourceUrl ?? ""}
              onChange={(e) => set("resourceUrl", e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDraft(null)} disabled={busy !== null} sx={{ color: "text.secondary" }}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => void save("draft")}
            disabled={busy !== null}
            endIcon={busy === "draft" ? <CircularProgress size={14} /> : undefined}
          >
            Save draft
          </Button>
          <Button
            variant="contained"
            onClick={() => void save("published")}
            disabled={busy !== null}
            endIcon={busy === "published" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
          >
            Publish to members
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
