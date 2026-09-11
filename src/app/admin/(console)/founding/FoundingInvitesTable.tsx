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
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";

export type FoundingStatus = "sent" | "viewed" | "accepted" | "revoked";

export type FoundingInviteRow = {
  id: string;
  code: string;
  invite_url: string;
  full_name: string;
  email: string;
  practice_name: string | null;
  notes: string | null;
  status: FoundingStatus;
  viewed_at: string | null;
  accepted_at: string | null;
  member_id: string | null;
  expires_at: string;
  created_at: string;
};

const STATUS_COLOR: Record<FoundingStatus, { bg: string; fg: string }> = {
  sent: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  viewed: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  accepted: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  revoked: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FoundingInvitesTable({ initialRows }: { initialRows: FoundingInviteRow[] }) {
  const [rows, setRows] = useState<FoundingInviteRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(lc) ||
        r.email.toLowerCase().includes(lc) ||
        (r.practice_name ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === "sent" || r.status === "viewed").length,
      accepted: rows.filter((r) => r.status === "accepted").length,
    }),
    [rows],
  );

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/founding-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, practiceName, notes }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        code?: string;
        invite_url?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not create invite.");
      setRows((r) => [
        {
          id: body.id!,
          code: body.code!,
          invite_url: body.invite_url!,
          full_name: fullName,
          email: email.toLowerCase(),
          practice_name: practiceName || null,
          notes: notes || null,
          status: "sent",
          viewed_at: null,
          accepted_at: null,
          member_id: null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
        ...r,
      ]);
      setNotice(`Invite created for ${fullName}. Copy the link below and send it yourself.`);
      setFullName("");
      setEmail("");
      setPracticeName("");
      setNotes("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  const setAction = async (id: string, action: "revoke" | "reactivate") => {
    const prev = rows;
    setRows((r) =>
      r.map((x) => (x.id === id ? { ...x, status: action === "revoke" ? "revoked" : "sent" } : x)),
    );
    const res = await fetch(`/api/admin/founding-invite/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setRows(prev);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Invite link copied.");
    } catch {
      setErr("Couldn't copy — copy the link manually.");
    }
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
            FOUNDING INVITES
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Founding invites
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Hand-picked prospects skip the waitlist. Mint a link, copy it, and send it yourself —
            it opens /founding/&lt;code&gt; with the Member Agreement and Stripe Checkout ready to go.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAltOutlinedIcon />}
          onClick={() => setAdding((v) => !v)}
        >
          New invite
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
          onSubmit={createInvite}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Invite a founding prospect</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Full name"
              size="small"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Email"
              type="email"
              size="small"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Practice name"
              size="small"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label="Internal notes (never shown to the prospect)"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mt: 1.5 }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Creating…" : "Create invite"}
            </Button>
            <Button variant="outlined" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total invites", value: counts.total, accent: false },
          { label: "Pending", value: counts.pending, accent: true },
          { label: "Accepted", value: counts.accepted, accent: false },
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
              {rows.length === 0 ? "No invites yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0 ? "Create one above." : "Try clearing the search."}
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
                  <Box component="th">Prospect</Box>
                  <Box component="th">Practice</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Expires</Box>
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
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                        >
                          {row.email}
                        </Typography>
                        {row.notes && (
                          <Typography
                            variant="body2"
                            sx={{ color: "text.disabled", fontSize: "0.72rem", mt: 0.25 }}
                          >
                            {row.notes}
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
                          {formatDate(row.expires_at)}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Copy invite link">
                          <IconButton size="small" onClick={() => copyLink(row.invite_url)}>
                            <ContentCopyOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {row.status !== "accepted" && row.status !== "revoked" && (
                          <Tooltip title="Revoke">
                            <IconButton
                              size="small"
                              onClick={() => setAction(row.id, "revoke")}
                              sx={{ color: "#7A2E1F" }}
                            >
                              <BlockOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.status === "revoked" && (
                          <Tooltip title="Reactivate">
                            <IconButton size="small" onClick={() => setAction(row.id, "reactivate")}>
                              <ReplayOutlinedIcon fontSize="small" />
                            </IconButton>
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
