"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

export type WaitlistRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  practice_name: string | null;
  practice_role: string | null;
  locations: string | null;
  challenge: string | null;
  source: string | null;
  status: "new" | "contacted" | "converted" | "declined";
  created_at: string;
};

export type Counts = { total: number; last_24h: number; last_7d: number };

const STATUS_COLOR: Record<WaitlistRow["status"], { bg: string; fg: string }> = {
  new: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  contacted: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  converted: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  declined: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
};

function csvEscape(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const v = String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function exportCSV(rows: WaitlistRow[]) {
  const headers = [
    "id",
    "email",
    "first_name",
    "last_name",
    "phone",
    "practice_name",
    "practice_role",
    "locations",
    "challenge",
    "source",
    "status",
    "created_at",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => csvEscape((r as unknown as Record<string, string | null>)[h])).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asn-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WaitlistTable({
  initialRows,
  initialCounts,
}: {
  initialRows: WaitlistRow[];
  initialCounts: Counts;
}) {
  const [rows, setRows] = useState<WaitlistRow[]>(initialRows);
  const [counts] = useState<Counts>(initialCounts);
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(lc) ||
        r.email.toLowerCase().includes(lc) ||
        (r.practice_name ?? "").toLowerCase().includes(lc) ||
        (r.practice_role ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const updateStatus = (id: string, status: WaitlistRow["status"]) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, status } : row)));
    fetch(`/api/admin/waitlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {
      setRows((r) =>
        r.map((row) =>
          row.id === id
            ? { ...row, status: initialRows.find((x) => x.id === id)?.status ?? "new" }
            : row,
        ),
      );
    });
  };

  const refresh = () => {
    startTransition(() => {
      fetch(`/api/admin/waitlist`, { method: "GET", cache: "no-store" })
        .then((r) => r.json())
        .then((d: { rows?: WaitlistRow[] }) => {
          if (d.rows) setRows(d.rows);
        });
    });
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
            WAITLIST
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Launch waitlist
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            {counts.total.toLocaleString("en-US")} signups
            {counts.last_24h > 0 ? ` · ${counts.last_24h} in the last 24h` : ""}
            {counts.last_7d > 0 ? ` · ${counts.last_7d} this week` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh} disabled={isPending}>
              <RefreshOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {[
          { label: "Total signups", value: counts.total, accent: false },
          { label: "Last 24 hours", value: counts.last_24h, accent: true },
          { label: "Last 7 days", value: counts.last_7d, accent: false },
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
        placeholder="Search name, email, practice, role…"
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
              {rows.length === 0 ? "No signups yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "Once the waitlist form goes live, entries will appear here in real time."
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
                  py: 2,
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
                  <Box component="th">Person</Box>
                  <Box component="th">Practice</Box>
                  <Box component="th">Role</Box>
                  <Box component="th">Locations</Box>
                  <Box component="th">Challenge</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Joined</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                          {row.first_name} {row.last_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                        >
                          {row.email}
                        </Typography>
                        {row.phone && (
                          <Typography
                            variant="body2"
                            sx={{ color: "text.disabled", fontSize: "0.74rem", mt: 0.25 }}
                          >
                            {row.phone}
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Typography
                          variant="body2"
                          sx={{ color: row.practice_name ? "text.primary" : "text.disabled" }}
                        >
                          {row.practice_name ?? ""}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography
                          variant="body2"
                          sx={{ color: row.practice_role ? "text.secondary" : "text.disabled" }}
                        >
                          {row.practice_role ?? ""}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {row.locations ?? ""}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ maxWidth: 260 }}>
                        <Typography
                          variant="body2"
                          sx={{ color: row.challenge ? "text.secondary" : "text.disabled", fontSize: "0.78rem" }}
                        >
                          {row.challenge ?? ""}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Select
                          value={row.status}
                          onChange={(e) => updateStatus(row.id, e.target.value as WaitlistRow["status"])}
                          variant="standard"
                          disableUnderline
                          sx={{
                            "& .MuiSelect-select": {
                              minHeight: 0,
                              py: 0.5,
                              px: 1.25,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              borderRadius: 999,
                              bgcolor: color.bg,
                              color: color.fg,
                            },
                            "& .MuiSelect-icon": { color: color.fg, right: 4 },
                          }}
                        >
                          <MenuItem value="new">New</MenuItem>
                          <MenuItem value="contacted">Contacted</MenuItem>
                          <MenuItem value="converted">Converted</MenuItem>
                          <MenuItem value="declined">Declined</MenuItem>
                        </Select>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Tooltip title={`Email ${row.email}`}>
                          <IconButton component="a" href={`mailto:${row.email}`} size="small">
                            <EmailOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
