"use client";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";

export type FeedbackRow = {
  id: string;
  member_id: string | null;
  name: string | null;
  email: string | null;
  category: string | null;
  rating: number | null;
  message: string;
  status: "new" | "reviewed" | "archived";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLOR: Record<FeedbackRow["status"], { bg: string; fg: string }> = {
  new: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  reviewed: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  archived: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
};

const STATUS_LABEL: Record<FeedbackRow["status"], string> = {
  new: "New",
  reviewed: "Reviewed",
  archived: "Archived",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderRating(rating: number | null): string {
  if (!rating) return "—";
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export default function FeedbackTable({ initialRows }: { initialRows: FeedbackRow[] }) {
  const [rows, setRows] = useState<FeedbackRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(lc) ||
        (r.email ?? "").toLowerCase().includes(lc) ||
        (r.category ?? "").toLowerCase().includes(lc) ||
        r.message.toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      new: rows.filter((r) => r.status === "new").length,
      reviewed: rows.filter((r) => r.status === "reviewed").length,
    }),
    [rows],
  );

  const updateStatus = async (id: string, status: FeedbackRow["status"]) => {
    const prior = rows.find((r) => r.id === id)?.status;
    setRows((r) => r.map((row) => (row.id === id ? { ...row, status } : row)));
    setErr(null);
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      if (prior) setRows((r) => r.map((row) => (row.id === id ? { ...row, status: prior } : row)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          FEEDBACK
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Member feedback
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
          Feedback submitted by members from the portal. Triage it into reviewed or archived as
          you work through it.
        </Typography>
      </Box>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total feedback", value: counts.total, accent: false },
          { label: "New", value: counts.new, accent: true },
          { label: "Reviewed", value: counts.reviewed, accent: false },
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
        placeholder="Search name, email, category, message…"
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
              {rows.length === 0 ? "No feedback yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "No feedback yet — this fills in once members can submit it from the portal."
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
                  <Box component="th">Category</Box>
                  <Box component="th">Rating</Box>
                  <Box component="th">Message</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Submitted</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                          {row.name || "Anonymous"}
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
                        {row.category ? (
                          <Chip
                            label={row.category}
                            size="small"
                            sx={{
                              fontSize: "0.7rem",
                              height: 22,
                              textTransform: "capitalize",
                              bgcolor: "rgba(84,113,138,0.1)",
                              color: "#33475C",
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: "text.disabled" }}>
                            —
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Typography sx={{ color: row.rating ? "#A87D2C" : "text.disabled", letterSpacing: "0.05em" }}>
                          {renderRating(row.rating)}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ maxWidth: 420 }}>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
                          {row.message}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Select
                          value={row.status}
                          onChange={(e) => updateStatus(row.id, e.target.value as FeedbackRow["status"])}
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
                          {(Object.keys(STATUS_LABEL) as FeedbackRow["status"][]).map((s) => (
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
