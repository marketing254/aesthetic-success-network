"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Checkbox, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E0DACE";
const GOLD = "#A07823";

type Owner = { id: string; name: string };
type Kind = "update" | "event" | "news" | "feature";
type Spotlight = {
  id: string; kind: Kind; title: string; body: string;
  link_url: string | null; link_label: string | null; image_url: string | null;
  event_date: string | null; is_published: boolean; posted_to_feed: boolean;
  created_at: string;
  owner: { kind: "expert" | "partner"; id: string; name: string };
};

const KINDS: Kind[] = ["update", "event", "news", "feature"];

export default function AdminSpotlightsPage() {
  const [experts, setExperts] = useState<Owner[]>([]);
  const [partners, setPartners] = useState<Owner[]>([]);
  const [rows, setRows] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form
  const [ownerKind, setOwnerKind] = useState<"expert" | "partner">("expert");
  const [ownerId, setOwnerId] = useState("");
  const [linkedOwnerId, setLinkedOwnerId] = useState("");
  const [kind, setKind] = useState<Kind>("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [publish, setPublish] = useState(true);
  const [postToFeed, setPostToFeed] = useState(true);
  const [saving, setSaving] = useState(false);

  // edit dialog
  const [edit, setEdit] = useState<Spotlight | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ownersRes, listRes] = await Promise.all([
        fetch("/api/admin/spotlights?owners=1", { cache: "no-store" }),
        fetch("/api/admin/spotlights", { cache: "no-store" }),
      ]);
      if (ownersRes.ok) {
        const o = (await ownersRes.json()) as { experts?: Owner[]; partners?: Owner[] };
        setExperts(o.experts ?? []);
        setPartners(o.partners ?? []);
      }
      if (listRes.ok) {
        const l = (await listRes.json()) as { spotlights?: Spotlight[] };
        setRows(l.spotlights ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const owners = ownerKind === "expert" ? experts : partners;

  const create = async () => {
    if (!ownerId) { setError("Pick an expert or company."); return; }
    if (title.trim().length < 3) { setError("Add a title."); return; }
    if (body.trim().length < 3) { setError("Add some detail."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/spotlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_kind: ownerKind, owner_id: ownerId, linked_owner_id: linkedOwnerId || null, kind, title, body,
          link_url: linkUrl || null, link_label: linkLabel || null, image_url: imageUrl || null,
          event_date: kind === "event" ? (eventDate || null) : null,
          publish, post_to_feed: postToFeed,
        }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(b.error ?? "Couldn't save."); return; }
      setToast(publish ? "Published" + (postToFeed ? " + posted to feed" : "") : "Saved as draft");
      setTitle(""); setBody(""); setLinkUrl(""); setLinkLabel(""); setImageUrl(""); setEventDate(""); setLinkedOwnerId("");
      await load();
    } finally { setSaving(false); }
  };

  const act = async (id: string, action: "publish" | "unpublish") => {
    const res = await fetch("/api/admin/spotlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, post_to_feed: true }),
    });
    if (res.ok) { setToast(action === "publish" ? "Published" : "Unpublished"); await load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this spotlight? This can't be undone.")) return;
    const res = await fetch(`/api/admin/spotlights?id=${id}`, { method: "DELETE" });
    if (res.ok) { setToast("Deleted"); await load(); }
  };

  const setEditField = <K extends keyof Spotlight>(key: K, value: Spotlight[K]) =>
    setEdit((prev) => (prev ? { ...prev, [key]: value } : prev));

  const saveEdit = async () => {
    if (!edit) return;
    if (edit.title.trim().length < 3) { setEditErr("Add a title."); return; }
    if (edit.body.trim().length < 3) { setEditErr("Add some detail."); return; }
    setSavingEdit(true); setEditErr(null);
    try {
      const res = await fetch("/api/admin/spotlights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id, action: "update",
          kind: edit.kind, title: edit.title, body: edit.body,
          link_url: edit.link_url || null, link_label: edit.link_label || null,
          image_url: edit.image_url || null,
          event_date: edit.kind === "event" ? (edit.event_date || null) : null,
        }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setEditErr(b.error ?? "Couldn't save."); return; }
      setToast("Changes saved");
      setEdit(null);
      await load();
    } finally { setSavingEdit(false); }
  };

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1000, mx: "auto" }}>
      <Box>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", mb: 1 }}>
          Spotlights
        </Typography>
        <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, mb: 1 }}>
          What&apos;s new on profiles
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, maxWidth: 680 }}>
          Add news, events, or announcements to an expert or company profile. Publishing shows it on
          their profile in the member portal and posts a nudge to the network feed.
        </Typography>
      </Box>

      {/* Create */}
      <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#FFFFFF", p: { xs: 2, md: 3 } }}>
        <Typography sx={{ fontWeight: 700, color: INK, mb: 2 }}>Add a spotlight</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select size="small" label="For" value={ownerKind}
              onChange={(e) => { setOwnerKind(e.target.value as "expert" | "partner"); setOwnerId(""); setLinkedOwnerId(""); }}
              sx={{ minWidth: 140 }}>
              <MenuItem value="expert">Expert</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
            </TextField>
            <TextField select size="small" label="Who" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} sx={{ flex: 1, minWidth: 200 }}>
              <MenuItem value="" disabled>Select…</MenuItem>
              {owners.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
            <TextField select size="small"
              label={ownerKind === "expert" ? "Also show on company (optional)" : "Also show on expert (optional)"}
              value={linkedOwnerId} onChange={(e) => setLinkedOwnerId(e.target.value)} sx={{ flex: 1, minWidth: 220 }}>
              <MenuItem value="">None</MenuItem>
              {(ownerKind === "expert" ? partners : experts).map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} sx={{ minWidth: 130 }}>
              {KINDS.map((k) => <MenuItem key={k} value={k} sx={{ textTransform: "capitalize" }}>{k}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 160 } }} />
          <TextField size="small" label="Details" value={body} onChange={(e) => setBody(e.target.value)} fullWidth multiline minRows={3} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} sx={{ flex: 2 }} placeholder="https://…" />
            <TextField size="small" label="Link label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} sx={{ flex: 1 }} placeholder="Register" />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} sx={{ flex: 2 }} placeholder="https://… (event flyer)" />
            {kind === "event" && (
              <TextField size="small" type="date" label="Event date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            )}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <FormControlLabel control={<Checkbox checked={publish} onChange={(e) => setPublish(e.target.checked)} />} label="Publish now" />
            <FormControlLabel control={<Checkbox checked={postToFeed} onChange={(e) => setPostToFeed(e.target.checked)} disabled={!publish} />} label="Also post to network feed" />
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={saving ? <CircularProgress size={15} sx={{ color: "#fff" }} /> : <AddRoundedIcon />}
              onClick={create} disabled={saving}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999, bgcolor: INK, "&:hover": { bgcolor: "#13253c" } }}>
              {publish ? "Publish spotlight" : "Save draft"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* List */}
      <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#FFFFFF", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>All spotlights</Typography>
        </Box>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}><CircularProgress size={20} sx={{ color: GOLD }} /></Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}><Typography sx={{ color: INK_MUTED }}>No spotlights yet.</Typography></Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
            {rows.map((r) => (
              <Stack key={r.id} direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ px: 2.5, py: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", mb: 0.3, flexWrap: "wrap", gap: 0.5 }}>
                    <Chip label={r.owner.kind === "expert" ? "Expert" : "Company"} size="small"
                      sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", bgcolor: r.owner.kind === "expert" ? "rgba(34,108,78,0.12)" : "rgba(110,51,70,0.12)", color: r.owner.kind === "expert" ? "#1F5C40" : "#6E3346" }} />
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{r.owner.name}</Typography>
                    <Chip label={r.kind} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, textTransform: "capitalize", bgcolor: "#FBF8F1", color: INK_SOFT }} />
                    <Chip label={r.is_published ? "Published" : "Draft"} size="small"
                      sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: r.is_published ? "rgba(34,108,78,0.12)" : "rgba(122,133,144,0.14)", color: r.is_published ? "#1F5C40" : INK_MUTED }} />
                  </Stack>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: INK }}>{r.title}</Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 560 }}>{r.body}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Button size="small" variant="text" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => { setEditErr(null); setEdit({ ...r }); }} sx={{ textTransform: "none", color: INK_SOFT }}>Edit</Button>
                  {r.is_published ? (
                    <Button size="small" variant="text" onClick={() => act(r.id, "unpublish")} sx={{ textTransform: "none", color: INK_SOFT }}>Unpublish</Button>
                  ) : (
                    <Button size="small" variant="outlined" onClick={() => act(r.id, "publish")} sx={{ textTransform: "none", borderRadius: 999, borderColor: LINE, color: INK }}>Publish</Button>
                  )}
                  <Button size="small" color="error" onClick={() => remove(r.id)} sx={{ minWidth: 0, px: 1 }}><DeleteOutlineRoundedIcon fontSize="small" /></Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      {/* Edit dialog */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, color: INK }}>
          Edit spotlight
          {edit && (
            <Typography component="span" sx={{ display: "block", fontSize: "0.82rem", fontWeight: 500, color: INK_MUTED, mt: 0.25 }}>
              {edit.owner.kind === "expert" ? "Expert" : "Company"} · {edit.owner.name}
            </Typography>
          )}
        </DialogTitle>
        {edit && (
          <DialogContent dividers>
            {editErr && <Alert severity="error" sx={{ mb: 2 }}>{editErr}</Alert>}
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <TextField select size="small" label="Type" value={edit.kind} onChange={(e) => setEditField("kind", e.target.value as Kind)} sx={{ maxWidth: 200 }}>
                {KINDS.map((k) => <MenuItem key={k} value={k} sx={{ textTransform: "capitalize" }}>{k}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Title" value={edit.title} onChange={(e) => setEditField("title", e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 160 } }} />
              <TextField size="small" label="Details" value={edit.body} onChange={(e) => setEditField("body", e.target.value)} fullWidth multiline minRows={3} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField size="small" label="Link URL (optional)" value={edit.link_url ?? ""} onChange={(e) => setEditField("link_url", e.target.value || null)} sx={{ flex: 2 }} placeholder="https://…" />
                <TextField size="small" label="Link label" value={edit.link_label ?? ""} onChange={(e) => setEditField("link_label", e.target.value || null)} sx={{ flex: 1 }} placeholder="Register" />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField size="small" label="Image URL (optional)" value={edit.image_url ?? ""} onChange={(e) => setEditField("image_url", e.target.value || null)} sx={{ flex: 2 }} placeholder="https://… (event flyer)" />
                {edit.kind === "event" && (
                  <TextField size="small" type="date" label="Event date" value={edit.event_date ?? ""} onChange={(e) => setEditField("event_date", e.target.value || null)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
                )}
              </Stack>
            </Stack>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEdit(null)} sx={{ textTransform: "none", color: INK_SOFT }}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={savingEdit}
            startIcon={savingEdit ? <CircularProgress size={15} sx={{ color: "#fff" }} /> : null}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999, bgcolor: INK, "&:hover": { bgcolor: "#13253c" } }}>
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Stack>
  );
}
