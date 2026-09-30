"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import { CATALOG_CATEGORIES, type CatalogItemType } from "@/lib/catalogData";
import { PageHeader, SectionCard } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  createCatalogItem,
  fetchCurrentVendor,
  uploadCatalogMedia,
} from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";

const INK = CP.ink;
const MUTED = CP.muted;
const LINE = CP.border;
const NAVY = CP.navy;

const TYPE_OPTIONS: { value: CatalogItemType; label: string; description: string; icon: SvgIconComponent }[] = [
  {
    value: "service",
    label: "Service",
    description: "Recurring or one-time work you deliver to a practice: consulting, marketing, financing, etc.",
    icon: MedicalServicesOutlinedIcon,
  },
  {
    value: "product",
    label: "Product",
    description: "Equipment, supplies, software, or anything physical or licensed you sell.",
    icon: Inventory2OutlinedIcon,
  },
  {
    value: "course",
    label: "Course",
    description: "Education with modules, video lessons, and optional CE credit.",
    icon: SchoolOutlinedIcon,
  },
];

type FormState = {
  type: CatalogItemType | "";
  name: string;
  category: string;
  /** Free text used when category === "Other". */
  categoryOther: string;
  description: string;
  priceLabel: string;
  durationHours: string;
  images: File[];
  videos: File[];
  documents: File[];
};

const empty: FormState = {
  type: "",
  name: "",
  category: "",
  categoryOther: "",
  description: "",
  priceLabel: "",
  durationHours: "",
  images: [],
  videos: [],
  documents: [],
};

export default function CatalogNewPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(true);
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      setVendor(v);
      setLoadingVendor(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const categoryOptions = useMemo(
    () => (form.type ? CATALOG_CATEGORIES[form.type] : []),
    [form.type],
  );

  const canPublish = Boolean(vendor && vendor.status === "approved" && vendor.verified);

  const effectiveCategory =
    form.category === "Other" ? form.categoryOther.trim() : form.category.trim();

  const canSubmit =
    canPublish &&
    Boolean(form.type) &&
    form.name.trim().length >= 3 &&
    effectiveCategory.length > 0 &&
    form.description.trim().length >= 20 &&
    form.priceLabel.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || !form.type || !vendor) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createBrowserSupabase();

      const durationHours = form.type === "course" && form.durationHours
        ? Number(form.durationHours)
        : null;

      const result = await createCatalogItem(supabase, {
        vendor_id: vendor.id,
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim(),
        category: effectiveCategory,
        price_label: form.priceLabel.trim(),
        duration_hours: durationHours,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }

      // Upload media (best effort, surface first error if any)
      const all: { kind: "image" | "video" | "document"; file: File }[] = [
        ...form.images.map((f) => ({ kind: "image" as const, file: f })),
        ...form.videos.map((f) => ({ kind: "video" as const, file: f })),
        ...form.documents.map((f) => ({ kind: "document" as const, file: f })),
      ];
      for (const m of all) {
        const up = await uploadCatalogMedia(supabase, {
          vendorId: vendor.id,
          catalogItemId: result.id,
          kind: m.kind,
          file: m.file,
        });
        if (!up.ok) {
          console.warn("[catalog/new] media upload failed:", up.error);
        }
      }

      setSubmitted(true);
      setTimeout(() => router.push("/vendor/catalog"), 800);
    } catch (err) {
      console.error("[catalog/new] submit failed:", err);
      setSubmitError("Could not save the item. Please try again.");
      setSubmitting(false);
    }
  };

  if (loadingVendor) {
    return (
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 840 }}>
      <Box>
        <Button
          component={Link}
          href="/vendor/catalog"
          variant="text"
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          sx={{ px: 1, ml: -1, mb: 1 }}
        >
          Back to catalog
        </Button>
        <PageHeader
          title="Add a catalog item"
          subtitle="Tell us what you want members to find in the directory. Our team reviews every submission within 24 business hours."
        />
      </Box>

      {!canPublish && (
        <Alert severity="warning" icon={<LockOutlinedIcon />}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", mb: 0.5 }}>
            Verification required
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.55 }}>
            Your company account is still being reviewed by our team. Once your account is approved
            and verified you can publish services, products, courses, and offers. We&apos;ll email
            you the moment that happens, usually within one business day.
          </Typography>
        </Alert>
      )}

      {submitted ? (
        <Alert severity="success">
          <strong>Submitted for review.</strong> Redirecting you back to your catalog...
        </Alert>
      ) : (
        <Stack spacing={3}>
          {/* Type picker */}
          <SectionCard title="What are you adding?" subtitle="This shapes the fields we ask for next.">
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.type === opt.value;
                return (
                  <Box
                    key={opt.value}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => {
                      if (!canPublish) return;
                      set("type", opt.value);
                      set("category", "");
                    }}
                    onKeyDown={(e) => {
                      if (!canPublish) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        set("type", opt.value);
                        set("category", "");
                      }
                    }}
                    sx={{
                      position: "relative",
                      cursor: canPublish ? "pointer" : "not-allowed",
                      opacity: canPublish ? 1 : 0.55,
                      p: 2.25,
                      borderRadius: "12px",
                      border: "1px solid",
                      borderColor: active ? NAVY : LINE,
                      bgcolor: active ? CP.sand : CP.white,
                      boxShadow: active ? "0 0 0 3px rgba(10,19,32,0.06)" : "none",
                      transition: "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                      "&:hover": canPublish
                        ? { borderColor: active ? NAVY : CP.borderStrong, bgcolor: active ? CP.sand : CP.sandSoft, transform: "translateY(-1px)" }
                        : {},
                      "&:focus-visible": {
                        outline: `2px solid ${NAVY}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {active && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          bgcolor: NAVY,
                          color: CP.gold,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <CheckRoundedIcon sx={{ fontSize: 13 }} />
                      </Box>
                    )}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        bgcolor: active ? CP.white : CP.sand,
                        color: active ? NAVY : CP.goldDeep,
                        display: "grid",
                        placeItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <Icon sx={{ fontSize: 20 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: INK, letterSpacing: "-0.01em", mb: 0.5 }}>
                      {opt.label}
                    </Typography>
                    <Typography sx={{ color: MUTED, fontSize: "0.8125rem", lineHeight: 1.5 }}>
                      {opt.description}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </SectionCard>

          {/* Basics */}
          {form.type && (
            <SectionCard title="Basics" subtitle="The essentials members see in the directory.">
              <Stack spacing={2.5}>
                <TextField
                  label="Name"
                  required
                  fullWidth
                  disabled={!canPublish}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={
                    form.type === "service"
                      ? "e.g. Med Spa Marketing Retainer"
                      : form.type === "product"
                        ? "e.g. LUX Laser Handpiece"
                        : "e.g. Injectables Pricing in 90 Days"
                  }
                />

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                    gap: 2.5,
                    alignItems: "start",
                  }}
                >
                  <Stack spacing={2}>
                    <TextField
                      label="Category"
                      required
                      select
                      fullWidth
                      disabled={!canPublish}
                      value={form.category}
                      onChange={(e) => {
                        set("category", e.target.value);
                        if (e.target.value !== "Other") set("categoryOther", "");
                      }}
                    >
                      {categoryOptions.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                    {form.category === "Other" && (
                      <TextField
                        label="Specify category"
                        required
                        fullWidth
                        autoFocus
                        disabled={!canPublish}
                        value={form.categoryOther}
                        onChange={(e) => set("categoryOther", e.target.value)}
                        placeholder="e.g. AI tooling, skincare retail, payroll"
                        helperText="Tell us how to label this in the directory."
                      />
                    )}
                  </Stack>
                  <TextField
                    label="Price"
                    required
                    fullWidth
                    disabled={!canPublish}
                    value={form.priceLabel}
                    onChange={(e) => set("priceLabel", e.target.value)}
                    placeholder='e.g. "$4,200", "Quote", "$149/mo"'
                    helperText="Free-form, any unit. Quotes and ranges are fine."
                  />
                </Box>

                {form.type === "course" && (
                  <TextField
                    label="Total duration (hours)"
                    type="number"
                    fullWidth
                    disabled={!canPublish}
                    value={form.durationHours}
                    onChange={(e) => set("durationHours", e.target.value)}
                    placeholder="e.g. 18"
                    helperText="Used to surface CE credit hours where relevant."
                    slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                  />
                )}

                <TextField
                  label="Description"
                  required
                  fullWidth
                  multiline
                  rows={4}
                  disabled={!canPublish}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What it is, what's included, who it's for. Aim for 2 to 3 sentences."
                  helperText={`${form.description.trim().length}/20 minimum characters`}
                />
              </Stack>
            </SectionCard>
          )}

          {/* Media */}
          {form.type && (
            <SectionCard
              title="Media and documents"
              subtitle={
                form.type === "course"
                  ? "Add 1 to 3 images, at least one preview video, and any course materials as PDFs."
                  : "Add 1 to 4 images. Optional product video. Attach spec sheets, brochures, or any supporting PDF."
              }
            >
              <Stack spacing={2.5}>
                <MediaUploader
                  label="Images"
                  emptyHint="No images yet"
                  items={form.images}
                  disabled={!canPublish}
                  onAdd={(files) => set("images", [...form.images, ...files])}
                  onRemove={(i) => set("images", form.images.filter((_, idx) => idx !== i))}
                  accept="image"
                />
                <MediaUploader
                  label={form.type === "course" ? "Videos" : "Video (optional)"}
                  emptyHint="No videos yet"
                  items={form.videos}
                  disabled={!canPublish}
                  onAdd={(files) => set("videos", [...form.videos, ...files])}
                  onRemove={(i) => set("videos", form.videos.filter((_, idx) => idx !== i))}
                  accept="video"
                />
                <MediaUploader
                  label="Documents (PDF, spec sheets, brochures)"
                  emptyHint="No documents yet"
                  items={form.documents}
                  disabled={!canPublish}
                  onAdd={(files) => set("documents", [...form.documents, ...files])}
                  onRemove={(i) => set("documents", form.documents.filter((_, idx) => idx !== i))}
                  accept="document"
                />
              </Stack>
            </SectionCard>
          )}

          {submitError && <Alert severity="error">{submitError}</Alert>}

          {form.type && (
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
              <Button component={Link} href="/vendor/catalog" variant="outlined">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={submit}
                disabled={!canSubmit || submitting}
                endIcon={!canPublish ? <LockOutlinedIcon sx={{ fontSize: 18 }} /> : <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              >
                {!canPublish
                  ? "Verification required"
                  : submitting
                    ? "Submitting..."
                    : "Submit for team review"}
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function MediaUploader({
  label,
  emptyHint,
  items,
  onAdd,
  onRemove,
  accept,
  disabled,
}: {
  label: string;
  emptyHint: string;
  items: File[];
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
  accept: "image" | "video" | "document";
  disabled?: boolean;
}) {
  const acceptAttr =
    accept === "image"
      ? "image/*"
      : accept === "video"
        ? "video/*"
        : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const chipLabel = accept === "image" ? "Image" : accept === "video" ? "Video" : "Doc";
  const ctaLabel =
    accept === "image" ? "Add an image" : accept === "video" ? "Add a video" : "Add a document";

  return (
    <Box>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, mb: 1, color: CP.body }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: `1px dashed ${CP.borderStrong}`,
          borderRadius: "12px",
          p: 2,
          bgcolor: CP.sandSoft,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {items.length === 0 ? (
          <Typography sx={{ color: MUTED, fontSize: "0.8125rem", mb: 1.5 }}>
            {emptyHint}
          </Typography>
        ) : (
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            {items.map((f, i) => (
              <Stack
                key={`${f.name}-${i}`}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  bgcolor: CP.white,
                  border: `1px solid ${LINE}`,
                  borderRadius: "10px",
                  px: 1.25,
                  py: 0.75,
                }}
              >
                <Chip label={chipLabel} size="small" />
                <Typography sx={{ flex: 1, fontSize: "0.875rem", color: INK }} noWrap>
                  {f.name}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
                  {Math.max(1, Math.round(f.size / 1024))} KB
                </Typography>
                <IconButton size="small" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}>
                  <DeleteOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <Button
          component="label"
          variant="outlined"
          size="small"
          disabled={disabled}
          startIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />}
        >
          {ctaLabel}
          <input
            type="file"
            accept={acceptAttr}
            multiple
            hidden
            disabled={disabled}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAdd(files);
              e.currentTarget.value = "";
            }}
          />
        </Button>
      </Box>
    </Box>
  );
}
