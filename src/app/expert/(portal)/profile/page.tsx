"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { PageHeader, SectionCard } from "@/components/vendor/PortalUI";

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const NAVY = "#0E2A3D";
const NAVY_TINT = "rgba(14,42,61,0.08)";

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
      if (v && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v)) {
        return `${label} must be a full https:// address.`;
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

  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <PageHeader
        title="Public profile"
        subtitle="Your bio, headshot, and links appear in the member directory and on every resource you publish. Keep it tight, specific, and human."
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Preview card: what members will see */}
      <SectionCard title="Preview" subtitle="How members see you in the directory.">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{ alignItems: { sm: "flex-start" } }}
        >
          <Avatar
            src={form.headshot_url || undefined}
            sx={{
              width: 80,
              height: 80,
              bgcolor: NAVY_TINT,
              color: NAVY,
              fontSize: "1.5rem",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {displayInitials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}>
              {form.display_name || profile.full_name}
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: MUTED, mb: 1 }}>{profile.email}</Typography>
            {form.specialty && (
              <Typography sx={{ color: BODY, fontSize: "0.875rem", mb: 1 }}>
                {form.specialty}
              </Typography>
            )}
            {form.bio && (
              <Typography
                sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
              >
                {form.bio}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
              {form.website && (
                <PreviewLink href={form.website} label="Website" />
              )}
              {form.booking_link && (
                <PreviewLink href={form.booking_link} label="Book a meeting" emphasized />
              )}
            </Stack>
          </Box>
        </Stack>
      </SectionCard>

      {/* Edit form */}
      <SectionCard title="Edit profile">
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
              <TextField
                label="Headshot URL"
                value={form.headshot_url}
                onChange={(e) => setForm((f) => ({ ...f, headshot_url: e.target.value }))}
                placeholder="https://..."
                helperText="Paste a public image URL. Direct upload comes later."
                fullWidth
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
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

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
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, mb: 1.5 }}>
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
        height: 32,
        borderRadius: "6px",
        fontSize: "0.8125rem",
        fontWeight: 500,
        textDecoration: "none",
        bgcolor: emphasized ? NAVY : "#FFFFFF",
        color: emphasized ? "#FFFFFF" : INK,
        border: emphasized ? `1px solid ${NAVY}` : "1px solid #D1D5DB",
        "&:hover": {
          bgcolor: emphasized ? "#0B2232" : "#F9FAFB",
        },
      }}
    >
      {label}
      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
    </Box>
  );
}
