"use client";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";

export type Audience = "all" | "members" | "experts" | "partners";
export type AnnouncementStatus = "draft" | "sent";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  status: AnnouncementStatus;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLOR: Record<AnnouncementStatus, { bg: string; fg: string }> = {
  draft: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  sent: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
};

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "members", label: "Members" },
  { value: "experts", label: "Experts" },
  { value: "partners", label: "Partners" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BroadcastTable({ initialRows }: { initialRows: AnnouncementRow[] }) {
  const [rows, setRows] = useState<AnnouncementRow[]>(initialRows);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAudience, setNewAudience] = useState<Audience>("all");
  const [newBody, setNewBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: rows.length,
      draft: rows.filter((r) => r.status === "draft").length,
      sent: rows.filter((r) => r.status === "sent").length,
    }),
    [rows],
  );

  const refresh = async () => {
    const res = await fetch("/api/admin/broadcast", { cache: "no-store" });
    const body = (await res.json()) as { rows?: AnnouncementRow[] };
    if (body.rows) setRows(body.rows);
  };

  const addAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody, audience: newAudience }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not save the draft.");
      setNotice("Draft saved.");
      setNewTitle("");
      setNewBody("");
      setNewAudience("all");
      setAdding(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the draft.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (row: AnnouncementRow, action: "mark_sent" | "revert_to_draft") => {
    setActingId(row.id);
    setErr(null);
    const prevStatus = row.status;
    const prevSentAt = row.sent_at;
    setRows((r) =>
      r.map((x) =>
        x.id === row.id
          ? {
              ...x,
              status: action === "mark_sent" ? "sent" : "draft",
              sent_at: action === "mark_sent" ? new Date().toISOString() : null,
            }
          : x,
      ),
    );
    const res = await fetch("/api/admin/broadcast", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) =>
        r.map((x) => (x.id === row.id ? { ...x, status: prevStatus, sent_at: prevSentAt } : x)),
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
    setActingId(null);
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
            BROADCAST
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Announcements
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Draft and track announcements to members, experts, or partners. This page doesn&apos;t
            send anything itself — the Slack integration and member in-app notifications it would
            dispatch through don&apos;t exist in ASN yet (Phase 3 scope). &quot;Mark sent&quot; just
            records that the team published it elsewhere.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<CampaignOutlinedIcon />}
          onClick={() => setAdding((v) => !v)}
        >
          New announcement
        </Button>
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
          onSubmit={addAnnouncement}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Draft an announcement</Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="Title"
                size="small"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                slotProps={{ htmlInput: { minLength: 2, maxLength: 160 } }}
                sx={{ flex: 2 }}
              />
              <TextField
                select
                label="Audience"
                size="small"
                required
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value as Audience)}
                sx={{ flex: 1, minWidth: 160 }}
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Body"
              size="small"
              required
              multiline
              minRows={3}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
            />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? "Posting…" : "Post draft"}
              </Button>
              <Button variant="text" disabled={busy} onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total announcements", value: counts.total, accent: false },
          { label: "Draft", value: counts.draft, accent: true },
          { label: "Sent", value: counts.sent, accent: false },
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

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="h5" sx={{ mb: 1, color: "text.primary" }}>
              No announcements yet
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Draft one above to get started.
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
                  <Box component="th">Title</Box>
                  <Box component="th">Audience</Box>
                  <Box component="th">Body</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Sent</Box>
                  <Box component="th">Created</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {rows.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                          {row.title}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.audience}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: "rgba(84,113,138,0.14)",
                            color: "#33475C",
                          }}
                        />
                      </Box>
                      <Box component="td" sx={{ maxWidth: 420 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            whiteSpace: "pre-wrap",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {row.body}
                        </Typography>
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
                          {formatDate(row.sent_at)}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        {row.status === "draft" ? (
                          <Tooltip title="Mark sent — records the announcement, doesn't send an email or Slack message yet.">
                            <span>
                              <IconButton
                                size="small"
                                disabled={actingId === row.id}
                                onClick={() => act(row, "mark_sent")}
                                sx={{ color: "#1F5C39" }}
                              >
                                <SendOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Revert to draft">
                            <span>
                              <IconButton
                                size="small"
                                disabled={actingId === row.id}
                                onClick={() => act(row, "revert_to_draft")}
                              >
                                <ReplayOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
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
