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
import { DEAL_CATEGORIES } from "@/lib/portal/constants";

export type DealRow = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  deal_terms: string | null;
  redemption_url: string | null;
  redemption_note: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
};

type Draft = {
  id: string | null;
  title: string;
  category: string;
  description: string;
  dealTerms: string;
  redemptionUrl: string;
  redemptionNote: string;
};

const EMPTY: Draft = {
  id: null,
  title: "",
  category: "",
  description: "",
  dealTerms: "",
  redemptionUrl: "",
  redemptionNote: "",
};

function toDraft(deal: DealRow): Draft {
  return {
    id: deal.id,
    title: deal.title,
    category: deal.category ?? "",
    description: deal.description ?? "",
    dealTerms: deal.deal_terms ?? "",
    redemptionUrl: deal.redemption_url ?? "",
    redemptionNote: deal.redemption_note ?? "",
  };
}

export default function DealsManager({ initialDeals }: { initialDeals: DealRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async (status: "draft" | "pending_review") => {
    if (!draft) return;
    setErr(null);
    setBusy(status);
    try {
      const res = await fetch("/api/portal/partner/deals", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, status }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not save the deal.");
        setBusy(null);
        return;
      }
      setDraft(null);
      setBusy(null);
      if (status === "pending_review") setNote("Submitted. Our team reviews it and publishes if it's a fit.");
      router.refresh();
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setBusy(null);
    }
  };

  const archive = async (deal: DealRow) => {
    setBusy(deal.id);
    try {
      await fetch("/api/portal/partner/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toDraft(deal), status: "archived" }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {note && (
        <Alert severity="success" onClose={() => setNote(null)} sx={{ mb: 2, fontSize: "0.84rem" }}>
          {note}
        </Alert>
      )}

      <SectionCard
        title={`${initialDeals.length} deal${initialDeals.length === 1 ? "" : "s"}`}
        padded={initialDeals.length === 0}
        action={
          <Button size="small" variant="contained" onClick={() => setDraft({ ...EMPTY })}>
            New deal
          </Button>
        }
      >
        {initialDeals.length === 0 ? (
          <EmptyState
            title="No deals yet"
            description="Create your member offer, then submit it for review. Members only ever see approved deals."
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {initialDeals.map((d) => (
              <Stack
                key={d.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ px: 3, py: 2.25, alignItems: { sm: "center" }, justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>{d.title}</Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                    {d.category ? `${d.category} · ` : ""}
                    {d.status === "published"
                      ? `Live since ${formatDate(d.published_at)}`
                      : `Updated ${formatDate(d.updated_at)}`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <StatusChip status={d.status} />
                  <Button size="small" variant="outlined" onClick={() => setDraft(toDraft(d))}>
                    Edit
                  </Button>
                  {d.status !== "archived" && (
                    <Button
                      size="small"
                      onClick={() => void archive(d)}
                      disabled={busy === d.id}
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
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "20px" } } }}
      >
        <DialogTitle sx={{ fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>
          {draft?.id ? "Edit deal" : "New deal"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {err && (
              <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
                {err}
              </Alert>
            )}
            <TextField
              label="Deal title"
              placeholder="e.g. 20% off your first device service contract"
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
              {DEAL_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="What you do"
              placeholder="A short description of your company and what members get from working with you."
              value={draft?.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              multiline
              minRows={3}
              slotProps={{ htmlInput: { maxLength: 1200 } }}
            />
            <TextField
              label="The member deal"
              placeholder="Be specific: the discount, the terms, and how long it's valid."
              value={draft?.dealTerms ?? ""}
              onChange={(e) => set("dealTerms", e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 600 } }}
              helperText="Required before you can submit for review."
            />
            <TextField
              label="Redemption link (optional)"
              placeholder="https://…"
              value={draft?.redemptionUrl ?? ""}
              onChange={(e) => set("redemptionUrl", e.target.value)}
            />
            <TextField
              label="Redemption instructions (optional)"
              placeholder="e.g. Mention code ASN2026 when you book a demo."
              value={draft?.redemptionNote ?? ""}
              onChange={(e) => set("redemptionNote", e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 600 } }}
            />
            <Typography variant="body2" sx={{ fontSize: "0.79rem" }}>
              Editing a deal that&apos;s already live sends it back for review, so members never see a
              change we haven&apos;t checked.
            </Typography>
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
            onClick={() => void save("pending_review")}
            disabled={busy !== null}
            endIcon={
              busy === "pending_review" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined
            }
          >
            Submit for review
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
