"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { COLORS } from "@/theme";

/**
 * JoinApplicationForm
 *
 * The public partner / expert application form. Same shape used on the
 * marketing pages (/experts, /partners) inline AND on the standalone
 * deep-link pages (/join/partner, /join/expert). Card capture happens
 * later inside the portal via TrialStartCard once the team approves —
 * this form is agreement + info only.
 *
 * Props keep the visual accent (gold for partner, green for expert),
 * the role-specific labels ("Company name" vs "Your topic or firm"),
 * and the target endpoint / thank-you page pluggable.
 */

const AGREEMENT_VERSION = "v1";

export type JoinRole = "partner" | "expert";

type Config = {
  accent: string;         // hex — bold text, checkbox, submit button
  accentDark: string;     // hex — submit button gradient dark stop
  accentTint: string;     // rgba tint — chip bg, bullet bg
  chipLabel: string;      // "✓ Partner" | "✓ Expert"
  focusFieldLabel: string; // "Company name" | "Your topic or firm"
  focusFieldPlaceholder?: string;
  focusFieldKey: "companyName" | "focusArea"; // maps to API body key
  agreementLinkHref: string;                   // /agreement/provider (one ASN Provider Agreement)
  appliedRedirect: string;                     // /vendor/applied or /expert/applied
  endpoint: string;                            // /api/join/{partner|expert}/apply
  bullets: string[];                            // "What you're agreeing to" list
};

const CONFIG_BY_ROLE: Record<JoinRole, Config> = {
  partner: {
    accent: "#A07823",
    accentDark: "#7A5B17",
    accentTint: "rgba(217,168,75,0.10)",
    chipLabel: "✓ Partner",
    focusFieldLabel: "Company name",
    focusFieldKey: "companyName",
    agreementLinkHref: "/agreement/provider",
    appliedRedirect: "/vendor/applied",
    endpoint: "/api/join/partner/apply",
    bullets: [
      "Cancel anytime, 30-day written notice",
      "Featured Partner listing free for 6 months once approved",
      "An exclusive offer for members, that you set",
    ],
  },
  expert: {
    accent: "#2C7A52",
    accentDark: "#1F5238",
    accentTint: "rgba(44,122,82,0.10)",
    chipLabel: "✓ Expert",
    focusFieldLabel: "Your topic or firm",
    focusFieldPlaceholder: "e.g. Injectables pricing · Acme Aesthetics Consulting",
    focusFieldKey: "focusArea",
    agreementLinkHref: "/agreements/asn-provider-agreement.pdf",
    appliedRedirect: "/expert/applied",
    endpoint: "/api/join/expert/apply",
    bullets: [
      "Cancel anytime, 30-day written notice",
      "Featured expert listing free for 6 months once approved",
      "Keep 70% of course revenue, ASN takes 30%",
    ],
  },
};

type FormState = {
  contactName: string;
  contactEmail: string;
  focus: string;   // company name OR focus area, keyed by config.focusFieldKey
  agreed: boolean;
};

export default function JoinApplicationForm({
  role,
  compact,
  initial,
  inviteCode,
  agreementHref,
}: {
  role: JoinRole;
  /** compact=true drops the eyebrow header — used when the form sits
   *  inside another marketing section that already has its own heading. */
  compact?: boolean;
  /** Prefill for personalized invite links (/invite/[code]). */
  initial?: { contactName?: string; contactEmail?: string; focus?: string };
  /** Invite-link code — posted with the application so the admin list
   *  shows the invite as accepted. */
  inviteCode?: string;
  /** Override for the "Read the full agreement" link (e.g. the invite's
   *  personalized agreement PDF). */
  agreementHref?: string;
}) {
  const config = CONFIG_BY_ROLE[role];
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    contactName: initial?.contactName ?? "",
    contactEmail: initial?.contactEmail ?? "",
    focus: initial?.focus ?? "",
    agreed: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.contactName.trim().length >= 2 &&
    /^[^@]+@[^@]+\.[^@]+$/.test(form.contactEmail) &&
    form.focus.trim().length >= 2 &&
    form.agreed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const email = form.contactEmail.trim().toLowerCase();
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          contactEmail: email,
          [config.focusFieldKey]: form.focus.trim(),
          agreementVersion: AGREEMENT_VERSION,
          ...(inviteCode ? { inviteCode } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "We couldn't submit your application. Try again.");
        setBusy(false);
        return;
      }
      router.push(`${config.appliedRedirect}?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setBusy(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 2.5,
        bgcolor: "#FFFFFF",
        border: `1px solid ${COLORS.line}`,
        maxWidth: 620,
        mx: "auto",
      }}
    >
      {!compact && (
        <>
          <Typography
            sx={{
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: config.accent,
              mb: 2,
            }}
          >
            You&apos;re joining as
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
            <Chip
              label={config.chipLabel}
              sx={{
                bgcolor: config.accentTint,
                color: config.accent,
                fontWeight: 700,
                fontSize: "0.8rem",
              }}
            />
          </Stack>
        </>
      )}

      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          label={role === "expert" ? "Your name" : "Contact name"}
          value={form.contactName}
          onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          required
          autoComplete="name"
        />
        <TextField
          label={config.focusFieldLabel}
          placeholder={config.focusFieldPlaceholder}
          value={form.focus}
          onChange={(e) => setForm((f) => ({ ...f, focus: e.target.value }))}
          required
          autoComplete="organization"
        />
        <TextField
          label="Contact email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
          required
          autoComplete="email"
        />
      </Stack>

      <Typography sx={{ fontSize: "0.82rem", color: COLORS.muted, mb: 1.25 }}>
        What you&apos;re agreeing to
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        {config.bullets.map((line) => (
          <Stack key={line} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: config.accentTint,
                color: config.accent,
                display: "grid",
                placeItems: "center",
                fontSize: "0.7rem",
                fontWeight: 800,
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              ✓
            </Box>
            <Typography sx={{ fontSize: "0.9rem", color: COLORS.ink, lineHeight: 1.5 }}>
              {line}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        component={Link}
        href={agreementHref ?? config.agreementLinkHref}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: "inline-block",
          color: config.accent,
          fontSize: "0.85rem",
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: 3,
          mb: 2.5,
        }}
      >
        Read the full agreement →
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            checked={form.agreed}
            onChange={(e) => setForm((f) => ({ ...f, agreed: e.target.checked }))}
            sx={{
              color: config.accent,
              "&.Mui-checked": { color: config.accent },
            }}
          />
        }
        label={
          <Typography sx={{ fontSize: "0.9rem", color: COLORS.ink }}>
            I agree to the{" "}
            <Box component="strong" sx={{ color: config.accent }}>
              ASN Provider Agreement, {role === "partner" ? "Partner" : "Expert"} terms ({AGREEMENT_VERSION})
            </Box>
            .
          </Typography>
        }
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={!canSubmit || busy}
        endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <ArrowForwardRoundedIcon />}
        sx={{
          mt: 3,
          borderRadius: 999,
          py: 1.25,
          bgcolor: config.accent,
          color: "#FFFFFF",
          backgroundImage: `linear-gradient(180deg, ${config.accent} 0%, ${config.accentDark} 100%)`,
          "&:hover": {
            backgroundImage: `linear-gradient(180deg, ${config.accent} 0%, ${config.accentDark} 100%)`,
          },
        }}
      >
        {busy ? "Submitting…" : "Submit application"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2, fontSize: "0.82rem" }}>
          {error}
        </Alert>
      )}

      <Typography sx={{ fontSize: "0.78rem", color: COLORS.muted, mt: 2, textAlign: "center" }}>
        No card required today · Team review within 2 business days · You&apos;ll add your
        card in the portal after we approve
      </Typography>
    </Box>
  );
}
