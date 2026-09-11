"use client";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";

export type PromoCodeRow = {
  id: string;
  code: string;
  label: string;
  discount_description: string | null;
  expert_application_id: string | null;
  partner_application_id: string | null;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerOption = { id: string; name: string };

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return "";
  const v = String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PromoCodesTable({
  initialRows,
  experts,
  partners,
}: {
  initialRows: PromoCodeRow[];
  experts: OwnerOption[];
  partners: OwnerOption[];
}) {
  const [rows, setRows] = useState<PromoCodeRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newOwnerType, setNewOwnerType] = useState<"team" | "expert" | "partner">("team");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newMaxRedemptions, setNewMaxRedemptions] = useState("");

  const ownerLabel = (row: PromoCodeRow): string => {
    if (row.expert_application_id) {
      return experts.find((e) => e.id === row.expert_application_id)?.name ?? "Expert";
    }
    if (row.partner_application_id) {
      return partners.find((p) => p.id === row.partner_application_id)?.name ?? "Partner";
    }
    return "Team";
  };

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(lc) ||
        r.label.toLowerCase().includes(lc) ||
        (r.discount_description ?? "").toLowerCase().includes(lc) ||
        ownerLabel(r).toLowerCase().includes(lc),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, experts, partners]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      redemptions: rows.reduce((sum, r) => sum + (r.redemption_count || 0), 0),
    }),
    [rows],
  );

  const refresh = async () => {
    const res = await fetch("/api/admin/promo-codes", { cache: "no-store" });
    const body = (await res.json()) as { rows?: PromoCodeRow[] };
    if (body.rows) setRows(body.rows);
  };

  const toggleActive = async (row: PromoCodeRow) => {
    const action = row.active ? "deactivate" : "activate";
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: !row.active } : x)));
    const res = await fetch("/api/admin/promo-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: row.active } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Copied ${code}.`);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  const addCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel,
          code: newCode || undefined,
          discountDescription: newDiscount || undefined,
          ownerType: newOwnerType,
          ownerId: newOwnerType === "team" ? undefined : newOwnerId || undefined,
          expiresAt: newExpiresAt || undefined,
          maxRedemptions: newMaxRedemptions ? Number(newMaxRedemptions) : undefined,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not create promo code.");
      setNotice("Promo code created.");
      setNewLabel("");
      setNewCode("");
      setNewDiscount("");
      setNewOwnerType("team");
      setNewOwnerId("");
      setNewExpiresAt("");
      setNewMaxRedemptions("");
      setAdding(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create promo code.");
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "code",
      "label",
      "discount_description",
      "owner",
      "active",
      "redemption_count",
      "max_redemptions",
      "expires_at",
      "created_at",
    ];
    const lines = [
      headers.join(","),
      ...filtered.map((r) =>
        headers
          .map((h) =>
            csvEscape(h === "owner" ? ownerLabel(r) : (r as unknown as Record<string, unknown>)[h]),
          )
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asn-promo-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const ownerOptions = newOwnerType === "expert" ? experts : newOwnerType === "partner" ? partners : [];

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            PROMO CODES
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Promo codes
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Mint discount codes for experts, partners, or the team. This is record-keeping only —
            nothing in checkout reads these codes yet.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setAdding((v) => !v)}
          >
            Add code
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {adding && (
        <Box
          component="form"
          onSubmit={addCode}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Mint a promo code</Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="Label"
                size="small"
                required
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                helperText="What this promotes, e.g. “Dr. Chen — 1 month free”"
                sx={{ flex: 1.4 }}
              />
              <TextField
                label="Code"
                size="small"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                helperText="Optional — auto-generated from the label if left blank"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Discount"
                size="small"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                helperText="e.g. “20% off first 3 months”"
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                select
                label="Owner"
                size="small"
                value={newOwnerType}
                onChange={(e) => {
                  setNewOwnerType(e.target.value as "team" | "expert" | "partner");
                  setNewOwnerId("");
                }}
                sx={{ flex: 1 }}
              >
                <MenuItem value="team">Team (house code)</MenuItem>
                <MenuItem value="expert">Expert</MenuItem>
                <MenuItem value="partner">Partner</MenuItem>
              </TextField>
              {newOwnerType !== "team" && (
                <TextField
                  select
                  label={newOwnerType === "expert" ? "Expert" : "Partner"}
                  size="small"
                  required
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  sx={{ flex: 1.4 }}
                >
                  {ownerOptions.length === 0 && (
                    <MenuItem value="" disabled>
                      No approved {newOwnerType}s yet
                    </MenuItem>
                  )}
                  {ownerOptions.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Expires"
                type="date"
                size="small"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Max redemptions"
                type="number"
                size="small"
                value={newMaxRedemptions}
                onChange={(e) => setNewMaxRedemptions(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="contained" disabled={busy} sx={{ flexShrink: 0 }}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total codes", value: counts.total, accent: false },
          { label: "Active", value: counts.active, accent: true },
          { label: "Total redemptions", value: counts.redemptions, accent: false },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 4 }}>
            <Box
              sx={{
                p: 2.25,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: card.accent ? "rgba(217,168,75,0.4)" : "divider",
                bgcolor: card.accent ? "rgba(217,168,75,0.05)" : "common.white",
              }}
            >
              <Typography variant="overline" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                {card.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.8rem", md: "2.1rem" },
                  lineHeight: 1,
                  color: "text.primary",
                  mt: 0.5,
                }}
              >
                {card.value.toLocaleString("en-US")}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TextField
        placeholder="Search code, label, owner…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ maxWidth: 420 }}
      />

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="h5" sx={{ mb: 1, color: "text.primary" }}>
              {rows.length === 0 ? "No promo codes yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "Mint a code for an expert, partner, or the team above."
                : "Try clearing the search."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& th": {
                  textAlign: "left",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "text.secondary",
                  fontWeight: 700,
                  px: 2.5,
                  py: 1.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: "rgba(247,245,240,0.6)",
                },
                "& td": {
                  px: 2.5,
                  py: 1.9,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  fontSize: "0.88rem",
                  verticalAlign: "top",
                },
                "& tr:last-child td": { borderBottom: "none" },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Code</Box>
                  <Box component="th">Owner</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Redemptions</Box>
                  <Box component="th">Expires</Box>
                  <Box component="th">Created</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => (
                  <Box component="tr" key={row.id}>
                    <Box component="td">
                      <Typography sx={{ fontWeight: 600, color: "text.primary", fontFamily: "monospace" }}>
                        {row.code}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                      >
                        {row.label}
                      </Typography>
                      {row.discount_description && (
                        <Typography
                          variant="body2"
                          sx={{ color: "text.disabled", fontSize: "0.74rem", mt: 0.25 }}
                        >
                          {row.discount_description}
                        </Typography>
                      )}
                    </Box>
                    <Box component="td">
                      <Chip
                        label={ownerLabel(row)}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          height: 22,
                          bgcolor: "rgba(217,168,75,0.14)",
                          color: "#7A5B17",
                        }}
                      />
                    </Box>
                    <Box component="td">
                      <Chip
                        label={row.active ? "active" : "inactive"}
                        size="small"
                        sx={{
                          textTransform: "capitalize",
                          fontSize: "0.7rem",
                          height: 22,
                          bgcolor: row.active ? "rgba(46,138,87,0.12)" : "rgba(120,120,120,0.14)",
                          color: row.active ? "#1F5C39" : "#4A4A4A",
                        }}
                      />
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                        {row.redemption_count}
                        {row.max_redemptions !== null ? ` / ${row.max_redemptions}` : ""}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {formatDate(row.expires_at)}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {formatDate(row.created_at)}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Copy code">
                        <IconButton size="small" onClick={() => copyCode(row.code)}>
                          <ContentCopyOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={row.active ? "Deactivate" : "Activate"}>
                        <IconButton size="small" onClick={() => toggleActive(row)}>
                          {row.active ? (
                            <PauseCircleOutlinedIcon fontSize="small" />
                          ) : (
                            <PlayCircleOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
