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
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";

export type MemberRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  practice_name: string | null;
  practice_role: string | null;
  phone: string | null;
  status: "active" | "paused" | "churned";
  tier: string;
  waitlist_signup_id: string | null;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
};

const STATUS_COLOR: Record<MemberRow["status"], { bg: string; fg: string }> = {
  active: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  paused: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
  churned: { bg: "rgba(199,92,74,0.14)", fg: "#7A2E1F" },
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

export default function MembersTable({ initialRows }: { initialRows: MemberRow[] }) {
  const [rows, setRows] = useState<MemberRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(lc) ||
        r.email.toLowerCase().includes(lc) ||
        (r.practice_name ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      fromWaitlist: rows.filter((r) => r.waitlist_signup_id).length,
    }),
    [rows],
  );

  const refresh = async () => {
    const res = await fetch("/api/admin/members", { cache: "no-store" });
    const body = (await res.json()) as { rows?: MemberRow[] };
    if (body.rows) setRows(body.rows);
  };

  const toggleStatus = async (row: MemberRow) => {
    const action = row.status === "active" ? "deactivate" : "reactivate";
    setRows((r) =>
      r.map((x) =>
        x.id === row.id ? { ...x, status: action === "deactivate" ? "paused" : "active" } : x,
      ),
    );
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: row.status } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, firstName: newFirst, lastName: newLast }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not add member.");
      setNotice(`${newEmail} activated as a founding member.`);
      setNewEmail("");
      setNewFirst("");
      setNewLast("");
      setAdding(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "id",
      "email",
      "first_name",
      "last_name",
      "practice_name",
      "practice_role",
      "phone",
      "status",
      "tier",
      "activated_at",
      "activated_by",
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
    a.download = `asn-members-${new Date().toISOString().slice(0, 10)}.csv`;
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
            MEMBERS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Members
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Founding members activated from the waitlist (or added manually). Portal access and
            billing arrive with the Agree-and-Pay phase.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
            onClick={() => setAdding((v) => !v)}
          >
            Add member
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
          onSubmit={addMember}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Activate a member manually</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Email"
              type="email"
              size="small"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              sx={{ flex: 1.2 }}
            />
            <TextField
              label="First name"
              size="small"
              required
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Last name"
              size="small"
              required
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Adding…" : "Activate"}
            </Button>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total members", value: counts.total, accent: false },
          { label: "Active", value: counts.active, accent: true },
          { label: "From the waitlist", value: counts.fromWaitlist, accent: false },
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
              {rows.length === 0 ? "No members yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "Activate waitlist signups from the Launch waitlist page, or add one manually."
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
                  <Box component="th">Member</Box>
                  <Box component="th">Practice</Box>
                  <Box component="th">Tier</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Activated</Box>
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
                        {row.practice_role && (
                          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.76rem" }}>
                            {row.practice_role}
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.tier}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: "rgba(217,168,75,0.14)",
                            color: "#7A5B17",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.status}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: color.bg,
                            color: color.fg,
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.activated_at)}
                        </Typography>
                        {row.activated_by && (
                          <Typography variant="body2" sx={{ color: "text.disabled", fontSize: "0.72rem" }}>
                            by {row.activated_by}
                          </Typography>
                        )}
                      </Box>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title={`Email ${row.email}`}>
                          <IconButton component="a" href={`mailto:${row.email}`} size="small">
                            <EmailOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={row.status === "active" ? "Pause membership" : "Reactivate"}>
                          <IconButton size="small" onClick={() => toggleStatus(row)}>
                            {row.status === "active" ? (
                              <PauseCircleOutlinedIcon fontSize="small" />
                            ) : (
                              <PlayCircleOutlinedIcon fontSize="small" />
                            )}
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
