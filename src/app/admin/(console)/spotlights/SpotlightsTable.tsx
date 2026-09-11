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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import UnpublishedOutlinedIcon from "@mui/icons-material/UnpublishedOutlined";

export type SpotlightRow = {
  id: string;
  expert_application_id: string | null;
  partner_application_id: string | null;
  kind: "update" | "event" | "news" | "feature";
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  event_date: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ExpertOption = { id: string; full_name: string; company: string | null };
export type PartnerOption = { id: string; company_name: string; contact_name: string | null };

const KIND_LABEL: Record<SpotlightRow["kind"], string> = {
  update: "Update",
  event: "Event",
  news: "News",
  feature: "Feature",
};

const KIND_COLOR: Record<SpotlightRow["kind"], { bg: string; fg: string }> = {
  update: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  event: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  news: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  feature: { bg: "rgba(160,90,190,0.12)", fg: "#5C2E7A" },
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

function formatEventDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SpotlightsTable({
  initialRows,
  experts,
  partners,
}: {
  initialRows: SpotlightRow[];
  experts: ExpertOption[];
  partners: PartnerOption[];
}) {
  const [rows, setRows] = useState<SpotlightRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [ownerType, setOwnerType] = useState<"expert" | "partner">("expert");
  const [ownerId, setOwnerId] = useState("");
  const [kind, setKind] = useState<SpotlightRow["kind"]>("update");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventDate, setEventDate] = useState("");

  const ownerName = (row: SpotlightRow): { name: string; type: "Expert" | "Partner" } => {
    if (row.expert_application_id) {
      const e = experts.find((x) => x.id === row.expert_application_id);
      return { name: e ? e.full_name : "Unknown expert", type: "Expert" };
    }
    const p = partners.find((x) => x.id === row.partner_application_id);
    return { name: p ? p.company_name : "Unknown partner", type: "Partner" };
  };

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter((r) => {
      const { name } = ownerName(r);
      return (
        r.title.toLowerCase().includes(lc) ||
        r.body.toLowerCase().includes(lc) ||
        name.toLowerCase().includes(lc)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, experts, partners]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((r) => r.is_published).length,
      drafts: rows.filter((r) => !r.is_published).length,
    }),
    [rows],
  );

  const refresh = async () => {
    const res = await fetch("/api/admin/spotlights", { cache: "no-store" });
    const body = (await res.json()) as { rows?: SpotlightRow[] };
    if (body.rows) setRows(body.rows);
  };

  const togglePublish = async (row: SpotlightRow) => {
    const action = row.is_published ? "unpublish" : "publish";
    const now = new Date().toISOString();
    setRows((r) =>
      r.map((x) =>
        x.id === row.id
          ? { ...x, is_published: action === "publish", published_at: action === "publish" ? now : null }
          : x,
      ),
    );
    const res = await fetch("/api/admin/spotlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) =>
        r.map((x) =>
          x.id === row.id ? { ...x, is_published: row.is_published, published_at: row.published_at } : x,
        ),
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const resetForm = () => {
    setOwnerType("expert");
    setOwnerId("");
    setKind("update");
    setTitle("");
    setBodyText("");
    setLinkUrl("");
    setLinkLabel("");
    setImageUrl("");
    setEventDate("");
  };

  const addSpotlight = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/spotlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType,
          ownerId,
          kind,
          title,
          body: bodyText,
          linkUrl: linkUrl || undefined,
          linkLabel: linkLabel || undefined,
          imageUrl: imageUrl || undefined,
          eventDate: eventDate || undefined,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not create spotlight.");
      setNotice("Spotlight created as a draft.");
      resetForm();
      setAdding(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create spotlight.");
    } finally {
      setBusy(false);
    }
  };

  const ownerOptions = ownerType === "expert" ? experts : partners;

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            SPOTLIGHTS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Profile spotlights
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Spotlights aren&apos;t rendered on public expert/partner profiles yet in this phase —
            this page is admin management only for now, so you can draft and hold items ready.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlinedIcon />}
            onClick={() => setAdding((v) => !v)}
          >
            New spotlight
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
          onSubmit={addSpotlight}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Draft a spotlight</Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                select
                label="Owner type"
                size="small"
                value={ownerType}
                onChange={(e) => {
                  setOwnerType(e.target.value as "expert" | "partner");
                  setOwnerId("");
                }}
                sx={{ flex: 1 }}
              >
                <MenuItem value="expert">Expert</MenuItem>
                <MenuItem value="partner">Partner</MenuItem>
              </TextField>
              <TextField
                select
                label="Owner"
                size="small"
                required
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                sx={{ flex: 1.5 }}
                helperText={ownerOptions.length === 0 ? "No approved records yet." : undefined}
              >
                {ownerOptions.length === 0 && (
                  <MenuItem value="" disabled>
                    No approved {ownerType === "expert" ? "experts" : "partners"} yet
                  </MenuItem>
                )}
                {experts.length > 0 && ownerType === "expert"
                  ? experts.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.full_name}
                        {o.company ? ` — ${o.company}` : ""}
                      </MenuItem>
                    ))
                  : null}
                {partners.length > 0 && ownerType === "partner"
                  ? partners.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.company_name}
                        {o.contact_name ? ` — ${o.contact_name}` : ""}
                      </MenuItem>
                    ))
                  : null}
              </TextField>
              <TextField
                select
                label="Kind"
                size="small"
                value={kind}
                onChange={(e) => setKind(e.target.value as SpotlightRow["kind"])}
                sx={{ flex: 1 }}
              >
                {(Object.keys(KIND_LABEL) as SpotlightRow["kind"][]).map((k) => (
                  <MenuItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </MenuItem>
                ))}
              </TextField>
              {kind === "event" && (
                <TextField
                  label="Event date"
                  type="date"
                  size="small"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                />
              )}
            </Stack>
            <TextField
              label="Title"
              size="small"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              helperText="3-160 characters"
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <TextField
              label="Body"
              size="small"
              required
              multiline
              minRows={3}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              helperText={`${bodyText.length}/2000 characters`}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="Link URL"
                size="small"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                sx={{ flex: 1.5 }}
              />
              <TextField
                label="Link label"
                size="small"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Image URL"
                size="small"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                sx={{ flex: 1.5 }}
              />
            </Stack>
            <Box>
              <Button type="submit" variant="contained" disabled={busy || !ownerId}>
                {busy ? "Saving…" : "Save as draft"}
              </Button>
            </Box>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total spotlights", value: counts.total, accent: false },
          { label: "Published", value: counts.published, accent: false },
          { label: "Drafts", value: counts.drafts, accent: true },
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
        placeholder="Search title, body, owner…"
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
              {rows.length === 0 ? "No spotlights yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "Draft the first spotlight for an approved expert or partner."
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
                  <Box component="th">Title</Box>
                  <Box component="th">Kind</Box>
                  <Box component="th">Owner</Box>
                  <Box component="th">Event date</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Created</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const owner = ownerName(row);
                  const kColor = KIND_COLOR[row.kind];
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td" sx={{ maxWidth: 320 }}>
                        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{row.title}</Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.78rem",
                            mt: 0.25,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {row.body}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip
                          label={KIND_LABEL[row.kind]}
                          size="small"
                          sx={{ fontSize: "0.7rem", height: 22, bgcolor: kColor.bg, color: kColor.fg }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.85rem" }}>
                          {owner.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.76rem" }}>
                          {owner.type}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography
                          variant="body2"
                          sx={{ color: row.kind === "event" ? "text.primary" : "text.disabled", fontSize: "0.8rem" }}
                        >
                          {row.kind === "event" ? formatEventDate(row.event_date) : "—"}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.is_published ? "Published" : "Draft"}
                          size="small"
                          sx={{
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: row.is_published ? "rgba(46,138,87,0.12)" : "rgba(120,120,120,0.14)",
                            color: row.is_published ? "#1F5C39" : "#4A4A4A",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title={row.is_published ? "Unpublish" : "Publish"}>
                          <IconButton size="small" onClick={() => togglePublish(row)}>
                            {row.is_published ? (
                              <UnpublishedOutlinedIcon fontSize="small" />
                            ) : (
                              <PublishOutlinedIcon fontSize="small" />
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
