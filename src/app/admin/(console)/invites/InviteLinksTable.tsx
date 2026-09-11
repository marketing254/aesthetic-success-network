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
  Select,
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

export type InviteLinkStatus = "active" | "viewed" | "accepted" | "revoked";
export type InviteLinkKind = "expert" | "partner";

export type InviteLinkRow = {
  id: string;
  code: string;
  invite_url: string;
  kind: InviteLinkKind;
  full_name: string;
  email: string | null;
  company_name: string | null;
  notes: string | null;
  status: InviteLinkStatus;
  viewed_at: string | null;
  accepted_at: string | null;
  expert_application_id: string | null;
  partner_application_id: string | null;
  expires_at: string;
  created_at: string;
};

const STATUS_COLOR: Record<InviteLinkStatus, { bg: string; fg: string }> = {
  active: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
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

export default function InviteLinksTable({ initialRows }: { initialRows: InviteLinkRow[] }) {
  const [rows, setRows] = useState<InviteLinkRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<InviteLinkKind>("expert");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(lc) ||
        (r.email ?? "").toLowerCase().includes(lc) ||
        (r.company_name ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      experts: rows.filter((r) => r.kind === "expert").length,
      partners: rows.filter((r) => r.kind === "partner").length,
      accepted: rows.filter((r) => r.status === "accepted").length,
    }),
    [rows],
  );

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fullName, email, companyName, notes }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        code?: string;
        invite_url?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not create invite link.");
      setRows((r) => [
        {
          id: body.id!,
          code: body.code!,
          invite_url: body.invite_url!,
          kind,
          full_name: fullName,
          email: email ? email.toLowerCase() : null,
          company_name: companyName || null,
          notes: notes || null,
          status: "active",
          viewed_at: null,
          accepted_at: null,
          expert_application_id: null,
          partner_application_id: null,
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
        ...r,
      ]);
      setNotice(`Invite link created for ${fullName}. Copy it below and send it yourself.`);
      setFullName("");
      setEmail("");
      setCompanyName("");
      setNotes("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create invite link.");
    } finally {
      setBusy(false);
    }
  };

  const setAction = async (id: string, action: "revoke" | "reactivate") => {
    const prev = rows;
    setRows((r) =>
      r.map((x) => (x.id === id ? { ...x, status: action === "revoke" ? "revoked" : "active" } : x)),
    );
    const res = await fetch("/api/admin/invite-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
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
            INVITE LINKS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Personal invite links
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Give an expert or partner prospect a head start — the link pre-fills their application
            at /invite/&lt;code&gt;. Nothing is emailed automatically; paste the link into your own
            message.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAltOutlinedIcon />}
          onClick={() => setAdding((v) => !v)}
        >
          New link
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
          onSubmit={createLink}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Invite an expert or partner prospect</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Select
              size="small"
              value={kind}
              onChange={(e) => setKind(e.target.value as InviteLinkKind)}
              sx={{ flex: 0.8 }}
            >
              <MenuItem value="expert">Expert</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
            </Select>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label={kind === "partner" ? "Company name" : "Topic / firm"}
              size="small"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
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
              {busy ? "Creating…" : "Create link"}
            </Button>
            <Button variant="outlined" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total links", value: counts.total, accent: false },
          { label: "Experts", value: counts.experts, accent: false },
          { label: "Partners", value: counts.partners, accent: false },
          { label: "Accepted", value: counts.accepted, accent: true },
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
        placeholder="Search name, email, company…"
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
              {rows.length === 0 ? "No invite links yet" : "No matches"}
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
                  <Box component="th">Kind</Box>
                  <Box component="th">Company / topic</Box>
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
                        <Chip
                          label={row.kind}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: "rgba(84,113,138,0.12)",
                            color: "#33475C",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography
                          variant="body2"
                          sx={{ color: row.company_name ? "text.primary" : "text.disabled" }}
                        >
                          {row.company_name ?? "—"}
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
