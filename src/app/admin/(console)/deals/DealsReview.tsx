"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { StatusChip, formatDateTime } from "@/components/portal/ui";
import type { VendorDeal } from "@/lib/portal/data";

const TABS = [
  { key: "pending_review", label: "In review" },
  { key: "published", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "all", label: "All" },
] as const;

export default function DealsReview({ initialDeals }: { initialDeals: VendorDeal[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending_review");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      pending_review: initialDeals.filter((d) => d.status === "pending_review").length,
      published: initialDeals.filter((d) => d.status === "published").length,
      draft: initialDeals.filter((d) => d.status === "draft").length,
      all: initialDeals.length,
    }),
    [initialDeals],
  );

  const rows = useMemo(() => {
    const byTab = initialDeals.filter((d) => (tab === "all" ? true : d.status === tab));
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((d) =>
      [d.title, d.company_name, d.category ?? "", d.deal_terms ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [initialDeals, tab, query]);

  const act = async (id: string, action: "publish" | "send_back" | "archive") => {
    setErr(null);
    setBusy(id);
    try {
      const res = await fetch("/api/admin/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "That didn't work. Try again.");
        setBusy(null);
        return;
      }
      router.refresh();
      setBusy(null);
    } catch {
      setErr("Could not reach the server.");
      setBusy(null);
    }
  };

  return (
    <Box>
      <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
        PARTNER OFFERS
      </Typography>
      <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
        Vendor deals
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, maxWidth: 640 }}>
        Nothing reaches members until it&apos;s published here. Partners can draft and submit; the
        publish decision is ours.
      </Typography>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600 } }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <span>{t.label}</span>
                  <Chip label={counts[t.key]} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                </Stack>
              }
            />
          ))}
        </Tabs>
        <TextField
          size="small"
          placeholder="Search company, title, terms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ maxWidth: { md: 320 } }}
        />
      </Stack>

      {rows.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: "20px", p: 5, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>Nothing here</Typography>
          <Typography variant="body2">No deals match this view.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((d) => (
            <Paper key={d.id} variant="outlined" sx={{ borderRadius: "18px", p: 2.5 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                    <StatusChip status={d.status} />
                    {d.category && (
                      <Chip
                        label={d.category}
                        size="small"
                        sx={{ height: 20, fontSize: "0.66rem", bgcolor: "rgba(10,19,32,0.05)" }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>{d.title}</Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.79rem", mb: 1 }}>
                    {d.company_name} · updated {formatDateTime(d.updated_at)}
                  </Typography>
                  {d.description && (
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", mb: 1 }}>
                      {d.description}
                    </Typography>
                  )}
                  {d.deal_terms && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "12px",
                        bgcolor: "rgba(217,168,75,0.1)",
                        border: "1px solid rgba(217,168,75,0.3)",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "#7A5C10",
                          mb: 0.4,
                        }}
                      >
                        Member deal
                      </Typography>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{d.deal_terms}</Typography>
                    </Box>
                  )}
                  {(d.redemption_url || d.redemption_note) && (
                    <Typography variant="body2" sx={{ fontSize: "0.78rem", mt: 1, wordBreak: "break-all" }}>
                      {d.redemption_url}
                      {d.redemption_url && d.redemption_note ? " · " : ""}
                      {d.redemption_note}
                    </Typography>
                  )}
                </Box>

                <Stack spacing={1} sx={{ flexShrink: 0, minWidth: { md: 160 } }}>
                  {d.status !== "published" && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy === d.id}
                      onClick={() => void act(d.id, "publish")}
                    >
                      Publish to members
                    </Button>
                  )}
                  {d.status !== "draft" && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy === d.id}
                      onClick={() => void act(d.id, "send_back")}
                    >
                      Send back to draft
                    </Button>
                  )}
                  {d.status !== "archived" && (
                    <Button
                      size="small"
                      disabled={busy === d.id}
                      onClick={() => void act(d.id, "archive")}
                      sx={{ color: "text.secondary" }}
                    >
                      Archive
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
