"use client";
import { useMemo, useState, useTransition } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";

export type WaitlistRow = {
  id: string;
  role: "member" | "vendor"; // "vendor" kept for legacy rows but no longer accepted at submit time
  email: string;
  full_name: string;
  practice_name: string | null;
  phone: string | null;
  city_state: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "converted" | "declined";
  created_at: string;
};

export type Counts = { total: number; members: number; vendors: number; last_24h: number };

const STATUS_COLOR: Record<WaitlistRow["status"], { bg: string; fg: string }> = {
  new: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  contacted: { bg: "rgba(34,108,165,0.12)", fg: "#0E4471" },
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
    "role",
    "email",
    "full_name",
    "practice_name",
    "phone",
    "city_state",
    "message",
    "source",
    "status",
    "created_at",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => csvEscape((r as unknown as Record<string, string | null>)[h]))
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
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
  const [tab, setTab] = useState<"all" | "member">("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.role !== tab) return false;
      if (!lc) return true;
      return (
        r.full_name.toLowerCase().includes(lc) ||
        r.email.toLowerCase().includes(lc) ||
        (r.practice_name ?? "").toLowerCase().includes(lc) ||
        (r.city_state ?? "").toLowerCase().includes(lc)
      );
    });
  }, [rows, q, tab]);

  const updateStatus = (id: string, status: WaitlistRow["status"]) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, status } : row)));
    fetch(`/api/admin/waitlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {
      // Optimistic update, rollback on failure.
      setRows((r) =>
        r.map((row) => (row.id === id ? { ...row, status: initialRows.find((x) => x.id === id)?.status ?? "new" } : row)),
      );
    });
  };

  const [activating, setActivating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Launch phase: members stay on the waitlist until the team activates
  // them here. Activation creates the members row and sends the welcome
  // email (same route the Members page uses).
  const activate = async (row: WaitlistRow) => {
    if (!window.confirm(`Activate ${row.full_name ?? row.email} as a member and send the welcome email?`)) return;
    setActivating(row.id);
    try {
      const res = await fetch("/api/admin/members/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlist_signup_id: row.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setNotice(body.error ?? `Activate failed (${res.status})`);
        return;
      }
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: "converted" } : x)));
      setNotice(`${row.full_name ?? row.email} activated. Welcome email sent.`);
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setActivating(null);
    }
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            WAITLIST
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Launch waitlist
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            {counts.total.toLocaleString("en-US")} signups · {counts.members} members · {counts.vendors} companies
            {counts.last_24h > 0 ? ` · ${counts.last_24h} in the last 24h` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {notice && (
            <Typography variant="body2" sx={{ color: "text.secondary", mr: 1 }}>
              {notice}
            </Typography>
          )}
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

      {/* Counter cards */}
      <Grid container spacing={2}>
        {[
          { label: "Total signups", value: counts.total, icon: null, accent: false },
          { label: "Practice owners", value: counts.members, icon: <PersonOutlineOutlinedIcon fontSize="small" />, accent: false },
          { label: "Companies", value: counts.vendors, icon: <StoreOutlinedIcon fontSize="small" />, accent: false },
          { label: "Last 24 hours", value: counts.last_24h, icon: null, accent: true },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 3 }}>
            <Box
              sx={{
                p: 2.25,
                borderRadius: "18px",
                border: "1px solid",
                borderColor: card.accent ? "rgba(217,168,75,0.4)" : "divider",
                bgcolor: card.accent ? "rgba(217,168,75,0.05)" : "common.white",
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "text.secondary", mb: 0.75 }}>
                {card.icon}
                <Typography variant="overline" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  {card.label}
                </Typography>
              </Stack>
              <Typography sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.8rem", md: "2.1rem" }, lineHeight: 1, color: "text.primary" }}>
                {card.value.toLocaleString("en-US")}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36,
            "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 600, fontSize: "0.85rem", py: 0.5 },
          }}
        >
          <Tab value="all" label={`All (${rows.length})`} />
          <Tab value="member" label={`Practice owners (${rows.filter((r) => r.role === "member").length})`} />
        </Tabs>
        <TextField
          placeholder="Search name, email, practice…"
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
          sx={{ maxWidth: 420, flex: 1 }}
        />
      </Stack>

      {/* Table */}
      <Box
        sx={{
          borderRadius: "18px",
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
                : "Try clearing the search or switching to All."}
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
                  <Box component="th">Role</Box>
                  <Box component="th">Practice / Company</Box>
                  <Box component="th">Location</Box>
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
                          {row.full_name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}>
                          {row.email}
                        </Typography>
                        {row.phone && (
                          <Typography variant="body2" sx={{ color: "text.disabled", fontSize: "0.74rem", mt: 0.25 }}>
                            {row.phone}
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Chip
                          icon={
                            row.role === "vendor" ? (
                              <StoreOutlinedIcon sx={{ fontSize: 13 }} />
                            ) : (
                              <PersonOutlineOutlinedIcon sx={{ fontSize: 13 }} />
                            )
                          }
                          label={row.role === "vendor" ? "Partner" : "Practice owner"}
                          size="small"
                          sx={{
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: row.role === "vendor" ? "rgba(34,108,165,0.08)" : "rgba(14,42,61,0.05)",
                            color: row.role === "vendor" ? "#0E4471" : "#0E2A3D",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: row.practice_name ? "text.primary" : "text.disabled" }}>
                          {row.practice_name ?? ""}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: row.city_state ? "text.secondary" : "text.disabled" }}>
                          {row.city_state ?? ""}
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
                        {row.status !== "converted" && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={activating === row.id}
                            onClick={() => void activate(row)}
                            sx={{ mr: 1, whiteSpace: "nowrap" }}
                          >
                            {activating === row.id ? "Activating..." : "Activate member"}
                          </Button>
                        )}
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
