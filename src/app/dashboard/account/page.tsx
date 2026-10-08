"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { useCurrentMember, type CurrentMember } from "@/lib/hooks/useCurrentMember";
import { memberRoles, isOtherOption, resolveOtherOption, splitOtherOption } from "@/lib/content";
import { BillingSection } from "@/components/member/BillingSection";
import {
  EditorialHeader,
  EditorialSection,
  InlineTag,
  editorialText,
  ink,
} from "@/components/member/Editorial";

// Same list as the signup form (canon section 4); never duplicate it here.
const PRACTICE_ROLES = memberRoles;
/** The saved role is free text when "Other" was chosen; split it for the dropdown. */
function roleParts(stored: string | null | undefined) {
  return splitOtherOption(stored, PRACTICE_ROLES);
}

function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "M";
}

function formatJoined(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function MemberProfilePage() {
  const { member, loading } = useCurrentMember();
  // Edits live in `draft`. The displayed `form` overlays the loaded member
  // with any local edits, so a fresh member fetch automatically populates
  // every untouched field without needing to sync via useEffect.
  const [draft, setDraft] = useState<Partial<CurrentMember>>({});
  const form: Partial<CurrentMember> = useMemo(
    () => ({ ...(member ?? {}), ...draft }),
    [member, draft],
  );
  const [roleOther, setRoleOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CurrentMember>(k: K, v: CurrentMember[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/member/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: (form.first_name ?? "").trim(),
          last_name: (form.last_name ?? "").trim(),
          credential: (form.credential ?? "").trim(),
          phone: (form.phone ?? "").trim(),
          practice_name: (form.practice_name ?? "").trim(),
          practice_role: resolveOtherOption(roleParts(form.practice_role).value, roleOther || roleParts(form.practice_role).other),
          city: (form.city ?? "").trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      setToast("Profile saved.");
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={22} sx={{ color: "var(--gold)" }} />
        <Typography sx={editorialText.meta}>Loading profile…</Typography>
      </Stack>
    );
  }

  if (!member) {
    return (
      <Box
        sx={{
          py: 6,
          textAlign: "center",
          borderTop: "1px solid var(--paper-rule)",
          borderBottom: "1px solid var(--paper-rule)",
        }}
      >
        <Typography sx={{ ...editorialText.heading, mb: 0.5 }}>No member profile found.</Typography>
        <Typography sx={editorialText.meta}>
          Your session may have expired. Sign in again from the member login page.
        </Typography>
      </Box>
    );
  }

  const memberSince = formatJoined(member.joined_at ?? member.activated_at);
  const isFounding = member.tier === "founding";
  const initialsStr = initials(form.first_name ?? member.first_name, form.last_name ?? member.last_name);
  const displayFirst = form.first_name ?? member.first_name ?? "";
  const displayLast = form.last_name ?? member.last_name ?? "";
  const displayCred = form.credential ?? member.credential ?? "";

  return (
    <Box sx={{ color: ink.primary }}>
      <EditorialHeader
        eyebrow="Account"
        title="Your profile"
        standfirst="What's on file for your membership. Edits go live immediately. Contact the team to update your sign-in email."
        actions={
          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={onSave}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={14} sx={{ color: "inherit" }} />
              ) : saved ? (
                <CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />
              ) : undefined
            }
            sx={{
              bgcolor: saved ? "var(--leaf)" : "var(--ink)",
              color: "var(--paper)",
              textTransform: "none",
              fontSize: "0.82rem",
              fontWeight: 600,
              borderRadius: 0.75,
              px: 1.75,
              py: 0.75,
              transition: "background-color var(--dur-fast) var(--ease-out)",
              "&:hover": {
                bgcolor: saved
                  ? "color-mix(in oklch, var(--leaf) 90%, black)"
                  : "color-mix(in oklch, var(--ink) 90%, white)",
              },
              "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
            }}
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ borderRadius: 1, fontSize: "0.82rem", py: 0.75, mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* SIDEBAR */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Identity card — no chrome, editorial composition */}
            <Box>
              <Stack spacing={1.25} sx={{ alignItems: "flex-start" }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: "color-mix(in oklch, var(--gold) 18%, transparent)",
                    color: "var(--gold-deep)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    border: "1px solid color-mix(in oklch, var(--gold) 40%, transparent)",
                  }}
                >
                  {initialsStr}
                </Avatar>
                <Box>
                  <Typography sx={{ ...editorialText.heading, mb: 0.25 }}>
                    {displayFirst} {displayLast}
                    {displayCred ? `, ${displayCred}` : ""}
                  </Typography>
                  <Typography sx={editorialText.meta}>{member.email}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <InlineTag label={isFounding ? "Founding" : "Member"} tone="gold" />
                  <InlineTag label={member.status} tone="ink" />
                </Stack>
              </Stack>
            </Box>

            {/* Quick membership summary in sidebar (full billing block lives
                in the main column). */}
            <Box sx={{ borderTop: "1px solid var(--ink-rule)", pt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1.25 }}>
                <Typography sx={editorialText.eyebrow}>Membership</Typography>
                <Box aria-hidden sx={{ flex: 1, height: "1px", bgcolor: "var(--paper-rule)" }} />
              </Stack>
              <Stack spacing={1}>
                <MetaRow label="Tier" value={isFounding ? "Founding member" : "Member"} />
                <MetaRow label="Joined" value={memberSince} />
                <MetaRow label="Account" value={member.status} capitalize />
              </Stack>
              {isFounding && (
                <Typography
                  sx={{
                    mt: 1.5,
                    fontSize: "0.74rem",
                    color: "var(--gold-deep)",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Your founding rate is locked for as long as your membership stays active. It never increases.
                </Typography>
              )}
            </Box>

            {/* Documents panel */}
            <Box sx={{ borderTop: "1px solid var(--paper-rule)", pt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1.25 }}>
                <Typography sx={editorialText.eyebrow}>Documents</Typography>
                <Box aria-hidden sx={{ flex: 1, height: "1px", bgcolor: "var(--paper-rule)" }} />
              </Stack>
              <Stack>
                <DocLink
                  href="/agreement/member"
                  icon={GavelOutlinedIcon}
                  label="Member agreement"
                  meta="What you signed at signup"
                />
                <DocLink
                  href="/legal/refund"
                  icon={RuleFolderOutlinedIcon}
                  label="Refund & cancellation"
                  meta="30-day money-back guarantee"
                />
                <DocLink
                  href="/legal/privacy"
                  icon={PolicyOutlinedIcon}
                  label="Privacy policy"
                  meta="What we do with your data"
                />
              </Stack>
            </Box>

            {/* Help panel */}
            <Box sx={{ borderTop: "1px solid var(--paper-rule)", pt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1.25 }}>
                <Typography sx={editorialText.eyebrow}>Support</Typography>
                <Box aria-hidden sx={{ flex: 1, height: "1px", bgcolor: "var(--paper-rule)" }} />
              </Stack>
              <Typography sx={{ ...editorialText.body, mb: 1 }}>
                Questions about your account or how the network works? Reach out, we read every email.
              </Typography>
              <Box
                component="a"
                href="mailto:members@aestheticsuccessnetwork.com"
                sx={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--gold-deep)",
                  textDecoration: "none",
                  borderBottom: "1px solid color-mix(in oklch, var(--gold) 40%, transparent)",
                  pb: "1px",
                  transition: "color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                  "&:hover": { color: "var(--ink)", borderBottomColor: "var(--ink)" },
                }}
              >
                members@aestheticsuccessnetwork.com →
              </Box>
            </Box>
          </Stack>
        </Grid>

        {/* MAIN — FORM */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3.5}>
            <EditorialSection
              eyebrow="Identity"
              standfirst="How you appear in member communications."
              rule
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <FormField
                    label="First name"
                    value={form.first_name ?? ""}
                    onChange={(v) => set("first_name", v)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <FormField
                    label="Last name"
                    value={form.last_name ?? ""}
                    onChange={(v) => set("last_name", v)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormField
                    label="Credential"
                    placeholder="DDS"
                    value={form.credential ?? ""}
                    onChange={(v) => set("credential", v)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormField
                    label="Email"
                    value={member.email}
                    onChange={() => {}}
                    disabled
                    helperText="Contact the team to change your sign-in email."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormField
                    label="Phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={form.phone ?? ""}
                    onChange={(v) => set("phone", v)}
                  />
                </Grid>
              </Grid>
            </EditorialSection>

            <EditorialSection
              eyebrow="Practice"
              standfirst="Used to tailor resource recommendations."
              rule={false}
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormField
                    label="Practice name"
                    value={form.practice_name ?? ""}
                    onChange={(v) => set("practice_name", v)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormField
                    label="Your role"
                    value={roleParts(form.practice_role).value}
                    onChange={(v) => {
                      set("practice_role", v);
                      if (!isOtherOption(v)) setRoleOther("");
                    }}
                    select
                  >
                    <MenuItem value="" sx={{ fontSize: "0.84rem" }}>
                      <em>Choose one</em>
                    </MenuItem>
                    {PRACTICE_ROLES.map((r) => (
                      <MenuItem key={r} value={r} sx={{ fontSize: "0.84rem" }}>
                        {r}
                      </MenuItem>
                    ))}
                  </FormField>
                </Grid>
                {isOtherOption(roleParts(form.practice_role).value) && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormField
                      label="Tell us your role"
                      value={roleOther || roleParts(form.practice_role).other}
                      onChange={(v) => setRoleOther(v)}
                      placeholder="e.g. Director of Operations"
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <FormField
                    label="City / state"
                    placeholder="Austin, TX"
                    value={form.city ?? ""}
                    onChange={(v) => set("city", v)}
                  />
                </Grid>
              </Grid>
            </EditorialSection>

            <Typography
              sx={{
                ...editorialText.meta,
                fontStyle: "italic",
                fontFamily: "var(--font-display)",
                borderTop: "1px solid var(--paper-rule)",
                pt: 1.5,
              }}
            >
              Changes save instantly when you hit Save changes. Email and tier are managed by the team. Reach out if you need either updated.
            </Typography>

            {/* Billing & subscription — current plan, payment method, invoices */}
            <Box sx={{ pt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1.5 }}>
                <Typography sx={editorialText.eyebrow}>Billing &amp; subscription</Typography>
                <Box aria-hidden sx={{ flex: 1, height: "1px", bgcolor: "var(--paper-rule)" }} />
              </Stack>
              <BillingSection member={member} />
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast}
        autoHideDuration={2400}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

function MetaRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "baseline",
        py: 0.5,
        borderBottom: "1px dotted var(--paper-rule)",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: ink.fade,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: ink.primary,
          textTransform: capitalize ? "capitalize" : "none",
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function DocLink({
  href,
  icon: Icon,
  label,
  meta,
}: {
  href: string;
  icon: SvgIconComponent;
  label: string;
  meta: string;
}) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        py: 1.25,
        borderTop: "1px solid var(--paper-rule)",
        textDecoration: "none",
        color: "inherit",
        transition: "background-color var(--dur-fast) var(--ease-out)",
        "&:first-of-type": { borderTop: "none", pt: 0 },
        "&:hover": { bgcolor: "color-mix(in oklch, var(--gold) 5%, transparent)" },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
      }}
    >
      <Icon sx={{ fontSize: 17, color: ink.soft, mt: 0.2, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: ink.primary, lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: ink.fade, mt: 0.15 }}>{meta}</Typography>
      </Box>
      <OpenInNewOutlinedIcon sx={{ fontSize: 13, color: ink.fade, mt: 0.4, flexShrink: 0 }} />
    </Box>
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
  disabled,
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
  disabled?: boolean;
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
      disabled={disabled}
      fullWidth
      size="small"
      variant="standard"
      slotProps={{
        inputLabel: { sx: { fontSize: "0.82rem", color: "var(--ink-fade)" } },
        formHelperText: { sx: { fontSize: "0.7rem", ml: 0, mt: 0.5, fontStyle: "italic" } },
      }}
      sx={{
        "& .MuiInput-root": { fontSize: "0.86rem" },
        "& .MuiInput-input": { py: 0.75 },
        "& .MuiInput-underline:before": { borderBottomColor: "var(--paper-rule)" },
        "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
          borderBottomColor: "var(--ink-rule)",
        },
        "& .MuiInput-underline:after": { borderBottomColor: "var(--gold)" },
      }}
    >
      {children}
    </TextField>
  );
}
