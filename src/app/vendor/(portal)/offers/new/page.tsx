"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { REDEMPTION_LIMIT_OPTIONS } from "@/lib/catalogData";
import { PageHeader, SectionCard, TagPill } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  createOffer,
  fetchCurrentVendor,
  fetchVendorCatalog,
  type CatalogItemWithMedia,
} from "@/lib/supabase/vendorQueries";
import type { CatalogItemsRow, VendorsRow } from "@/lib/supabase/types";

const INK = CP.ink;
const MUTED = CP.muted;
const LINE = CP.border;
const NAVY = CP.navy;

type CatalogType = CatalogItemsRow["type"];

function TypeIcon({ type, size = 18 }: { type: CatalogType; size?: number }) {
  const Icon =
    type === "service"
      ? MedicalServicesOutlinedIcon
      : type === "product"
        ? Inventory2OutlinedIcon
        : SchoolOutlinedIcon;
  return <Icon sx={{ fontSize: size }} />;
}

type FormState = {
  catalogItemId: string;
  headline: string;
  discountValue: string;
  promoCode: string;
  terms: string;
  description: string;
  validFrom: string;
  validTo: string;
  redemptionLimit: string;
  customLimit: string;
  images: string[];
  videos: string[];
};

const empty: FormState = {
  catalogItemId: "",
  headline: "",
  discountValue: "",
  promoCode: "",
  terms: "",
  description: "",
  validFrom: "",
  validTo: "",
  redemptionLimit: "unlimited",
  customLimit: "",
  images: [],
  videos: [],
};

function OfferNewInner() {
  const params = useSearchParams();
  const router = useRouter();
  const preselect = params.get("catalog") ?? "";

  const [catalogItems, setCatalogItems] = useState<CatalogItemWithMedia[]>([]);
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [form, setForm] = useState<FormState>(() => ({ ...empty }));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      if (!v) {
        setLoadingCatalog(false);
        return;
      }
      setVendor(v);
      const data = await fetchVendorCatalog(supabase, v.id);
      if (!active) return;
      setCatalogItems(data);
      // Preselect if URL has one and it's a valid item.
      if (preselect && data.some((c) => c.id === preselect)) {
        setForm((prev) => ({ ...prev, catalogItemId: preselect }));
      }
      setLoadingCatalog(false);
    })();
    return () => {
      active = false;
    };
  }, [preselect]);

  const item = useMemo(
    () => (form.catalogItemId ? catalogItems.find((c) => c.id === form.catalogItemId) : undefined),
    [form.catalogItemId, catalogItems],
  );

  const canPublish = Boolean(vendor && vendor.status === "approved" && vendor.verified);

  const canSubmit =
    canPublish &&
    Boolean(form.catalogItemId) &&
    form.headline.trim().length >= 5 &&
    form.discountValue.trim().length > 0 &&
    form.terms.trim().length >= 10 &&
    form.description.trim().length >= 10 &&
    form.validFrom.length > 0 &&
    form.validTo.length > 0 &&
    (form.redemptionLimit !== "custom" || form.customLimit.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || !vendor) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createBrowserSupabase();
      const limit =
        form.redemptionLimit === "custom" ? form.customLimit.trim() : form.redemptionLimit;

      const result = await createOffer(supabase, {
        vendor_id: vendor.id,
        catalog_item_id: form.catalogItemId,
        headline: form.headline.trim(),
        discount_value: form.discountValue.trim(),
        promo_code: form.promoCode.trim() || null,
        description: form.description.trim(),
        terms: form.terms.trim(),
        valid_from: form.validFrom,
        valid_to: form.validTo,
        redemption_limit_per_member: limit,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => router.push("/vendor/offers"), 800);
    } catch (err) {
      console.error("[offers/new] submit failed:", err);
      setSubmitError("Could not save the offer. Please try again.");
      setSubmitting(false);
    }
  };

  void loadingCatalog;

  return (
    <Stack spacing={3} sx={{ maxWidth: 800 }}>
      <Box>
        <Button
          component={Link}
          href="/vendor/offers"
          variant="text"
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
          sx={{ px: 1, mb: 1, ml: -1 }}
        >
          Back to offers
        </Button>
        <PageHeader
          title="Create offer"
          subtitle="An offer is a discount or bonus attached to one of your catalog items. Pick the item, fill in the details, and submit for team review."
        />
      </Box>

      {!canPublish && (
        <Alert severity="warning" icon={<LockOutlinedIcon />}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", mb: 0.25 }}>
            Verification required
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.55 }}>
            Your company account is still being reviewed by our team. Once approved and verified
            you can publish offers. We&apos;ll email you the moment that happens, usually within
            one business day.
          </Typography>
        </Alert>
      )}

      {submitted ? (
        <Alert severity="success">
          <strong>Submitted for review.</strong> Redirecting you back to your offers...
        </Alert>
      ) : (
        <Stack spacing={3}>
          {/* Catalog item picker */}
          <SectionCard title="Attach to a catalog item" subtitle="Offers always sit on top of something you already list.">
            {catalogItems.length === 0 ? (
              <Alert
                severity="warning"
                action={
                  <Button component={Link} href="/vendor/catalog/new" size="small" variant="outlined">
                    Add item
                  </Button>
                }
              >
                You don&apos;t have any catalog items yet. Add a service, product, or
                course first.
              </Alert>
            ) : (
              <Stack spacing={1.25}>
                {catalogItems.map((c) => {
                  const active = form.catalogItemId === c.id;
                  return (
                    <Box
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => set("catalogItemId", c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          set("catalogItemId", c.id);
                        }
                      }}
                      sx={{
                        cursor: "pointer",
                        p: 1.75,
                        borderRadius: "12px",
                        border: "1px solid",
                        borderColor: active ? NAVY : LINE,
                        bgcolor: active ? CP.sand : CP.white,
                        boxShadow: active ? "0 0 0 3px rgba(10,19,32,0.06)" : "none",
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        transition: "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease",
                        "&:hover": { borderColor: active ? NAVY : CP.borderStrong, bgcolor: active ? CP.sand : CP.sandSoft },
                        "&:focus-visible": { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          display: "grid",
                          placeItems: "center",
                          bgcolor: active ? CP.white : CP.sand,
                          color: active ? NAVY : CP.goldDeep,
                          flexShrink: 0,
                        }}
                      >
                        <TypeIcon type={c.type} size={20} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.25 }}>
                          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK }}>{c.name}</Typography>
                          <TagPill label={c.type} tone="neutral" size="sm" />
                        </Stack>
                        <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>
                          {c.category} · {c.price_label}
                        </Typography>
                      </Box>
                      {active && (
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            bgcolor: NAVY,
                            color: CP.gold,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <CheckRoundedIcon sx={{ fontSize: 14 }} />
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </SectionCard>

          {/* Offer details */}
          {item && (
            <>
              <SectionCard title="Offer details" subtitle="What members see in the directory and at checkout.">
                <Stack spacing={2.5}>
                  <TextField
                    label="Offer headline"
                    required
                    fullWidth
                    value={form.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder='e.g. "12% off the LUX laser handpiece"'
                  />

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                    <TextField
                      label="Discount value"
                      required
                      fullWidth
                      value={form.discountValue}
                      onChange={(e) => set("discountValue", e.target.value)}
                      placeholder='e.g. "12% off", "$300 off", "Free training"'
                      helperText="Free-form so percentages, dollars, and bonuses all fit."
                    />
                    <TextField
                      label="Promo code"
                      fullWidth
                      value={form.promoCode}
                      onChange={(e) => set("promoCode", e.target.value.toUpperCase())}
                      placeholder="ASN-YOURS-12"
                      helperText="Optional. Members enter this at checkout or mention it on a call."
                      slotProps={{
                        input: {
                          sx: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
                        },
                      }}
                    />
                  </Stack>

                  <TextField
                    label="Description"
                    required
                    fullWidth
                    multiline
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Short pitch: what the member gets and why it matters. 1 to 2 sentences."
                    helperText={`${form.description.trim().length}/10 minimum characters`}
                  />

                  <TextField
                    label="Terms"
                    required
                    fullWidth
                    multiline
                    rows={4}
                    value={form.terms}
                    onChange={(e) => set("terms", e.target.value)}
                    placeholder='Eligibility, exclusions, stacking rules. e.g. "Excludes service contracts. Limit one per practice."'
                    helperText={`${form.terms.trim().length}/10 minimum characters`}
                  />
                </Stack>
              </SectionCard>

              <SectionCard title="Validity and redemption" subtitle="When the offer runs and how often each member can redeem.">
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                    <TextField
                      label="Offer valid from"
                      type="date"
                      required
                      fullWidth
                      value={form.validFrom}
                      onChange={(e) => set("validFrom", e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      label="Offer valid to"
                      type="date"
                      required
                      fullWidth
                      value={form.validTo}
                      onChange={(e) => set("validTo", e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                    <TextField
                      label="Redemption limit per member"
                      select
                      required
                      fullWidth
                      value={form.redemptionLimit}
                      onChange={(e) => set("redemptionLimit", e.target.value)}
                    >
                      {REDEMPTION_LIMIT_OPTIONS.map((o) => (
                        <MenuItem key={o} value={o}>
                          {o}
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom...</MenuItem>
                    </TextField>
                    {form.redemptionLimit === "custom" && (
                      <TextField
                        label="Custom limit"
                        required
                        fullWidth
                        value={form.customLimit}
                        onChange={(e) => set("customLimit", e.target.value)}
                        placeholder='e.g. "twice per year"'
                      />
                    )}
                  </Stack>
                </Stack>
              </SectionCard>

              <SectionCard title="Media" subtitle="Optional. Help members visualise the offer in the directory.">
                <Stack spacing={2}>
                  <MediaUploader
                    label="Images"
                    emptyHint="No images yet"
                    items={form.images}
                    onAdd={(name) => set("images", [...form.images, name])}
                    onRemove={(i) => set("images", form.images.filter((_, idx) => idx !== i))}
                    accept="image"
                  />
                  <MediaUploader
                    label="Videos"
                    emptyHint="No videos yet"
                    items={form.videos}
                    onAdd={(name) => set("videos", [...form.videos, name])}
                    onRemove={(i) => set("videos", form.videos.filter((_, idx) => idx !== i))}
                    accept="video"
                  />
                  <Alert severity="info">
                    Real upload to object storage is wired in the next phase. For now,
                    filenames are tracked locally so you can see the shape of the form.
                  </Alert>
                </Stack>
              </SectionCard>
            </>
          )}

          {submitError && <Alert severity="error">{submitError}</Alert>}

          {item && (
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
              <Button component={Link} href="/vendor/offers" variant="outlined">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={submit}
                disabled={!canSubmit || submitting}
                endIcon={
                  !canPublish ? (
                    <LockOutlinedIcon />
                  ) : submitting ? (
                    <CircularProgress size={16} sx={{ color: "inherit" }} />
                  ) : (
                    <ArrowForwardIcon />
                  )
                }
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

export default function VendorOfferNewPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      }
    >
      <OfferNewInner />
    </Suspense>
  );
}

function MediaUploader({
  label,
  emptyHint,
  items,
  onAdd,
  onRemove,
  accept,
}: {
  label: string;
  emptyHint: string;
  items: string[];
  onAdd: (name: string) => void;
  onRemove: (idx: number) => void;
  accept: "image" | "video";
}) {
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
        }}
      >
        {items.length === 0 ? (
          <Typography sx={{ color: MUTED, fontSize: "0.8125rem", mb: 1.5 }}>
            {emptyHint}
          </Typography>
        ) : (
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            {items.map((name, i) => (
              <Stack
                key={`${name}-${i}`}
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
                <TagPill label={accept === "image" ? "Image" : "Video"} tone="neutral" size="sm" />
                <Typography sx={{ flex: 1, fontSize: "0.875rem", color: INK }} noWrap>
                  {name}
                </Typography>
                <IconButton size="small" onClick={() => onRemove(i)}>
                  <DeleteOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}

        <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadOutlinedIcon />}>
          {`Add ${accept === "image" ? "an image" : "a video"}`}
          <input
            type="file"
            accept={accept === "image" ? "image/*" : "video/*"}
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              for (const f of files) onAdd(f.name);
              e.currentTarget.value = "";
            }}
          />
        </Button>
      </Box>
    </Box>
  );
}
