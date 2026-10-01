"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import OfferDetailDialog, { type AdminOffer } from "@/components/admin/OfferDetailDialog";

type FilterKey = "pending_review" | "approved" | "rejected" | "all";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "pending_review", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminOffersPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openOffer, setOpenOffer] = useState<AdminOffer | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offers?status=${filter}`, { cache: "no-store" });
      const body = (await res.json()) as { rows?: AdminOffer[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const lc = q.toLowerCase();
    return rows.filter(
      (o) =>
        o.headline.toLowerCase().includes(lc) ||
        o.discount_value.toLowerCase().includes(lc) ||
        (o.promo_code ?? "").toLowerCase().includes(lc) ||
        (o.vendors?.company_name ?? "").toLowerCase().includes(lc) ||
        (o.catalog_items?.name ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.review_status === "pending_review").length,
      approved: rows.filter((r) => r.review_status === "approved").length,
      rejected: rows.filter((r) => r.review_status === "rejected").length,
    }),
    [rows],
  );

  const runAction = async (id: string, action: "approve" | "reject", note?: string) => {
    setActing(true);
    try {
      const res = await fetch("/api/admin/offers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action, note: note ?? null }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Action failed (${res.status})`);
        return;
      }
      setToast(action === "approve" ? "Offer approved and company notified." : "Offer rejected and company notified.");
      setOpenOffer(null);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActing(false);
    }
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          OFFERS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Company offers: every discount
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
          Read-only browser of every offer any company has submitted. Click an offer to see the full submission (company, attached catalog item, terms, validity), then approve or reject pending submissions inline.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v as FilterKey)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { backgroundColor: "secondary.main", height: 3, borderRadius: 999 },
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Box>{t.label}</Box>
                  <Chip
                    size="small"
                    label={
                      t.key === "all"
                        ? counts.all
                        : t.key === "pending_review"
                          ? counts.pending
                          : t.key === "approved"
                            ? counts.approved
                            : counts.rejected
                    }
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      bgcolor: filter === t.key ? "rgba(217,168,75,0.18)" : "grey.100",
                      color: filter === t.key ? "#A07823" : "text.secondary",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Box>

      <TextField
        placeholder="Search by headline, discount, company, or catalog item"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon sx={{ color: "text.secondary", fontSize: 18 }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ maxWidth: 520 }}
      />

      {loading ? (
        <Stack sx={{ py: 6, alignItems: "center" }}>
          <CircularProgress size={24} sx={{ color: "#A07823" }} />
        </Stack>
      ) : filtered.length === 0 ? (
        <Box sx={{ p: 6, textAlign: "center", borderRadius: "18px", border: "1px dashed", borderColor: "divider", bgcolor: "common.white" }}>
          <Typography variant="h5" sx={{ fontSize: "1.15rem", mb: 1 }}>
            {q ? `No offers match "${q}".` : filter === "pending_review" ? "Queue is clear." : "Nothing here yet."}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {q
              ? "Try a different search term."
              : filter === "pending_review"
                ? "Companies will submit new offers here as they create discounts on their catalog items."
                : "Offers in this state will show up here as they happen."}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((o) => {
            const pending = o.review_status === "pending_review";
            return (
              <Box
                key={o.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenOffer(o)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenOffer(o);
                  }
                }}
                sx={{
                  p: { xs: 1.75, md: 2 },
                  borderRadius: "14px",
                  border: "1px solid",
                  borderColor: pending ? "rgba(217,168,75,0.4)" : "divider",
                  bgcolor: pending ? "rgba(217,168,75,0.04)" : "common.white",
                  cursor: "pointer",
                  transition: "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                  "&:hover": {
                    borderColor: "#A07823",
                    transform: "translateY(-1px)",
                    boxShadow: "0 12px 24px -16px rgba(14,42,61,0.18)",
                  },
                  "&:focus-visible": { outline: "2px solid #A07823", outlineOffset: 2 },
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      width: { xs: 56, md: 72 },
                      height: { xs: 56, md: 72 },
                      borderRadius: 1.25,
                      bgcolor: "rgba(217,168,75,0.12)",
                      color: "#A07823",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <LocalOfferOutlinedIcon sx={{ fontSize: 26 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5, mb: 0.25 }}>
                      <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7A8590" }}>
                        OFFER · {o.catalog_items?.category ?? "Uncategorised"}
                      </Typography>
                      <ReviewStatusChip status={o.review_status} />
                    </Stack>
                    <Typography sx={{ fontSize: "0.96rem", fontWeight: 600, lineHeight: 1.25 }} noWrap>
                      {o.headline}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary", mt: 0.25 }} noWrap>
                      {o.vendors?.company_name ?? "Company"} · on {o.catalog_items?.name ?? "catalog item"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: { xs: "none", sm: "block" }, flexShrink: 0, textAlign: "right" }}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#1F5C40" }} noWrap>
                      {o.discount_value}
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                      {o.valid_from} → {o.valid_to}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <OfferDetailDialog
        offer={openOffer}
        open={!!openOffer}
        onClose={() => setOpenOffer(null)}
        onAction={runAction}
        busy={acting}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

function ReviewStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending_review: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "PENDING" },
    approved: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "APPROVED" },
    rejected: { bg: "rgba(140,29,29,0.12)", color: "#8C1D1D", label: "REJECTED" },
    draft: { bg: "rgba(14,42,61,0.07)", color: "primary.dark", label: "DRAFT" },
    needs_changes: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "NEEDS CHANGES" },
  };
  const s = map[status] ?? map.pending_review;
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.1em", height: 18 }}
    />
  );
}
