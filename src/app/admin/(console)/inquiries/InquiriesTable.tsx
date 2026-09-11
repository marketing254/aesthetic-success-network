"use client";
import { Fragment, useMemo, useState } from "react";
import {
  Alert,
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
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";

export type InquiryStatus = "open" | "answered" | "closed";

export type InquiryRow = {
  id: string;
  expert_kit_id: string | null;
  member_id: string | null;
  name: string | null;
  email: string | null;
  question: string;
  status: InquiryStatus;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  kit_title: string | null;
};

const STATUS_COLOR: Record<InquiryStatus, { bg: string; fg: string }> = {
  open: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  answered: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  closed: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  open: "Open",
  answered: "Answered",
  closed: "Closed",
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

export default function InquiriesTable({ initialRows }: { initialRows: InquiryRow[] }) {
  const [rows, setRows] = useState<InquiryRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.question.toLowerCase().includes(lc) ||
        (r.name ?? "").toLowerCase().includes(lc) ||
        (r.email ?? "").toLowerCase().includes(lc) ||
        (r.kit_title ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      answered: rows.filter((r) => r.status === "answered").length,
      closed: rows.filter((r) => r.status === "closed").length,
    }),
    [rows],
  );

  const updateStatus = async (row: InquiryRow, status: InquiryStatus) => {
    const prev = row.status;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status } : x)));
    setErr(null);
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, status }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const saveNote = async (row: InquiryRow) => {
    setSavingId(row.id);
    setErr(null);
    try {
      const note = noteDraft[row.id] ?? row.admin_note ?? "";
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: row.status, adminNote: note }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not save the note.");
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, admin_note: note || null } : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the note.");
    } finally {
      setSavingId(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      "id",
      "kit_title",
      "name",
      "email",
      "question",
      "status",
      "admin_note",
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
    a.download = `asn-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
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
            INQUIRIES
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Resource inquiries
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Questions members ask about a specific resource kit. There&apos;s no public &quot;ask a
            question&quot; form live in ASN yet — the member portal that would post here is Phase 3
            scope — so this page reads empty for now and is ready for when it ships.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={exportCSV}
          disabled={filtered.length === 0}
        >
          Export CSV
        </Button>
      </Stack>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total inquiries", value: counts.total, accent: false },
          { label: "Open", value: counts.open, accent: true },
          { label: "Answered", value: counts.answered, accent: false },
          { label: "Closed", value: counts.closed, accent: false },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 3 }}>
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
        placeholder="Search question, kit, name, email…"
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
              {rows.length === 0 ? "No inquiries yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "No inquiries yet — there's no member-facing \"ask a question\" form live yet."
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
                  <Box component="th">Question</Box>
                  <Box component="th">Kit</Box>
                  <Box component="th">From</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Asked</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  const open = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <Box component="tr">
                        <Box component="td" sx={{ maxWidth: 420 }}>
                          <Typography sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
                            {row.question}
                          </Typography>
                        </Box>
                        <Box component="td">
                          <Typography
                            variant="body2"
                            sx={{ color: row.kit_title ? "text.primary" : "text.disabled" }}
                          >
                            {row.kit_title ?? "—"}
                          </Typography>
                        </Box>
                        <Box component="td">
                          <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                            {row.name || "—"}
                          </Typography>
                          {row.email && (
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                            >
                              {row.email}
                            </Typography>
                          )}
                        </Box>
                        <Box component="td">
                          <Select
                            value={row.status}
                            onChange={(e) => updateStatus(row, e.target.value as InquiryStatus)}
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
                            {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((s) => (
                              <MenuItem key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <Box component="td">
                          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                            {formatDate(row.created_at)}
                          </Typography>
                        </Box>
                        <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                          {row.email && (
                            <Tooltip title={`Email ${row.email}`}>
                              <IconButton component="a" href={`mailto:${row.email}`} size="small">
                                <EmailOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={open ? "Hide note" : "Add/edit note"}>
                            <IconButton size="small" onClick={() => setExpandedId(open ? null : row.id)}>
                              {open ? (
                                <ExpandLessOutlinedIcon fontSize="small" />
                              ) : (
                                <ExpandMoreOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      {open && (
                        <Box component="tr">
                          <Box component="td" colSpan={6} sx={{ bgcolor: "rgba(247,245,240,0.5)" }}>
                            <Stack spacing={1}>
                              {row.resolved_by && (
                                <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.78rem" }}>
                                  Resolved {formatDate(row.resolved_at)}
                                </Typography>
                              )}
                              <TextField
                                label="Admin note"
                                size="small"
                                multiline
                                minRows={2}
                                fullWidth
                                value={noteDraft[row.id] ?? row.admin_note ?? ""}
                                onChange={(e) =>
                                  setNoteDraft((d) => ({ ...d, [row.id]: e.target.value }))
                                }
                              />
                              <Box>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={savingId === row.id}
                                  onClick={() => saveNote(row)}
                                >
                                  {savingId === row.id ? "Saving…" : "Save note"}
                                </Button>
                              </Box>
                            </Stack>
                          </Box>
                        </Box>
                      )}
                    </Fragment>
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
