"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

type FileField = {
  field: string;
  label: string;
  accept: string;
  description: string;
};

const COVER_FIELDS: FileField[] = [
  {
    field: "portal_card",
    label: "Portal card",
    accept: "image/*",
    description: "Square cover used in the member-portal grid (recommended 2160×2160 PNG).",
  },
  {
    field: "resource_card",
    label: "Resource card",
    accept: "image/*",
    description: "Wide hero used on the public /resources page and the kit detail header (recommended 2560×1440 PNG).",
  },
];

const CONTENT_FIELDS: FileField[] = [
  { field: "training_video", label: "Training Video", accept: "video/mp4", description: "1080p MP4." },
  { field: "action_guide", label: "Action Guide", accept: "application/pdf", description: "PDF: multi-page reference." },
  { field: "checklist", label: "Checklist", accept: "application/pdf", description: "PDF: implementation steps." },
  { field: "worksheet", label: "Worksheet", accept: "application/pdf", description: "PDF: fill-in worksheet." },
  { field: "key_takeaways", label: "Key Takeaways", accept: "application/pdf", description: "PDF: 1-page summary." },
  { field: "slide_deck_pdf", label: "Slide Deck (PDF)", accept: "application/pdf", description: "PDF: previews inline in the player." },
  {
    field: "slide_deck_pptx",
    label: "Slide Deck (PowerPoint)",
    accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    description: "Editable PowerPoint: opens via Microsoft Office viewer.",
  },
  { field: "wall_poster", label: "Wall Poster", accept: "application/pdf", description: "PDF: printable wall tool." },
];

/**
 * Book Club kit slots — shown only when "Book Club" is picked as the kit
 * type. The kinds map 1:1 to the `resource_kind` enum values added in
 * migration 0029.
 */
const BOOK_CLUB_CONTENT_FIELDS: FileField[] = [
  { field: "book_study_guide", label: "Book Study Guide", accept: "application/pdf", description: "PDF: full study guide for the book." },
  { field: "discussion_questions", label: "Discussion Questions", accept: "application/pdf", description: "PDF: questions for discussion." },
  { field: "infographic_pdf", label: "Infographic (PDF)", accept: "application/pdf", description: "PDF: one-page visual summary." },
  { field: "infographic_image", label: "Infographic (PNG)", accept: "image/png", description: "PNG: same content rendered as image." },
  { field: "short_1", label: "Principle 1: Short (9x16)", accept: "video/mp4", description: "MP4: vertical short for the first key principle." },
  { field: "short_2", label: "Principle 2: Short (9x16)", accept: "video/mp4", description: "MP4: vertical short for the second key principle." },
  { field: "short_3", label: "Principle 3: Short (9x16)", accept: "video/mp4", description: "MP4: vertical short for the third key principle." },
];

/** Kinds an admin can assign to a flexible "additional resource" row —
 *  mirrors EXTRA_KINDS on the API side. */
const EXTRA_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "video_spotlight", label: "Expert Spotlight (16:9 video)" },
  { value: "video_highlight", label: "Highlight (16:9 video)" },
  { value: "video_short", label: "Short (9:16 video)" },
  { value: "video_full", label: "Full-length video" },
  { value: "action_guide", label: "Action Guide (PDF)" },
  { value: "checklist", label: "Checklist (PDF)" },
  { value: "worksheet", label: "Worksheet (PDF)" },
  { value: "key_takeaways", label: "Key Takeaways (PDF)" },
  { value: "slide_deck", label: "Slide Deck" },
  { value: "infographic", label: "Infographic (PDF)" },
  { value: "infographic_image", label: "Infographic (image)" },
  { value: "book_study_guide", label: "Book Study Guide (PDF)" },
  { value: "discussion_questions", label: "Discussion Questions (PDF)" },
  { value: "other", label: "Other" },
];

type ExtraResource = { id: number; title: string; kind: string; file: File | null };

// Resource categories (canon section 4). Keep in sync with the importer default.
const CATEGORIES = [
  "Pricing & Margins",
  "Consult & Conversion",
  "Team & Culture",
  "Patient Experience",
  "Marketing & Growth",
  "Operations & Compliance",
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewKitPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [kitType, setKitType] = useState<"standard" | "book_club">("standard");
  // Book Club principle titles map 1:1 to the 3 shorts. Defaults are
  // generic so the admin can keep them or rename — these become the row
  // titles for the video_short kind.
  const [principleTitles, setPrincipleTitles] = useState<string[]>([
    "Principle 1",
    "Principle 2",
    "Principle 3",
  ]);
  const setPrincipleTitle = (idx: number, value: string) => {
    setPrincipleTitles((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };
  const [approveOnSubmit, setApproveOnSubmit] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  // Flexible extra resources beyond the fixed slots — any count, each with
  // its own title + kind (e.g. an Expert Spotlight, a second worksheet).
  const [extras, setExtras] = useState<ExtraResource[]>([]);
  const [nextExtraId, setNextExtraId] = useState(1);
  const addExtra = () => {
    setExtras((prev) => [...prev, { id: nextExtraId, title: "", kind: "other", file: null }]);
    setNextExtraId((n) => n + 1);
  };
  const updateExtra = (id: number, patch: Partial<ExtraResource>) => {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeExtra = (id: number) => setExtras((prev) => prev.filter((e) => e.id !== id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Originating-author selectors — admin can attribute the kit to an expert
  // or partner so member inquiries route to that portal's inbox + the
  // expert/partner sees it on their own resources view.
  const [originatingExpertId, setOriginatingExpertId] = useState<string>("");
  const [originatingVendorId, setOriginatingVendorId] = useState<string>("");
  const [expertOptions, setExpertOptions] = useState<{ id: string; name: string }[]>([]);
  const [vendorOptions, setVendorOptions] = useState<{ id: string; name: string }[]>([]);

  // Load the picker options once.
  useMemo(() => {
    (async () => {
      try {
        const [eRes, vRes] = await Promise.all([
          fetch("/api/admin/experts?simple=1", { cache: "no-store" }),
          fetch("/api/admin/vendors?simple=1", { cache: "no-store" }),
        ]);
        if (eRes.ok) {
          const body = (await eRes.json()) as { experts?: { id: string; full_name?: string; display_name?: string }[] };
          setExpertOptions(
            (body.experts ?? []).map((e) => ({
              id: e.id,
              name: e.display_name || e.full_name || "(unnamed expert)",
            })),
          );
        }
        if (vRes.ok) {
          const body = (await vRes.json()) as { vendors?: { id: string; display_name?: string; company_name?: string }[] };
          setVendorOptions(
            (body.vendors ?? []).map((v) => ({
              id: v.id,
              name: v.display_name || v.company_name || "(unnamed company)",
            })),
          );
        }
      } catch {
        // best-effort — the selectors just stay empty
      }
    })();
  }, []);

  const derivedSlug = useMemo(() => slugify(title), [title]);
  const effectiveSlug = slugDirty ? slug : derivedSlug;

  const setFile = (field: string, f: File | null) => {
    setFiles((prev) => ({ ...prev, [field]: f }));
  };

  // Active content fields swap between standard and Book Club based on
  // kit type. Standard shows only the standard slots; Book Club shows the
  // shared slots (training video, key takeaways, slide deck, etc.) plus
  // the Book Club specific ones.
  const activeContentFields =
    kitType === "book_club"
      ? [...CONTENT_FIELDS.filter((f) => f.field !== "action_guide" && f.field !== "checklist"), ...BOOK_CLUB_CONTENT_FIELDS]
      : CONTENT_FIELDS;

  const readyExtras = extras.filter((e) => e.file && e.title.trim());
  const contentFileCount = activeContentFields.filter((c) => files[c.field]).length + readyExtras.length;
  const canSubmit =
    title.trim().length > 0 &&
    effectiveSlug.length > 0 &&
    contentFileCount > 0 &&
    !submitting;

  const totalSize = useMemo(() => {
    let bytes = 0;
    for (const f of Object.values(files)) {
      if (f) bytes += f.size;
    }
    for (const e of extras) {
      if (e.file) bytes += e.file.size;
    }
    return bytes;
  }, [files, extras]);

  // Upload progress, keyed by field. 0..1 per file, null = not started.
  const [progress, setProgress] = useState<Record<string, number | null>>({});
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  /**
   * Get a signed PUT URL from our server, then upload the file directly to
   * Supabase Storage. This bypasses Vercel's 4.5MB serverless body limit,
   * so the 17MB+ training video uploads cleanly.
   */
  const uploadOne = async (
    bucket: "member-resources" | "kit-thumbnails",
    field: string,
    file: File,
    storagePath: string,
  ): Promise<{ storagePath: string; publicUrl: string; mime: string; sizeBytes: number }> => {
    const urlRes = await fetch("/api/admin/resources/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path: storagePath }),
    });
    const urlBody = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) {
      throw new Error(urlBody?.error ?? `Failed to get upload URL (${urlRes.status})`);
    }

    setProgress((p) => ({ ...p, [field]: 0 }));

    // XHR so we can observe upload progress (fetch doesn't expose it).
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", urlBody.signedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress((p) => ({ ...p, [field]: e.loaded / e.total }));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress((p) => ({ ...p, [field]: 1 }));
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });

    return {
      storagePath,
      publicUrl: urlBody.publicUrl,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setProgress({});
    setProgressLabel(null);

    try {
      // 1. Upload covers (if any) to kit-thumbnails
      let portalCardUrl: string | null = null;
      let resourceCardUrl: string | null = null;

      for (const c of COVER_FIELDS) {
        const file = files[c.field];
        if (!file) continue;
        setProgressLabel(`Uploading ${c.label}…`);
        const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const storagePath = `${effectiveSlug}/${c.field === "portal_card" ? "portal-card" : "resource-card"}.${ext}`;
        const up = await uploadOne("kit-thumbnails", c.field, file, storagePath);
        if (c.field === "portal_card") portalCardUrl = up.publicUrl;
        else resourceCardUrl = up.publicUrl;
      }

      // 2. Upload content files to member-resources
      const uploaded: Array<{
        fieldKey: string;
        storagePath: string;
        publicUrl: string;
        mime: string;
        sizeBytes: number;
        title?: string;
        kind?: string;
      }> = [];

      for (const c of activeContentFields) {
        const file = files[c.field];
        if (!file) continue;
        setProgressLabel(`Uploading ${c.label}…`);
        const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        const storagePath = `${effectiveSlug}/${safeName}`;
        const up = await uploadOne("member-resources", c.field, file, storagePath);
        uploaded.push({ fieldKey: c.field, ...up });
      }

      // 2b. Upload the flexible extra resources.
      for (const ex of extras) {
        if (!ex.file || !ex.title.trim()) continue;
        setProgressLabel(`Uploading ${ex.title.trim()}…`);
        const safeName = ex.file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        const storagePath = `${effectiveSlug}/${safeName}`;
        const up = await uploadOne("member-resources", `extra_${ex.id}`, ex.file, storagePath);
        uploaded.push({ fieldKey: `extra_${ex.id}`, title: ex.title.trim(), kind: ex.kind, ...up });
      }

      // 3. Tell our server to insert the DB rows now that storage is loaded
      setProgressLabel("Finalising…");
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: effectiveSlug,
          title: title.trim(),
          category: category || null,
          summary: summary.trim() || null,
          approveOnSubmit,
          portalCardUrl,
          resourceCardUrl,
          files: uploaded,
          originatingExpertId: originatingExpertId || null,
          originatingVendorId: originatingVendorId || null,
          kitType,
          principleTitles: kitType === "book_club" ? principleTitles : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `Submit failed (${res.status})`);
        return;
      }
      setSuccess(
        approveOnSubmit
          ? `Kit "${title}" published. ${body.rowsInserted} rows inserted.`
          : `Kit "${title}" submitted for review. ${body.rowsInserted} rows inserted.`,
      );
      setTimeout(() => router.push("/admin/resources"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
      setProgressLabel(null);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Button
          component={Link}
          href="/admin/resources"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: "none", fontSize: "0.8rem", color: "#5C6770" }}
        >
          All kits
        </Button>
      </Stack>

      <Box>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.18em", color: "#7A8590", textTransform: "uppercase", mb: 0.5 }}>
          New submission
        </Typography>
        <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.4rem", md: "1.6rem" }, fontWeight: 500, color: "#0A1320", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
          Submit a new resource kit
        </Typography>
        <Typography sx={{ fontSize: "0.86rem", color: "#5C6770", mt: 0.5, maxWidth: 720 }}>
          Upload the kit&apos;s covers and content files. Submissions land as <strong>Pending review</strong> by default. Toggle &ldquo;Approve on submit&rdquo; below to publish immediately (requires admin role). At least one content file is required.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 1, fontSize: "0.82rem" }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          icon={<CheckRoundedIcon fontSize="inherit" />}
          sx={{ borderRadius: 1, fontSize: "0.82rem" }}
        >
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Kit details" subtitle="What members see in the library.">
            <Stack spacing={2}>
              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The 9 KPIs That Drive Your Practice"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } } }}
                sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
              />
              <TextField
                label="URL slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  setSlugDirty(true);
                }}
                helperText="Auto-derived from the title until you edit it. Lowercase letters, digits, hyphens."
                size="small"
                fullWidth
                slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } }, formHelperText: { sx: { fontSize: "0.7rem", ml: 0.25 } } }}
                sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <TextField
                  label="Kit type"
                  value={kitType}
                  onChange={(e) => setKitType(e.target.value as "standard" | "book_club")}
                  select
                  size="small"
                  fullWidth
                  helperText="Book Club kits get a different shape: shorts + study guide + discussion questions."
                  slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } }, formHelperText: { sx: { fontSize: "0.7rem", ml: 0.25 } } }}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
                >
                  <MenuItem value="standard" sx={{ fontSize: "0.86rem" }}>Standard kit</MenuItem>
                  <MenuItem value="book_club" sx={{ fontSize: "0.86rem" }}>Book Club kit</MenuItem>
                </TextField>
                <TextField
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  select
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } } }}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c} sx={{ fontSize: "0.86rem" }}>
                      {c}
                    </MenuItem>
                  ))}
                  {kitType === "book_club" && (
                    <MenuItem value="Book Club" sx={{ fontSize: "0.86rem" }}>Book Club</MenuItem>
                  )}
                </TextField>
              </Stack>

              {kitType === "book_club" && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1.25,
                    bgcolor: "rgba(110,51,70,0.05)",
                    border: "1px solid rgba(110,51,70,0.18)",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.62rem",
                      fontWeight: 800,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#6E3346",
                      mb: 1,
                    }}
                  >
                    Book Club key principles
                  </Typography>
                  <Stack spacing={1}>
                    {principleTitles.map((p, i) => (
                      <TextField
                        key={i}
                        label={`Principle ${i + 1} title`}
                        value={p}
                        onChange={(e) => setPrincipleTitle(i, e.target.value)}
                        placeholder={i === 0 ? "Make It Obvious" : i === 1 ? "Make It Easy" : "Make It Satisfying"}
                        size="small"
                        fullWidth
                        slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } } }}
                        sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25, bgcolor: "#FFFFFF" } }}
                      />
                    ))}
                  </Stack>
                  <Typography sx={{ fontSize: "0.7rem", color: "#7A8590", mt: 1, lineHeight: 1.5 }}>
                    These titles label the 3 short videos in the member portal&apos;s &ldquo;Key principles&rdquo; reel. Match the principle each short covers.
                  </Typography>
                </Box>
              )}
              <TextField
                label="Summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One-paragraph blurb shown on the card."
                size="small"
                fullWidth
                multiline
                minRows={3}
                slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } } }}
                sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <TextField
                  label="Originating expert (optional)"
                  value={originatingExpertId}
                  onChange={(e) => setOriginatingExpertId(e.target.value)}
                  select
                  size="small"
                  fullWidth
                  helperText="Attributes the kit to an expert. Their portal will show it + inquiries route to them."
                  slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } }, formHelperText: { sx: { fontSize: "0.7rem", ml: 0.25 } } }}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {expertOptions.map((e) => (
                    <MenuItem key={e.id} value={e.id} sx={{ fontSize: "0.86rem" }}>{e.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Originating company (optional)"
                  value={originatingVendorId}
                  onChange={(e) => setOriginatingVendorId(e.target.value)}
                  select
                  size="small"
                  fullWidth
                  helperText="Attributes to a company. Same routing as the expert option."
                  slotProps={{ inputLabel: { sx: { fontSize: "0.84rem" } }, formHelperText: { sx: { fontSize: "0.7rem", ml: 0.25 } } }}
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.88rem", borderRadius: 1.25 } }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {vendorOptions.map((v) => (
                    <MenuItem key={v.id} value={v.id} sx={{ fontSize: "0.86rem" }}>{v.name}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </SectionCard>

          <Box sx={{ mt: 2.5 }}>
            <SectionCard
              title="Covers"
              subtitle="Two images per kit. Both optional, but a kit looks much better with them."
            >
              <Stack spacing={1.25}>
                {COVER_FIELDS.map((f) => (
                  <FilePicker
                    key={f.field}
                    field={f}
                    file={files[f.field] ?? null}
                    progress={progress[f.field] ?? null}
                    onChange={(file) => setFile(f.field, file)}
                  />
                ))}
              </Stack>
            </SectionCard>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SectionCard
              title="Content files"
              subtitle="Pick the files you have ready. Each one becomes a row in the kit's curriculum. At least one required."
            >
              <Stack spacing={1.25}>
                {activeContentFields.map((f) => (
                  <FilePicker
                    key={f.field}
                    field={f}
                    file={files[f.field] ?? null}
                    progress={progress[f.field] ?? null}
                    onChange={(file) => setFile(f.field, file)}
                  />
                ))}
              </Stack>
            </SectionCard>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SectionCard
              title="Additional resources"
              subtitle="Anything beyond the fixed slots. Add as many as you need, each with its own title and type."
            >
              <Stack spacing={1.25}>
                {extras.map((ex) => (
                  <Stack key={ex.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" }, border: "1px solid rgba(14,42,61,0.1)", borderRadius: 1.25, p: 1.25 }}>
                    <TextField
                      size="small"
                      label="Title"
                      value={ex.title}
                      onChange={(e) => updateExtra(ex.id, { title: e.target.value })}
                      sx={{ flex: 1.2, minWidth: 160 }}
                      placeholder="e.g. Expert Spotlight (Full)"
                    />
                    <TextField
                      select
                      size="small"
                      label="Type"
                      value={ex.kind}
                      onChange={(e) => updateExtra(ex.id, { kind: e.target.value })}
                      sx={{ flex: 1, minWidth: 170 }}
                    >
                      {EXTRA_KIND_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </TextField>
                    <Button
                      component="label"
                      size="small"
                      variant="outlined"
                      startIcon={ex.file ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : <CloudUploadOutlinedIcon sx={{ fontSize: 15 }} />}
                      sx={{ textTransform: "none", whiteSpace: "nowrap", borderColor: "rgba(14,42,61,0.2)", color: ex.file ? "#1F5C40" : "#0A1320", maxWidth: 220, overflow: "hidden" }}
                    >
                      {ex.file ? ex.file.name.slice(0, 22) + (ex.file.name.length > 22 ? "…" : "") : "Choose file"}
                      <input
                        hidden
                        type="file"
                        onChange={(e) => updateExtra(ex.id, { file: e.target.files?.[0] ?? null })}
                      />
                    </Button>
                    {typeof progress[`extra_${ex.id}`] === "number" && (progress[`extra_${ex.id}`] ?? 0) < 1 && (
                      <CircularProgress size={16} sx={{ color: "#A07823" }} />
                    )}
                    <IconButton size="small" onClick={() => removeExtra(ex.id)} aria-label="Remove resource">
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: "#8C1D1D" }} />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  onClick={addExtra}
                  startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: "none", alignSelf: "flex-start", color: "#A07823", fontWeight: 700 }}
                >
                  Add another resource
                </Button>
              </Stack>
            </SectionCard>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: { md: "sticky" }, top: { md: 80 } }}>
            <SectionCard title="Submit">
              <Stack spacing={1.5}>
                <SummaryRow label="Content files" value={`${contentFileCount} selected`} />
                <SummaryRow label="Covers" value={`${COVER_FIELDS.filter((c) => files[c.field]).length}/2 selected`} />
                <SummaryRow label="Total upload size" value={formatBytes(totalSize)} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={approveOnSubmit}
                      onChange={(e) => setApproveOnSubmit(e.target.checked)}
                      size="small"
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: "#A07823" },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#A07823" },
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#0A1320" }}>
                        Approve on submit
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: "#5C6770" }}>
                        Skip the review queue and publish to landing + member portal immediately.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", m: 0, gap: 1 }}
                />

                {contentFileCount === 0 && (
                  <FormHelperText sx={{ fontSize: "0.72rem", color: "#8C1D1D" }}>
                    Add at least one content file to enable Submit.
                  </FormHelperText>
                )}

                <Button
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  variant="contained"
                  size="medium"
                  disableElevation
                  startIcon={
                    submitting ? (
                      <CircularProgress size={14} sx={{ color: "inherit" }} />
                    ) : (
                      <CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />
                    )
                  }
                  sx={{
                    bgcolor: "#0A1320",
                    color: "#FFFFFF",
                    textTransform: "none",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    borderRadius: 0.75,
                    py: 1.1,
                    mt: 0.5,
                    "&:hover": { bgcolor: "#0E2A3D" },
                    "&.Mui-disabled": { bgcolor: "#9CA3AB", color: "#FFFFFF" },
                  }}
                >
                  {submitting
                    ? "Uploading…"
                    : approveOnSubmit
                      ? "Submit & publish"
                      : "Submit for review"}
                </Button>

                {progressLabel && (
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.25,
                      borderRadius: 0.75,
                      bgcolor: "rgba(217,168,75,0.08)",
                      border: "1px solid rgba(217,168,75,0.25)",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#7A5B17" }}>
                      {progressLabel}
                    </Typography>
                  </Box>
                )}

                <Typography sx={{ fontSize: "0.7rem", color: "#5C6770", lineHeight: 1.5 }}>
                  Files upload directly to Supabase Storage from your browser. Large videos can take a couple of minutes, so don&apos;t close the tab while it&apos;s working.
                </Typography>
              </Stack>
            </SectionCard>
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border: "1px solid #E0DACE",
        borderRadius: 1.5,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, borderBottom: "1px solid rgba(14,42,61,0.06)" }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1320" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: "0.76rem", color: "#5C6770", mt: 0.25 }}>{subtitle}</Typography>
        )}
      </Box>
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>{children}</Box>
    </Box>
  );
}

function FilePicker({
  field,
  file,
  progress,
  onChange,
}: {
  field: FileField;
  file: File | null;
  progress: number | null;
  onChange: (file: File | null) => void;
}) {
  const inputId = `file-${field.field}`;
  const uploading = progress !== null && progress < 1;
  const uploaded = progress === 1;
  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 1,
        border: "1px solid #E0DACE",
        bgcolor: uploaded
          ? "rgba(34,108,78,0.06)"
          : file
            ? "rgba(34,108,78,0.04)"
            : "rgba(14,42,61,0.02)",
        borderColor: uploaded
          ? "rgba(34,108,78,0.4)"
          : file
            ? "rgba(34,108,78,0.28)"
            : "rgba(14,42,61,0.08)",
        transition: "border-color 160ms ease, background-color 160ms ease",
        overflow: "hidden",
      }}
    >
      {/* Progress bar background — fills left-to-right while uploading */}
      {progress !== null && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, rgba(34,108,78,0.10) 0%, rgba(34,108,78,0.10) ${progress * 100}%, transparent ${progress * 100}%)`,
            pointerEvents: "none",
            transition: "background 200ms ease",
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#0A1320" }}>
          {field.label}
          {uploaded && (
            <Box component="span" sx={{ ml: 0.75, fontSize: "0.66rem", color: "#1F5C40", fontWeight: 700, letterSpacing: "0.08em" }}>
              · UPLOADED
            </Box>
          )}
          {uploading && (
            <Box component="span" sx={{ ml: 0.75, fontSize: "0.66rem", color: "#A07823", fontWeight: 700, letterSpacing: "0.08em" }}>
              · {Math.round((progress ?? 0) * 100)}%
            </Box>
          )}
        </Typography>
        <Typography sx={{ fontSize: "0.7rem", color: "#5C6770", lineHeight: 1.4 }}>
          {file ? `${file.name}, ${formatBytes(file.size)}` : field.description}
        </Typography>
      </Box>
      {file ? (
        <Button
          onClick={() => onChange(null)}
          size="small"
          variant="outlined"
          startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{
            borderColor: "rgba(140,29,29,0.3)",
            color: "#8C1D1D",
            textTransform: "none",
            fontSize: "0.74rem",
            fontWeight: 600,
            borderRadius: 0.75,
            px: 1.25,
            py: 0.35,
            "&:hover": { borderColor: "#8C1D1D", bgcolor: "rgba(140,29,29,0.04)" },
          }}
        >
          Remove
        </Button>
      ) : (
        <Button
          component="label"
          htmlFor={inputId}
          size="small"
          variant="outlined"
          sx={{
            borderColor: "rgba(14,42,61,0.18)",
            color: "#0A1320",
            textTransform: "none",
            fontSize: "0.74rem",
            fontWeight: 600,
            borderRadius: 0.75,
            px: 1.25,
            py: 0.35,
            "&:hover": { borderColor: "#A07823", bgcolor: "rgba(217,168,75,0.06)" },
          }}
        >
          Choose file
          <input
            id={inputId}
            type="file"
            hidden
            accept={field.accept}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </Button>
      )}
    </Box>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7A8590" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: "#0A1320" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const kb = b / 1024;
  if (kb < 900) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 900) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
