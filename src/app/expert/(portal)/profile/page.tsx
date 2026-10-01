"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EP } from "@/components/shared/TopNavPortalShell";
import { PageHeader, SectionCard, TagPill } from "@/components/vendor/PortalUI";

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const ESPRESSO = EP.espresso;
const ESPRESSO_HOVER = EP.espressoHover;
const BRONZE = EP.bronze;
const BRONZE_TINT = EP.bronzeTint;

type Profile = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  company_name: string | null;
  specialty: string;
  bio: string | null;
  topics: string | null;
  website: string | null;
  booking_link: string | null;
  headshot_url: string | null;
  status: string;
  activated_at: string | null;
};

type FormState = {
  display_name: string;
  phone: string;
  company_name: string;
  specialty: string;
  bio: string;
  topics: string;
  website: string;
  booking_link: string;
  headshot_url: string;
};

const EMPTY_FORM: FormState = {
  display_name: "",
  phone: "",
  company_name: "",
  specialty: "",
  bio: "",
  topics: "",
  website: "",
  booking_link: "",
  headshot_url: "",
};

function profileToForm(p: Profile): FormState {
  return {
    display_name: p.display_name ?? "",
    phone: p.phone ?? "",
    company_name: p.company_name ?? "",
    specialty: p.specialty ?? "",
    bio: p.bio ?? "",
    topics: p.topics ?? "",
    website: p.website ?? "",
    booking_link: p.booking_link ?? "",
    headshot_url: p.headshot_url ?? "",
  };
}

export default function ExpertProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expert/profile", { cache: "no-store" });
      const body = (await res.json()) as { expert?: Profile; error?: string };
      if (!res.ok || !body.expert) {
        setError(body.error ?? `Failed to load (${res.status})`);
        return;
      }
      setProfile(body.expert);
      setForm(profileToForm(body.expert));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    profile !== null &&
    Object.entries(form).some(([k, v]) => {
      const original = (profile as unknown as Record<string, string | null>)[k];
      return (original ?? "") !== v;
    });

  // Client-side guard that mirrors the API: every link must be an https URL
  // (blocks javascript:/data: and plain http), and free-text fields are capped.
  const validate = (): string | null => {
    const links: [string, string][] = [
      ["Website", form.website],
      ["Booking link", form.booking_link],
      ["Headshot URL", form.headshot_url],
    ];
    for (const [label, value] of links) {
      const v = value.trim();
      // Scheme optional: "www.site.com" is fine; the API stores it as https://.
      if (v && !/^(https?:\/\/)?(localhost|([a-z0-9-]+\.)+[a-z]{2,})(:\d+)?([/?#]\S*)?$/i.test(v)) {
        return `${label} must be a web address, e.g. www.site.com.`;
      }
    }
    if (form.bio.length > 2000) return "Bio must be 2000 characters or fewer.";
    if (form.specialty.length > 160) return "Specialty must be 160 characters or fewer.";
    return null;
  };

  const onSave = async () => {
    if (!dirty) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/expert/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; expert?: Profile };
      if (!res.ok || !body.ok) {
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setToast("Profile saved.");
      // Re-fetch to get the freshest snapshot including server-side trimming.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 12 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (!profile) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <Alert severity="error">{error ?? "Could not load your profile."}</Alert>
      </Stack>
    );
  }

  const displayInitials = (form.display_name || profile.full_name || "EX")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const topicList = form.topics
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Public profile"
        subtitle="Your bio, headshot, and links appear in the member directory and on every resource you publish. Keep it tight, specific, and human."
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Two columns: the editor on the left, the live preview pinned on the right */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 7fr) minmax(280px, 5fr)" },
          gap: 3,
          alignItems: "flex-start",
        }}
      >
      {/* Edit form */}
      <SectionCard title="Edit profile" subtitle="Changes show in the preview as you type.">
        <Stack spacing={3}>
          <FieldGroup title="Identity">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Display name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder={profile.full_name}
                helperText="Shown in the member directory. Defaults to your full name."
                fullWidth
              />
              <TextField
                label="Company / brand"
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="e.g. Glow Aesthetics Academy"
                fullWidth
              />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Phone (optional, never shown publicly)"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 010-1234"
                fullWidth
              />
              <HeadshotUploader
                value={form.headshot_url}
                onUploaded={(url) => {
                  setForm((f) => ({ ...f, headshot_url: url }));
                  setProfile((p) => (p ? { ...p, headshot_url: url } : p));
                  setToast("Headshot uploaded.");
                }}
                onError={(msg) => setToast(msg)}
              />
            </Box>
          </FieldGroup>

          <FieldGroup title="What you teach">
            <TextField
              label="Specialty (required)"
              value={form.specialty}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              placeholder="e.g. Injectables pricing & margins"
              required
              fullWidth
            />
            <TextField
              label="Bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="2 to 4 sentences. Who you serve, your unique angle, why aesthetic practice owners trust your work."
              multiline
              minRows={4}
              fullWidth
            />
            <TextField
              label="Topics you cover (one per line)"
              value={form.topics}
              onChange={(e) => setForm((f) => ({ ...f, topics: e.target.value }))}
              placeholder={"Consult conversion\nMed spa operations\nTeam & injector hiring"}
              multiline
              minRows={4}
              fullWidth
            />
          </FieldGroup>

          <FieldGroup title="Links">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Website"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://yourcoaching.com"
                fullWidth
              />
              <TextField
                label="Booking link"
                value={form.booking_link}
                onChange={(e) => setForm((f) => ({ ...f, booking_link: e.target.value }))}
                placeholder="https://cal.com/you/intro"
                helperText="Members tap this to book a meeting with you."
                fullWidth
              />
            </Box>
          </FieldGroup>

          <Stack
            direction={{ xs: "column-reverse", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "flex-end", pt: 1 }}
          >
            <Button
              variant="outlined"
              startIcon={<RestartAltOutlinedIcon />}
              onClick={() => setForm(profileToForm(profile))}
              disabled={!dirty || saving}
            >
              Reset changes
            </Button>
            <Button
              variant="contained"
              onClick={onSave}
              disabled={!dirty || saving}
              startIcon={
                saving ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <SaveOutlinedIcon />
              }
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      {/* Live preview: what members will see */}
      <Box sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
        <SectionCard title="Preview" subtitle="How members see you in the directory." padding="none">
          {/* Forest cap with the headshot overlapping its lower edge */}
          <Box
            sx={{
              height: 72,
              bgcolor: EP.espresso,
              backgroundImage: `linear-gradient(135deg, ${EP.espresso} 0%, ${EP.espressoDeep} 100%)`,
            }}
          />
          <Box sx={{ px: 3, pb: 3, mt: -5 }}>
            <Avatar
              src={form.headshot_url || undefined}
              sx={{
                width: 80,
                height: 80,
                bgcolor: BRONZE_TINT,
                color: BRONZE,
                fontSize: "1.5rem",
                fontWeight: 700,
                border: `4px solid ${CP.white}`,
                boxShadow: CP.shadow,
              }}
            >
              {displayInitials}
            </Avatar>
            <Typography sx={{ mt: 1.5, fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.02em", color: INK, lineHeight: 1.25 }}>
              {form.display_name || profile.full_name}
            </Typography>
            {form.company_name && (
              <Typography sx={{ fontSize: "0.8125rem", color: MUTED, mt: 0.25 }}>{form.company_name}</Typography>
            )}
            {form.specialty ? (
              <Typography sx={{ color: BRONZE, fontSize: "0.875rem", fontWeight: 600, mt: 0.75 }}>{form.specialty}</Typography>
            ) : (
              <Typography sx={{ color: CP.faint, fontSize: "0.875rem", mt: 0.75 }}>Your specialty shows here.</Typography>
            )}
            {form.bio ? (
              <Typography sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap", mt: 1.25 }}>
                {form.bio}
              </Typography>
            ) : (
              <Typography sx={{ color: CP.faint, fontSize: "0.875rem", lineHeight: 1.6, mt: 1.25 }}>
                Add 2 to 4 sentences so members know who you serve and why they should book you.
              </Typography>
            )}
            {topicList.length > 0 && (
              <Stack direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.75 }}>
                {topicList.map((t) => (
                  <TagPill key={t} label={t} tone="neutral" size="sm" />
                ))}
              </Stack>
            )}
            <Stack direction="row" sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
              {form.booking_link && <PreviewLink href={form.booking_link} label="Book a meeting" emphasized />}
              {form.website && <PreviewLink href={form.website} label="Website" />}
            </Stack>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
              Signed in as {profile.email}. Your email and phone are never shown to members.
            </Typography>
          </Box>
        </SectionCard>
      </Box>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: INK,
          mb: 1.5,
          pl: 1.5,
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 3,
            bottom: 3,
            width: 3,
            borderRadius: 999,
            bgcolor: BRONZE,
          },
        }}
      >
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

function PreviewLink({
  href,
  label,
  emphasized,
}: {
  href: string;
  label: string;
  emphasized?: boolean;
}) {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.5,
        height: 34,
        borderRadius: "10px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        textDecoration: "none",
        bgcolor: emphasized ? ESPRESSO : CP.white,
        color: emphasized ? EP.ivory : ESPRESSO,
        border: `1px solid ${ESPRESSO}`,
        transition: "background-color 140ms ease",
        "&:hover": {
          bgcolor: emphasized ? ESPRESSO_HOVER : BRONZE_TINT,
        },
      }}
    >
      {label}
      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
    </Box>
  );
}

/**
 * Headshot upload: picks a file from the expert's device and sends it to
 * PATCH /api/expert/profile/avatar with target=headshot (stored in the
 * avatars bucket, experts.headshot_url updated server-side). PNG, JPG,
 * WebP or GIF up to 5 MB.
 */
function HeadshotUploader({
  value,
  onUploaded,
  onError,
}: {
  value: string;
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onError("That image is over 5 MB. Please choose a smaller file.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("headshot", file);
      fd.append("target", "headshot");
      const res = await fetch("/api/expert/profile/avatar", { method: "PATCH", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string | null; error?: string };
      if (!res.ok || !body.url) {
        onError(body.error ?? "Upload failed. Please try again.");
        return;
      }
      onUploaded(body.url);
    } catch {
      onError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box>
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: EP.espresso, mb: 0.75 }}>Headshot</Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={value || undefined}
          variant="rounded"
          sx={{ width: 64, height: 64, borderRadius: "14px", bgcolor: EP.bronzeTint, color: EP.espresso, fontWeight: 700 }}
        >
          {busy ? <CircularProgress size={20} sx={{ color: EP.bronze }} /> : null}
        </Avatar>
        <Box>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudUploadOutlinedIcon />}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading..." : value ? "Replace headshot" : "Upload headshot"}
          </Button>
          <Typography sx={{ fontSize: "0.75rem", color: "#6B6157", mt: 0.75 }}>
            PNG, JPG or WebP, up to 5 MB. Square works best. Saved as soon as the upload finishes.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
