"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Snackbar, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E0DACE";

type Status = "active" | "viewed" | "accepted" | "revoked";
type InviteLink = {
  id: string;
  code: string;
  kind: "expert" | "partner";
  full_name: string;
  email: string | null;
  company_name: string | null;
  notes: string | null;
  status: Status;
  viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  invite_url: string;
};

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  active: { label: "Ready to send", bg: "rgba(160,120,35,0.14)", fg: "#7A5B12" },
  viewed: { label: "Viewed", bg: "rgba(31,58,92,0.14)", fg: "#1B3A5C" },
  accepted: { label: "Accepted", bg: "rgba(34,108,78,0.14)", fg: "#1F5C40" },
  revoked: { label: "Revoked", bg: "rgba(122,133,144,0.16)", fg: INK_MUTED },
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

/**
 * /admin/invites — standard (non-founding) personalized invite links.
 * Create → copy → paste into a manually written email. No auto-send,
 * standard v1 agreement, no Stripe at signup.
 */
type Owner = { id: string; name: string; email: string | null; status: string; contact_name?: string | null };

export default function AdminInviteLinksPage() {
  const [rows, setRows] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [experts, setExperts] = useState<Owner[]>([]);
  const [partners, setPartners] = useState<Owner[]>([]);

  // form
  const [mode, setMode] = useState<"existing" | "prospect">("existing");
  const [kind, setKind] = useState<"expert" | "partner">("partner");
  const [ownerId, setOwnerId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, ownersRes] = await Promise.all([
        fetch("/api/admin/invite-links", { cache: "no-store" }),
        fetch("/api/admin/invite-links?owners=1", { cache: "no-store" }),
      ]);
      if (listRes.ok) {
        const b = (await listRes.json()) as { links?: InviteLink[] };
        setRows(b.links ?? []);
      }
      if (ownersRes.ok) {
        const o = (await ownersRes.json()) as { experts?: Owner[]; partners?: Owner[] };
        setExperts(o.experts ?? []);
        setPartners(o.partners ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const owners = kind === "expert" ? experts : partners;

  const create = async () => {
    if (mode === "existing" && !ownerId) { setError("Pick who this link is for."); return; }
    if (mode === "prospect" && fullName.trim().length < 2) { setError("Add the person's name."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "existing"
            ? { kind, owner_id: ownerId, notes: notes || undefined }
            : { kind, full_name: fullName, email: email || undefined, company_name: company || undefined, notes: notes || undefined },
        ),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string; link?: { invite_url?: string }; reused?: boolean };
      if (!res.ok) { setError(b.error ?? "Couldn't create the link."); return; }
      if (b.link?.invite_url) {
        try {
          await navigator.clipboard.writeText(b.link.invite_url);
          setToast(b.reused ? "This profile already had a live link. Copied it" : "Link created + copied to clipboard");
        } catch { setToast("Link created"); }
      }
      setOwnerId(""); setFullName(""); setEmail(""); setCompany(""); setNotes("");
      await load();
    } finally { setSaving(false); }
  };

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setToast("Link copied"); }
    catch { setToast("Couldn't copy. Select it manually"); }
  };

  const act = async (id: string, action: "revoke" | "reactivate") => {
    const res = await fetch("/api/admin/invite-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) { setToast(action === "revoke" ? "Revoked" : "Reactivated"); await load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invite link? The URL stops working immediately.")) return;
    const res = await fetch(`/api/admin/invite-links?id=${id}`, { method: "DELETE" });
    if (res.ok) { setToast("Deleted"); await load(); }
  };

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1000, mx: "auto" }}>
      <Box>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", mb: 1 }}>
          Invite links
        </Typography>
        <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, mb: 1 }}>
          Personalized standard invites
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, maxWidth: 680 }}>
          For experts and companies who are not founding members. Create a link, copy it, and paste it into the email you
          write them. It greets them by name and pre-fills the standard application (standard agreement, no card at
          signup). Nothing is emailed automatically.
        </Typography>
      </Box>

      {/* Create */}
      <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#FFFFFF", p: { xs: 2, md: 3 } }}>
        <Typography sx={{ fontWeight: 700, color: INK, mb: 2 }}>New invite link</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <TextField select size="small" label="Link for" value={mode} onChange={(e) => { setMode(e.target.value as "existing" | "prospect"); setOwnerId(""); }} sx={{ width: 220, flexShrink: 0 }}>
              <MenuItem value="existing">Existing expert / company</MenuItem>
              <MenuItem value="prospect">New prospect (no profile yet)</MenuItem>
            </TextField>
            <TextField select size="small" label="For a" value={kind} onChange={(e) => { setKind(e.target.value as "expert" | "partner"); setOwnerId(""); }} sx={{ width: 150, flexShrink: 0 }}>
              <MenuItem value="partner">Partner</MenuItem>
              <MenuItem value="expert">Expert</MenuItem>
            </TextField>
            {mode === "existing" ? (
              <TextField select size="small" label="Who" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} sx={{ flexGrow: 1, minWidth: 280, flexBasis: 280 }}>
                <MenuItem value="" disabled>Select…</MenuItem>
                {owners.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}{o.contact_name ? ` · ${o.contact_name}` : ""} ({o.status})
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <>
                <TextField size="small" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} sx={{ flexGrow: 1, minWidth: 220, flexBasis: 220 }} placeholder="Dr. Jane Doe" />
                <TextField size="small" label="Email (optional, pre-fills the form)" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flexGrow: 1, minWidth: 260, flexBasis: 260 }} />
              </>
            )}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            {mode === "prospect" && (
              <TextField size="small" label={kind === "partner" ? "Company (optional)" : "Topic or firm (optional)"} value={company} onChange={(e) => setCompany(e.target.value)} sx={{ flexGrow: 1, minWidth: 220, flexBasis: 220 }} />
            )}
            <TextField size="small" label="Internal note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ flexGrow: 1.4, minWidth: 260, flexBasis: 300 }} placeholder="e.g. met at the Chicago midwinter meeting" />
            <Button variant="contained" startIcon={saving ? <CircularProgress size={15} sx={{ color: "#fff" }} /> : <AddRoundedIcon />}
              onClick={create} disabled={saving}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999, bgcolor: INK, "&:hover": { bgcolor: "#13253c" }, whiteSpace: "nowrap", flexShrink: 0 }}>
              Create + copy link
            </Button>
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED }}>
            Existing profile → the link has them accept the standard agreement, then sign in (card required in the portal
            to start the trial). New prospect → the link pre-fills the standard application for team review.
          </Typography>
        </Stack>
      </Box>

      {/* List */}
      <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#FFFFFF", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>All invite links</Typography>
        </Box>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}><CircularProgress size={20} sx={{ color: GOLD }} /></Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}><Typography sx={{ color: INK_MUTED }}>No invite links yet.</Typography></Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
            {rows.map((r) => {
              const st = STATUS_META[r.status];
              return (
                <Stack key={r.id} direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ px: 2.5, py: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", mb: 0.4, flexWrap: "wrap", gap: 0.5 }}>
                      <Chip label={r.kind === "expert" ? "Expert" : "Company"} size="small"
                        sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", bgcolor: r.kind === "expert" ? "rgba(34,108,78,0.12)" : "rgba(217,168,75,0.16)", color: r.kind === "expert" ? "#1F5C40" : "#7A5B12" }} />
                      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{r.full_name}</Typography>
                      {r.company_name && <Typography sx={{ fontSize: "0.82rem", color: INK_SOFT }}>· {r.company_name}</Typography>}
                      <Chip label={st.label} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: st.bg, color: st.fg }} />
                    </Stack>
                    <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED, wordBreak: "break-all" }}>
                      {r.invite_url}
                      {r.email ? ` · ${r.email}` : ""}
                      {r.viewed_at ? ` · viewed ${fmt(r.viewed_at)}` : ""}
                      {r.accepted_at ? ` · accepted ${fmt(r.accepted_at)}` : ` · expires ${fmt(r.expires_at)}`}
                    </Typography>
                    {r.notes && <Typography sx={{ fontSize: "0.76rem", color: INK_MUTED, fontStyle: "italic" }}>{r.notes}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                    <Tooltip title="Copy link">
                      <IconButton size="small" onClick={() => copy(r.invite_url)} sx={{ color: INK_SOFT }}>
                        <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    {(r.status === "active" || r.status === "viewed") && (
                      <Tooltip title="Revoke: link stops working">
                        <IconButton size="small" onClick={() => act(r.id, "revoke")} sx={{ color: INK_SOFT }}>
                          <BlockRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {r.status === "revoked" && (
                      <Tooltip title="Reactivate (+60 days)">
                        <IconButton size="small" onClick={() => act(r.id, "reactivate")} sx={{ color: INK_SOFT }}>
                          <ReplayRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {r.status !== "accepted" && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => remove(r.id)}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Stack>
  );
}
