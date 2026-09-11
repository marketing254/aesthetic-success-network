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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";

export type LeadMagnetRow = {
  id: string;
  magnet_slug: string;
  email: string;
  full_name: string | null;
  practice_name: string | null;
  source: string | null;
  utm: Record<string, unknown> | null;
  ip_hash: string | null;
  user_agent: string | null;
  contacted_at: string | null;
  created_at: string;
};

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

export default function LeadMagnetsTable({ initialRows }: { initialRows: LeadMagnetRow[] }) {
  const [rows, setRows] = useState<LeadMagnetRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(lc) ||
        (r.full_name ?? "").toLowerCase().includes(lc) ||
        (r.practice_name ?? "").toLowerCase().includes(lc) ||
        r.magnet_slug.toLowerCase().includes(lc) ||
        (r.source ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      contacted: rows.filter((r) => r.contacted_at).length,
      new: rows.filter((r) => !r.contacted_at).length,
    }),
    [rows],
  );

  const toggleContacted = async (row: LeadMagnetRow) => {
    const action = row.contacted_at ? "unmark_contacted" : "mark_contacted";
    const prior = row.contacted_at;
    setRows((r) =>
      r.map((x) =>
        x.id === row.id ? { ...x, contacted_at: action === "mark_contacted" ? new Date().toISOString() : null } : x,
      ),
    );
    setErr(null);
    const res = await fetch("/api/admin/lead-magnets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, contacted_at: prior } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const exportCSV = () => {
    const headers = [
      "id",
      "magnet_slug",
      "email",
      "full_name",
      "practice_name",
      "source",
      "contacted_at",
      "created_at",
    ];
    const lines = [
      headers.join(","),
      ...filtered.map((r) =>
        headers.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asn-lead-magnet-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            LEAD MAGNETS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Lead magnet leads
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Emails captured by a gated download. ASN doesn&apos;t have a gated lead-magnet
            download live on the public site yet — this page is ready for when one ships.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
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

      <Grid container spacing={2}>
        {[
          { label: "Total leads", value: counts.total, accent: false },
          { label: "Contacted", value: counts.contacted, accent: false },
          { label: "New", value: counts.new, accent: true },
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
        placeholder="Search email, name, practice, magnet…"
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
              {rows.length === 0 ? "No downloads yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "No downloads yet — ASN doesn't have a gated lead-magnet download live on the public site yet; this page is ready for when one ships."
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
                  <Box component="th">Lead</Box>
                  <Box component="th">Practice</Box>
                  <Box component="th">Magnet</Box>
                  <Box component="th">Source</Box>
                  <Box component="th">Contacted</Box>
                  <Box component="th">Submitted</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => (
                  <Box component="tr" key={row.id}>
                    <Box component="td">
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                        {row.full_name || row.email}
                      </Typography>
                      {row.full_name && (
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                        >
                          {row.email}
                        </Typography>
                      )}
                    </Box>
                    <Box component="td">
                      <Typography
                        variant="body2"
                        sx={{ color: row.practice_name ? "text.primary" : "text.disabled" }}
                      >
                        {row.practice_name ?? "—"}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Chip
                        label={row.magnet_slug}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          height: 22,
                          bgcolor: "rgba(84,113,138,0.1)",
                          color: "#33475C",
                        }}
                      />
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: row.source ? "text.primary" : "text.disabled" }}>
                        {row.source ?? "—"}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Chip
                        label={row.contacted_at ? "Contacted" : "New"}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          height: 22,
                          bgcolor: row.contacted_at ? "rgba(46,138,87,0.12)" : "rgba(217,168,75,0.14)",
                          color: row.contacted_at ? "#1F5C39" : "#7A5B17",
                        }}
                      />
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {formatDate(row.created_at)}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title={row.contacted_at ? "Mark as not contacted" : "Mark as contacted"}>
                        <IconButton size="small" onClick={() => toggleContacted(row)}>
                          {row.contacted_at ? (
                            <MarkEmailReadOutlinedIcon fontSize="small" />
                          ) : (
                            <MarkEmailUnreadOutlinedIcon fontSize="small" />
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
