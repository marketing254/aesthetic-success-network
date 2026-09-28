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
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";

/**
 * /admin/pending-members — people who STARTED signup (reached the payment
 * step, so a members row exists) but never paid. They are not members and
 * never appear on the Members tab. Each row shows where they came from
 * (Meta ad / referral / direct) and where the automatic follow-up
 * sequence is for them.
 */

type FollowUp = {
  plan: string | null;
  captured_at: string;
  email1_sent_at: string | null;
  email2_sent_at: string | null;
  email3_sent_at: string | null;
  code: string | null;
  code_expires_at: string | null;
  code_used_at: string | null;
  resumed_at: string | null;
  stopped_at: string | null;
  stop_reason: string | null;
};

type PendingRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  practice_name: string | null;
  practice_role: string | null;
  tier: string | null;
  created_at: string;
  signup_channel: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referred_by?: string | null;
  source: string;
  follow_up: FollowUp | null;
};

const GOLD = "#A07823";

function fmt(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** One-line summary of where the follow-up sequence is for this person. */
function followUpSummary(f: FollowUp | null): { label: string; tone: "default" | "success" | "warning" | "info" } {
  if (!f) return { label: "Not in follow-up (before launch)", tone: "default" };
  if (f.stop_reason === "purchased") return { label: "Purchased", tone: "success" };
  if (f.stop_reason === "unsubscribed") return { label: "Unsubscribed", tone: "warning" };
  if (f.email3_sent_at) {
    if (f.code_used_at) return { label: "Code redeemed", tone: "success" };
    const live = f.code_expires_at && new Date(f.code_expires_at).getTime() > Date.now();
    return { label: live ? "Email 3 sent · code live" : "Email 3 sent · code expired", tone: live ? "info" : "default" };
  }
  if (f.email2_sent_at) return { label: "Email 2 sent · email 3 at day 7", tone: "info" };
  if (f.email1_sent_at) return { label: "Email 1 sent · email 2 at 24h", tone: "info" };
  return { label: "Captured · email 1 at 1h", tone: "info" };
}

export default function PendingMembersPage() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PendingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members?view=pending", { cache: "no-store" });
      const body = (await res.json()) as { rows?: PendingRow[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
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
    if (!q.trim()) return rows;
    const lc = q.toLowerCase();
    return rows.filter(
      (m) =>
        `${m.first_name} ${m.last_name ?? ""}`.toLowerCase().includes(lc) ||
        m.email.toLowerCase().includes(lc) ||
        (m.practice_name ?? "").toLowerCase().includes(lc) ||
        m.source.toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what} copied`);
    } catch {
      setToast("Couldn't copy. Select it manually");
    }
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          MEMBERS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Pending members
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
          People who started signing up but haven&apos;t paid, whether they stopped at the join form or at the payment step. They are not members and don&apos;t
          count anywhere else. The follow-up sequence (1h · 24h · day 7 with a one-month code) runs on its
          own; this page shows where each person is in it and where they came from.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <TextField
          placeholder="Search pending signups…"
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
          sx={{ maxWidth: 420, flex: 1 }}
        />
        <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
          {rows.length} pending
        </Typography>
      </Stack>

      <Box sx={{ borderRadius: "18px", border: "1px solid", borderColor: "divider", bgcolor: "common.white", overflow: "hidden" }}>
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1.7fr 1.3fr 0.9fr 0.8fr 1.5fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {["Person", "Practice", "Source", "Started", "Follow-up"].map((h) => (
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
              {q ? `No pending signups match "${q}".` : "No pending signups right now. Everyone who started has paid."}
            </Typography>
          </Box>
        ) : (
          filtered.map((m, i) => {
            const fu = followUpSummary(m.follow_up);
            return (
              <Box
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(m);
                  }
                }}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1.7fr 1.3fr 0.9fr 0.8fr 1.5fr" },
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
                    {m.first_name} {m.last_name ?? ""}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                    {m.email}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 500 }} noWrap>
                    {m.practice_name ?? ""}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }} noWrap>
                    {m.practice_role ?? ""}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <SourceChip source={m.source} />
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem", color: "text.secondary" }}>
                  {fmt(m.created_at)}
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <Chip size="small" label={fu.label} color={fu.tone === "default" ? undefined : fu.tone} variant="outlined" sx={{ fontWeight: 600, fontSize: "0.74rem" }} />
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Detail */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle sx={{ pb: 0.5 }}>
              {selected.first_name} {selected.last_name ?? ""}
              <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 400 }}>
                {selected.practice_name ?? ""} {selected.practice_role ? `· ${selected.practice_role}` : ""}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.25} sx={{ mt: 1 }}>
                <Section title="Contact">
                  <Row label="Email" value={selected.email} onCopy={() => copy(selected.email, "Email")} />
                  <Row label="Phone" value={selected.phone ?? ""} />
                </Section>

                <Section title="Where they came from">
                  <Row label="Source" value={selected.source} />
                  {selected.utm_campaign && <Row label="Campaign" value={selected.utm_campaign} />}
                  {selected.utm_content && <Row label="Ad" value={selected.utm_content} />}
                  {selected.referred_by && <Row label="Referred by" value={selected.referred_by} />}
                  <Row label="Plan picked" value={selected.follow_up?.plan?.replace("founding_", "Founding · ").replace("standard_", "Standard · ") ?? selected.tier ?? ""} />
                  <Row label="Started" value={fmt(selected.created_at, true)} />
                </Section>

                <Section title="Follow-up sequence">
                  {selected.follow_up ? (
                    <Stack spacing={0.75}>
                      <Step done={!!selected.follow_up.email1_sent_at} label="Email 1: resume link (+1h)" when={selected.follow_up.email1_sent_at} />
                      <Step done={!!selected.follow_up.email2_sent_at} label="Email 2: what's inside (+24h)" when={selected.follow_up.email2_sent_at} />
                      <Step done={!!selected.follow_up.email3_sent_at} label="Email 3: one month free (+7d)" when={selected.follow_up.email3_sent_at} />
                      {selected.follow_up.code && (
                        <Row
                          label="Their code"
                          value={`${selected.follow_up.code} · ${selected.follow_up.code_used_at ? "redeemed" : `valid until ${fmt(selected.follow_up.code_expires_at, true)}`}`}
                          onCopy={() => copy(selected.follow_up!.code!, "Code")}
                        />
                      )}
                      {selected.follow_up.resumed_at && <Row label="Opened a resume link" value={fmt(selected.follow_up.resumed_at, true)} />}
                      {selected.follow_up.stop_reason && <Row label="Stopped" value={`${selected.follow_up.stop_reason} · ${fmt(selected.follow_up.stopped_at, true)}`} />}
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                      Not in the automatic sequence. They dropped off before it launched, or are handled manually.
                    </Typography>
                  )}
                </Section>
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

function SourceChip({ source }: { source: string }) {
  const meta = source === "Meta ad" || source === "Summit ad";
  const ref = source === "Referral";
  return (
    <Chip
      size="small"
      label={source}
      sx={{
        fontWeight: 700,
        fontSize: "0.72rem",
        bgcolor: meta ? "rgba(24,119,242,0.1)" : ref ? "rgba(217,168,75,0.16)" : "grey.100",
        color: meta ? "#1256b8" : ref ? GOLD : "text.secondary",
        border: "1px solid",
        borderColor: meta ? "rgba(24,119,242,0.3)" : ref ? "rgba(217,168,75,0.5)" : "divider",
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

function Step({ done, label, when }: { done: boolean; label: string; when: string | null }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {done ? (
        <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: "#2C7A52" }} />
      ) : (
        <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
      )}
      <Typography sx={{ fontSize: "0.86rem", color: done ? "text.primary" : "text.secondary", flex: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>{done ? fmt(when, true) : "pending"}</Typography>
    </Stack>
  );
}
