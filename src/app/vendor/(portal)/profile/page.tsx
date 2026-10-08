"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import { vendorCategories } from "@/lib/vendorData";
import { isOtherOption, resolveOtherOption, splitOtherOption } from "@/lib/content";
import { PageHeader, SectionCard, StatusPill, TagPill, portalText } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor, updateCurrentVendor } from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const LINE = CP.border;
const NAVY = CP.navy;

/** "www.site.com" is accepted and saved as https://www.site.com. */
function withScheme(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function VendorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categoryOther, setCategoryOther] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [calendarLink, setCalendarLink] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      if (v) {
        setVendor(v);
        setCompanyName(v.company_name ?? "");
        setDisplayName(v.display_name ?? "");
        setWebsite(v.website ?? "");
        const sp = splitOtherOption(v.category, vendorCategories);
        setCategory(sp.value);
        setCategoryOther(sp.other);
        setDescription(v.description ?? "");
        setContactName(v.contact_name ?? "");
        setContactEmail(v.contact_email ?? "");
        setContactPhone(v.contact_phone ?? "");
        setBillingEmail(v.billing_email ?? "");
        setCalendarLink(v.calendar_link ?? "");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file twice re-fires
    if (!file || !vendor) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image must be under 2MB.");
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);

    try {
      const supabase = createBrowserSupabase();
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${vendor.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("vendor-logos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (upErr) {
        setLogoError(upErr.message);
        setUploadingLogo(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("vendor-logos").getPublicUrl(path);

      const result = await updateCurrentVendor(supabase, { logo_url: publicUrl.publicUrl });
      if (!result.ok) {
        setLogoError(result.error ?? "Could not save logo URL.");
        setUploadingLogo(false);
        return;
      }

      // Refresh the row so the UI shows the new logo immediately.
      const v = await fetchCurrentVendor(supabase);
      setVendor(v);
    } catch (err) {
      console.error("[profile] logo upload failed:", err);
      setLogoError("Upload failed. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSave = async () => {
    if (!vendor) return;
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const result = await updateCurrentVendor(supabase, {
      company_name: companyName.trim(),
      display_name: displayName.trim() || companyName.trim(),
      website: withScheme(website),
      category: resolveOtherOption(category, categoryOther) || null,
      description: description.trim() || null,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim() || null,
      billing_email: billingEmail.trim() || null,
      calendar_link: withScheme(calendarLink),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save changes.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={{ color: MUTED, fontSize: "0.875rem" }}>Loading profile...</Typography>
      </Stack>
    );
  }

  if (!vendor) {
    return (
      <SectionCard padding="default">
        <Typography sx={portalText.sectionTitle}>No company profile found.</Typography>
      </SectionCard>
    );
  }

  const initials = (vendor.display_name ?? vendor.company_name ?? "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Company profile"
        subtitle="What members see in the directory. Edits go live immediately. Offer copy is managed separately on the Offers page."
        actions={
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={14} sx={{ color: "inherit" }} />
              ) : saved ? (
                <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
              ) : undefined
            }
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <Grid container spacing={3}>
        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <SectionCard padding="default">
              <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
                <Box sx={{ position: "relative" }}>
                  <Avatar
                    src={vendor.logo_url ?? undefined}
                    variant="rounded"
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: "20px",
                      bgcolor: NAVY,
                      color: CP.gold,
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      border: `1px solid ${LINE}`,
                      boxShadow: CP.shadow,
                    }}
                  >
                    {initials || "CO"}
                  </Avatar>
                  {vendor.verified && (
                    <Box
                      sx={{
                        position: "absolute",
                        right: -6,
                        bottom: -6,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        bgcolor: CP.white,
                        display: "grid",
                        placeItems: "center",
                        boxShadow: CP.shadow,
                      }}
                    >
                      <VerifiedRoundedIcon sx={{ fontSize: 18, color: CP.gold }} titleAccess="Verified company" />
                    </Box>
                  )}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "1.0625rem", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>
                    {displayName}
                  </Typography>
                  <Typography sx={portalText.meta}>{category}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", justifyContent: "center", gap: 0.5 }}>
                  {vendor.verified && <TagPill label="Verified company" tone="gold" size="sm" />}
                  <TagPill label={(vendor.plan_id ?? "FOUNDING").toUpperCase()} tone="neutral" size="sm" />
                </Stack>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  disabled={uploadingLogo}
                  startIcon={
                    uploadingLogo ? (
                      <CircularProgress size={12} sx={{ color: "inherit" }} />
                    ) : (
                      <CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />
                    )
                  }
                  sx={{ mt: 0.5 }}
                >
                  {uploadingLogo ? "Uploading..." : vendor.logo_url ? "Replace logo" : "Upload logo"}
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={onLogoChange}
                  />
                </Button>
                {logoError && (
                  <Typography sx={{ fontSize: "0.75rem", color: CP.errorFg, textAlign: "center", mt: 0.5 }}>
                    {logoError}
                  </Typography>
                )}
              </Stack>
            </SectionCard>

            <SectionCard title="Listing health" subtitle="A complete profile ranks higher in the directory." padding="default">
              <Stack spacing={1.25}>
                <HealthRow label="Logo" ok />
                <HealthRow label="Description" ok={description.length >= 60} />
                <HealthRow label="Website" ok={website.length > 0} />
                <HealthRow label="Calendar link" ok={calendarLink.length > 0} />
                <HealthRow label="Contact phone" ok={contactPhone.length > 0} />
              </Stack>
            </SectionCard>

            <SectionCard title="Review status" padding="default">
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <StatusPill
                    status={vendor.status === "approved" ? "approved" : vendor.status === "pending_review" ? "pending_review" : "draft"}
                    size="sm"
                  />
                  <Typography sx={portalText.body}>
                    {vendor.status === "approved" && vendor.verified
                      ? "Profile is live in the directory."
                      : vendor.status === "approved"
                        ? "Approved, verification pending."
                        : "Under team review."}
                  </Typography>
                </Stack>
                <Typography sx={portalText.meta}>
                  Material changes (name, category) trigger a team re-review. Cosmetic edits (description, contact) go live immediately.
                </Typography>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>

        {/* Form */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <SectionCard title="Company" subtitle="How your company appears in the directory." padding="default">
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Legal company name"
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="Acme Aesthetics Supply, Inc."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Display name (shown in directory)"
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Acme Aesthetics Supply"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Website"
                    value={website}
                    onChange={setWebsite}
                    placeholder="www.yourcompany.com"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Category"
                    value={category}
                    onChange={setCategory}
                    select
                  >
                    {vendorCategories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </FormField>
                </Grid>
                {isOtherOption(category) && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormField
                      label="Which category?"
                      value={categoryOther}
                      onChange={setCategoryOther}
                      placeholder="e.g. Medical waste disposal"
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <FormField
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    multiline
                    minRows={3}
                    placeholder="Short pitch members see in the directory."
                    helperText={`${description.length}/600`}
                  />
                </Grid>
              </Grid>
            </SectionCard>

            <SectionCard title="Contact" subtitle="Where members and our team reach you." padding="default">
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField label="Primary contact name" value={contactName} onChange={setContactName} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Contact email"
                    type="email"
                    value={contactEmail}
                    onChange={setContactEmail}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Contact phone"
                    type="tel"
                    value={contactPhone}
                    onChange={setContactPhone}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Calendar booking link"
                    value={calendarLink}
                    onChange={setCalendarLink}
                    placeholder="cal.com/your-handle/intro"
                    helperText="Members book intros from your profile."
                  />
                </Grid>
              </Grid>
            </SectionCard>

            <SectionCard title="Billing" subtitle="Used for invoices and receipts only. Not displayed publicly." padding="default">
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormField
                    label="Billing email"
                    type="email"
                    value={billingEmail}
                    onChange={setBillingEmail}
                  />
                </Grid>
              </Grid>
            </SectionCard>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Alert severity="info">
              Material edits (legal name, category change) re-trigger team review. Cosmetic edits (description, contact) go live instantly.
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function HealthRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: ok ? "#22C55E" : CP.gold }} />
        <Typography sx={{ fontSize: "0.875rem", color: BODY }}>{label}</Typography>
      </Stack>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 0.9,
          height: 22,
          borderRadius: "8px",
          bgcolor: ok ? CP.successBg : CP.warningBg,
          color: ok ? CP.successFg : CP.warningFg,
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: 0,
        }}
      >
        {ok ? "Complete" : "Add"}
      </Box>
    </Stack>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  multiline,
  minRows,
  select,
  type,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
  minRows?: number;
  select?: boolean;
  type?: string;
  children?: React.ReactNode;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      helperText={helperText}
      multiline={multiline}
      minRows={minRows}
      select={select}
      type={type}
      fullWidth
    >
      {children}
    </TextField>
  );
}
