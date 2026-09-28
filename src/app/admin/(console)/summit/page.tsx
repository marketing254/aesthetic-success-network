"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

/**
 * /admin/summit — everyone who submitted the summit ad-page form, whether
 * or not they finished the $0 trial checkout.
 *
 * Stages come from the database: "Started · not paid" is a form
 * submission that never completed Stripe; the paid stages track the
 * hand-off to the registrants Google Sheet. Zoom's own result
 * (Registered / join link) is written by n8n into that sheet, not here.
 */

type Stage = "not_paid" | "paid_sheet_pending" | "paid_sheet_failed" | "queued_for_zoom";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  practice: string | null;
  speaker_question: string | null;
  created_at: string;
  entitled_at: string | null;
  entitled_via: "trial_checkout" | "existing_member" | null;
  stage: Stage;
  stage_label: string;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  landing_url: string | null;
  sheet_synced_at: string | null;
  zoom_error: string | null;
  zoom_attempts: number;
  stripe_session_id: string | null;
};

type Counts = { total: number; not_paid: number; paid: number; failed: number; new_trials: number; existing_members: number };

type Filter = "all" | "not_paid" | "paid" | "failed";

const GOLD = "#A07823";

function fmt(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function stageTone(stage: Stage): "default" | "success" | "warning" | "error" | "info" {
  if (stage === "not_paid") return "warning";
  if (stage === "queued_for_zoom") return "success";
  if (stage === "paid_sheet_failed") return "error";
  return "info";
}

function viaLabel(via: Row["entitled_via"]): string {
  if (via === "trial_checkout") return "New $0 trial";
  if (via === "existing_member") return "Existing member";
  return "";
}

export default function SummitAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [eventInfo, setEventInfo] = useState<{ title: string; date: string; webinarId: string } | null>(null);
  // The API reports whether an event is configured (SUMMIT_ENABLED=true on
  // the server). Until then the page shows a "No event configured" state.
  const [eventEnabled, setEventEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/summit", { cache: "no-store" });
      const body = (await res.json()) as {
        rows?: Row[];
        counts?: Counts;
        event?: { title: string; date: string; webinarId: string } | null;
        enabled?: boolean;
        error?: string;
      };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
      setCounts(body.counts ?? null);
      setEventInfo(body.event ?? null);
      setEventEnabled(typeof body.enabled === "boolean" ? body.enabled : !!body.event);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "not_paid") list = list.filter((r) => r.stage === "not_paid");
    if (filter === "paid") list = list.filter((r) => r.stage !== "not_paid");
    if (filter === "failed") list = list.filter((r) => r.stage === "paid_sheet_failed");
    if (!q.trim()) return list;
    const lc = q.toLowerCase();
    return list.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(lc) ||
        r.email.toLowerCase().includes(lc) ||
        (r.practice ?? "").toLowerCase().includes(lc) ||
        r.source.toLowerCase().includes(lc) ||
        (r.utm_content ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q, filter]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what} copied`);
    } catch {
      setToast("Couldn't copy. Select it manually");
    }
  };

  const exportCsv = () => {
    const head = ["Submitted", "First name", "Last name", "Email", "Phone", "Practice", "Stage", "Entitled via", "Source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "Speaker question"];
    const esc = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [r.created_at, r.first_name, r.last_name, r.email, r.phone, r.practice, r.stage_label, viaLabel(r.entitled_via), r.source, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.speaker_question]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `summit-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filters: { key: Filter; label: string; count: number | undefined }[] = [
    { key: "all", label: "All", count: counts?.total },
    { key: "not_paid", label: "Started · not paid", count: counts?.not_paid },
    { key: "paid", label: "Paid / registered", count: counts?.paid },
    { key: "failed", label: "Needs attention", count: counts?.failed },
  ];

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          GROWTH · EVENT
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Summit registrations
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
          Everyone who submitted the form on the event ad page{eventInfo ? ` (${eventInfo.title}, ${eventInfo.date})` : ""}. A row is saved the moment
          the form is submitted, so people who stopped at the $0 trial checkout are listed here as &ldquo;Started · not paid&rdquo;. Paid rows are handed to the
          registrants Google Sheet; n8n registers those in Zoom and writes the join link into the sheet.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && eventEnabled === false && (
        <Alert severity="info">
          No event configured. Set SUMMIT_ENABLED=true and the SUMMIT_* event variables on the server to open registrations; nothing is linked publicly until then.
        </Alert>
      )}

      {counts && (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
          <Stat label="Form submissions" value={counts.total} />
          <Stat label="Stopped at payment" value={counts.not_paid} tone="warning" />
          <Stat label="New $0 trials" value={counts.new_trials} tone="success" />
          <Stat label="Existing members" value={counts.existing_members} />
          {counts.failed > 0 && <Stat label="Sheet failures" value={counts.failed} tone="error" />}
        </Stack>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {filters.map((f) => (
            <Chip
              key={f.key}
              label={f.count === undefined ? f.label : `${f.label} · ${f.count}`}
              onClick={() => setFilter(f.key)}
              color={filter === f.key ? "primary" : undefined}
              variant={filter === f.key ? "filled" : "outlined"}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            placeholder="Search name, email, practice, ad…"
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
            sx={{ minWidth: 260 }}
          />
          <Button size="small" onClick={() => void load()} startIcon={<RefreshOutlinedIcon />} sx={{ textTransform: "none" }}>
            Refresh
          </Button>
          <Button size="small" variant="outlined" onClick={exportCsv} disabled={filtered.length === 0} sx={{ textTransform: "none" }}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ borderRadius: "18px", border: "1px solid", borderColor: "divider", bgcolor: "common.white", overflow: "hidden" }}>
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1.7fr 1.3fr 1.1fr 0.8fr 1.4fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {["Person", "Practice", "Source", "Submitted", "Stage"].map((h) => (
            <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: GOLD }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary" }}>
              {q ? `Nothing matches "${q}".` : filter === "all" ? "No event form submissions yet." : "Nothing in this view."}
            </Typography>
          </Box>
        ) : (
          filtered.map((r, i) => (
            <Box
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(r);
                }
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.7fr 1.3fr 1.1fr 0.8fr 1.4fr" },
                alignItems: "center",
                gap: 2,
                px: { xs: 2.5, md: 3 },
                py: 2,
                borderBottom: i === filtered.length - 1 ? 0 : "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": { bgcolor: "grey.50" },
                "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: -2 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                  {r.first_name} {r.last_name}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                  {r.email}
                </Typography>
                <Box sx={{ display: { xs: "flex", md: "none" }, gap: 1, mt: 0.75, flexWrap: "wrap" }}>
                  <SourceChip source={r.source} />
                  <Chip size="small" label={r.stage_label} color={stageTone(r.stage)} variant="outlined" sx={{ fontWeight: 600, fontSize: "0.72rem" }} />
                </Box>
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 500 }} noWrap>
                  {r.practice ?? ""}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }} noWrap>
                  {r.phone ?? ""}
                </Typography>
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                <SourceChip source={r.source} />
                {r.utm_content && (
                  <Typography variant="body2" sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.5 }} noWrap>
                    Ad: {r.utm_content}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem", color: "text.secondary" }}>
                {fmt(r.created_at, true)}
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <Chip size="small" label={r.stage_label} color={stageTone(r.stage)} variant="outlined" sx={{ fontWeight: 600, fontSize: "0.74rem" }} />
                {r.entitled_via && (
                  <Typography variant="body2" sx={{ fontSize: "0.72rem", color: "text.secondary", mt: 0.5 }}>
                    {viaLabel(r.entitled_via)}
                  </Typography>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle sx={{ pb: 0.5 }}>
              {selected.first_name} {selected.last_name}
              <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 400 }}>{selected.practice ?? ""}</Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.25} sx={{ mt: 1 }}>
                <Section title="Stage">
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                    <Chip size="small" label={selected.stage_label} color={stageTone(selected.stage)} variant="outlined" sx={{ fontWeight: 600 }} />
                    {selected.entitled_via && <Chip size="small" label={viaLabel(selected.entitled_via)} variant="outlined" />}
                  </Stack>
                  <Row label="Form submitted" value={fmt(selected.created_at, true)} />
                  {selected.entitled_at && <Row label="Payment verified" value={fmt(selected.entitled_at, true)} />}
                  {selected.sheet_synced_at && <Row label="Sent to sheet" value={fmt(selected.sheet_synced_at, true)} />}
                  {selected.zoom_error && <Row label="Sheet error" value={`${selected.zoom_error} (attempt ${selected.zoom_attempts})`} />}
                  {selected.stage === "not_paid" && (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                      They reached the Stripe step but did not complete the $0 trial. No membership was created and nothing was sent to Zoom.
                    </Typography>
                  )}
                </Section>

                <Section title="Contact">
                  <Row label="Email" value={selected.email} onCopy={() => copy(selected.email, "Email")} />
                  <Row label="Phone" value={selected.phone ?? ""} onCopy={selected.phone ? () => copy(selected.phone!, "Phone") : undefined} />
                  <Row label="Practice" value={selected.practice ?? ""} />
                </Section>

                <Section title="Where they came from">
                  <Row label="Source" value={selected.source} />
                  {selected.utm_campaign && <Row label="Campaign" value={selected.utm_campaign} />}
                  {selected.utm_medium && <Row label="Medium" value={selected.utm_medium} />}
                  {selected.utm_content && <Row label="Ad" value={selected.utm_content} />}
                  {selected.landing_url && <Row label="Landing URL" value={selected.landing_url} onCopy={() => copy(selected.landing_url!, "URL")} />}
                </Section>

                {selected.speaker_question && (
                  <Section title="Question for the speakers">
                    <Typography sx={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{selected.speaker_question}</Typography>
                  </Section>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Stack>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" | "success" | "error" }) {
  const color = tone === "warning" ? "#9a5b00" : tone === "success" ? "#2C7A52" : tone === "error" ? "#b3261e" : "text.primary";
  return (
    <Box sx={{ px: 2.25, py: 1.5, borderRadius: "14px", border: "1px solid", borderColor: "divider", bgcolor: "common.white", minWidth: 150 }}>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.1, color }}>{value}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mt: 0.25 }}>{label}</Typography>
    </Box>
  );
}

function SourceChip({ source }: { source: string }) {
  const summit = source.startsWith("Summit ad");
  const meta = !summit && source.startsWith("Meta");
  return (
    <Chip
      size="small"
      label={source}
      sx={{
        fontWeight: 700,
        fontSize: "0.72rem",
        maxWidth: "100%",
        bgcolor: summit ? "rgba(217,168,75,0.16)" : meta ? "rgba(24,119,242,0.1)" : "grey.100",
        color: summit ? GOLD : meta ? "#1256b8" : "text.secondary",
        border: "1px solid",
        borderColor: summit ? "rgba(217,168,75,0.5)" : meta ? "rgba(24,119,242,0.3)" : "divider",
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", mb: 0.75 }}>
        {title}
      </Typography>
      <Stack spacing={0.5}>{children}</Stack>
    </Box>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", minWidth: 130 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 500, flex: 1, wordBreak: "break-word" }}>{value}</Typography>
      {onCopy && (
        <Button size="small" onClick={onCopy} startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: "none", fontSize: "0.75rem", minWidth: 0 }}>
          Copy
        </Button>
      )}
    </Stack>
  );
}
