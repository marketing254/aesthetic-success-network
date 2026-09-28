"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";

type Row = {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  trial_days: number;
  max_uses: number;
  created_at: string;
  owner: { kind: "expert" | "partner" | "both" | "team"; name: string };
  uses: number;
};

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E0DACE";
const GOLD = "#A07823";

const OWNER_CHIP: Record<Row["owner"]["kind"], { bg: string; fg: string; label: string }> = {
  expert: { bg: "rgba(34,108,78,0.12)", fg: "#1F5C40", label: "Expert" },
  partner: { bg: "rgba(110,51,70,0.12)", fg: "#6E3346", label: "Company" },
  both: { bg: "rgba(31,58,92,0.12)", fg: "#1B3A5C", label: "Expert + Company" },
  team: { bg: "rgba(160,120,35,0.14)", fg: "#7A5B12", label: "Team" },
};

export default function AdminPromoCodesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Add-team-code form
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/promo-codes", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { codes?: Row[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't load promo codes.");
        setRows([]);
        return;
      }
      setRows(body.codes ?? []);
    } catch {
      setError("Couldn't load promo codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: Row) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action: row.active ? "deactivate" : "activate" }),
      });
      if (res.ok) {
        setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)));
      }
    } finally {
      setBusyId(null);
    }
  };

  const addTeamCode = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, code: newCode || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAddError(body.error ?? "Couldn't create the code.");
        return;
      }
      setNewLabel("");
      setNewCode("");
      await load();
    } finally {
      setAdding(false);
    }
  };

  const copy = (code: string) => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    });
  };

  const activeCount = rows.filter((r) => r.active).length;
  const totalUses = rows.reduce((s, r) => s + r.uses, 0);

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", mb: 1 }}>
          Promotional codes
        </Typography>
        <Typography
          component="h1"
          sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em", mb: 1 }}
        >
          3 months free, on your say-so
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.55, maxWidth: 680 }}>
          Every expert and company has a code (created automatically). While a code is <strong>active</strong>, a
          joining member who enters it at the payment step adds their card but pays nothing for 3 months.
          Deactivate a code and it stops working at checkout immediately. Codes here do NOT touch existing
          members, only new signups.
        </Typography>
      </Box>

      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
        <Tile label="Codes" value={String(rows.length)} />
        <Tile label="Active now" value={String(activeCount)} accent />
        <Tile label="Members joined via codes" value={String(totalUses)} />
      </Box>

      {/* Add a team code */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#FFFFFF", p: 2.5 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1.5 }}>
          Add a team code
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            size="small"
            label="Label (who/what it promotes)"
            placeholder="e.g. ASN team promo"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            sx={{ flex: 2 }}
          />
          <TextField
            size="small"
            label="Code (optional, auto from label)"
            placeholder="ASNTEAM"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            disableElevation
            disabled={adding || newLabel.trim().length < 2}
            onClick={() => void addTeamCode()}
            sx={{ bgcolor: INK, textTransform: "none", fontWeight: 700, borderRadius: 999, px: 3, "&:hover": { bgcolor: "#13253c" } }}
          >
            {adding ? "Adding…" : "Add code"}
          </Button>
        </Stack>
        {addError && (
          <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#8C1D1D" }}>{addError}</Typography>
        )}
      </Box>

      <Box sx={{ borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#FFFFFF", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>All codes</Typography>
        </Box>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}>
            <CircularProgress size={20} sx={{ color: GOLD }} />
          </Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.92rem", color: INK_MUTED }}>No codes yet.</Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
            {rows.map((r) => {
              const chip = OWNER_CHIP[r.owner.kind];
              return (
                <Stack
                  key={r.id}
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  sx={{ px: 2.5, py: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.3, flexWrap: "wrap" }}>
                      <Typography sx={{ fontFamily: "var(--font-mono, ui-monospace, Menlo, monospace)", fontSize: "1rem", fontWeight: 800, color: r.active ? GOLD : INK_MUTED, letterSpacing: "0.06em" }}>
                        {r.code}
                      </Typography>
                      <Tooltip title={copied === r.code ? "Copied!" : "Copy code"}>
                        <IconButton size="small" onClick={() => copy(r.code)} sx={{ color: INK_MUTED }}>
                          <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Chip
                        label={chip.label}
                        size="small"
                        sx={{ bgcolor: chip.bg, color: chip.fg, height: 18, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}
                      />
                      <Chip
                        label={r.active ? "ACTIVE" : "OFF"}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          bgcolor: r.active ? "rgba(34,108,78,0.14)" : "rgba(122,133,144,0.14)",
                          color: r.active ? "#1F5C40" : INK_MUTED,
                        }}
                      />
                    </Stack>
                    <Typography sx={{ fontSize: "0.82rem", color: INK_SOFT }}>
                      {r.owner.kind === "team" ? (r.label ?? "Team code") : `${r.owner.name}${r.label && r.label !== r.owner.name ? ` · ${r.label}` : ""}`}
                      {" · "}
                      {Math.round(r.trial_days / 30)} months free
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
                    <Box sx={{ textAlign: "center", minWidth: 64 }}>
                      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: INK_MUTED, textTransform: "uppercase" }}>Seats used</Typography>
                      <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: r.uses >= r.max_uses ? "#8C1D1D" : r.uses > 0 ? GOLD : INK, lineHeight: 1.1, mt: 0.25 }}>
                        {r.uses}/{r.max_uses ?? 10}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant={r.active ? "outlined" : "contained"}
                      disableElevation
                      disabled={busyId === r.id}
                      onClick={() => void toggle(r)}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 999,
                        px: 2,
                        minWidth: 104,
                        ...(r.active
                          ? { color: "#8C1D1D", borderColor: "rgba(140,29,29,0.4)", "&:hover": { borderColor: "#8C1D1D", bgcolor: "rgba(140,29,29,0.05)" } }
                          : { bgcolor: "#1F5C40", "&:hover": { bgcolor: "#174a33" } }),
                      }}
                    >
                      {busyId === r.id ? "…" : r.active ? "Deactivate" : "Activate"}
                    </Button>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ borderRadius: 2, border: `1px solid ${accent ? GOLD : LINE}`, bgcolor: accent ? "#FBF8F1" : "#FFFFFF", p: 2 }}>
      <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.16em", color: INK_MUTED, textTransform: "uppercase", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", fontWeight: 600, color: accent ? GOLD : INK, lineHeight: 1 }}>{value}</Typography>
    </Box>
  );
}
