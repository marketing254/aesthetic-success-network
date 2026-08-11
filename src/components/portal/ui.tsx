"use client";

import Link from "next/link";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

/**
 * Small presentational kit shared by all three portals, so a status chip
 * or an empty state looks identical whether you're a member, an expert,
 * or a partner. Everything here is styling only — no data access.
 */

// ── Status vocabulary ───────────────────────────────────────────────
// One map for every status string used across hotline requests, deals
// and kits. Unknown values fall through to a neutral grey chip.
const STATUS_STYLES: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  // hotline_requests
  submitted: { label: "Submitted", fg: "#7A5C10", bg: "rgba(217,168,75,0.16)", border: "rgba(217,168,75,0.4)" },
  assigned: { label: "With an expert", fg: "#1F4E79", bg: "rgba(31,78,121,0.12)", border: "rgba(31,78,121,0.3)" },
  answered: { label: "Answered", fg: "#1D6B3F", bg: "rgba(29,107,63,0.12)", border: "rgba(29,107,63,0.3)" },
  closed: { label: "Closed", fg: "#5C6673", bg: "rgba(92,102,115,0.1)", border: "rgba(92,102,115,0.25)" },
  // deals + kits
  draft: { label: "Draft", fg: "#5C6673", bg: "rgba(92,102,115,0.1)", border: "rgba(92,102,115,0.25)" },
  pending_review: { label: "In review", fg: "#7A5C10", bg: "rgba(217,168,75,0.16)", border: "rgba(217,168,75,0.4)" },
  published: { label: "Published", fg: "#1D6B3F", bg: "rgba(29,107,63,0.12)", border: "rgba(29,107,63,0.3)" },
  archived: { label: "Archived", fg: "#5C6673", bg: "rgba(92,102,115,0.1)", border: "rgba(92,102,115,0.25)" },
  // urgency
  urgent: { label: "Urgent", fg: "#8C1D1D", bg: "rgba(220,60,60,0.12)", border: "rgba(220,60,60,0.3)" },
  standard: { label: "Standard", fg: "#5C6673", bg: "rgba(92,102,115,0.1)", border: "rgba(92,102,115,0.25)" },
};

export function StatusChip({ status, size = "small" }: { status: string; size?: "small" | "medium" }) {
  const s = STATUS_STYLES[status] ?? {
    label: status,
    fg: "#5C6673",
    bg: "rgba(92,102,115,0.1)",
    border: "rgba(92,102,115,0.25)",
  };
  return (
    <Chip
      label={s.label}
      size={size}
      sx={{
        color: s.fg,
        bgcolor: s.bg,
        border: `1px solid ${s.border}`,
        fontWeight: 700,
        fontSize: "0.7rem",
        letterSpacing: "0.02em",
      }}
    />
  );
}

// ── Page header ─────────────────────────────────────────────────────
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ mb: 3.5, alignItems: { sm: "flex-end" }, justifyContent: "space-between" }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" sx={{ color: "#A87D2C", display: "block", fontWeight: 700 }}>
          {eyebrow}
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, fontSize: { xs: "1.75rem", md: "2.35rem" } }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ mt: 1, maxWidth: 620 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

// ── Cards ───────────────────────────────────────────────────────────
export function SectionCard({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: "20px", overflow: "hidden" }}>
      {title && (
        <Stack
          direction="row"
          sx={{
            px: 3,
            py: 2,
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(247,245,240,0.6)",
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</Typography>
          {action}
        </Stack>
      )}
      <Box sx={padded ? { p: 3 } : undefined}>{children}</Box>
    </Paper>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: "20px",
        p: 2.5,
        height: "100%",
        transition: "border-color .2s, transform .2s",
        ...(href && {
          "&:hover": { borderColor: "rgba(217,168,75,0.6)", transform: "translateY(-2px)" },
        }),
      }}
    >
      <Typography
        sx={{
          fontSize: "0.68rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "2.1rem",
          lineHeight: 1.1,
          mt: 0.75,
          color: "text.primary",
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="body2" sx={{ fontSize: "0.78rem", mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );

  if (!href) return inner;
  return (
    <Box component={Link} href={href} sx={{ textDecoration: "none", display: "block", height: "100%" }}>
      {inner}
    </Box>
  );
}

// ── Empty state ─────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", py: 6, px: 3 }}>
      <Box
        aria-hidden
        sx={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          bgcolor: "rgba(217,168,75,0.14)",
          border: "1px solid rgba(217,168,75,0.32)",
        }}
      />
      <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>{title}</Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {actionLabel && actionHref && (
        <Button component={Link} href={actionHref} variant="contained" sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}

// ── Migration notice ────────────────────────────────────────────────
// Portal tables arrive in 0008. Until it's run, every portal read fails —
// show the fix rather than a stack trace (same shape as the admin pages).
export function MigrationNotice({ detail }: { detail: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 3, borderRadius: "20px", borderColor: "error.light", bgcolor: "rgba(220,60,60,0.04)" }}
    >
      <Typography sx={{ color: "error.main", fontWeight: 600, mb: 1 }}>
        The portal tables aren&apos;t available yet.
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Run <code>supabase/migrations/0008_portals.sql</code> in the Supabase SQL editor, then
        refresh. Detail: {detail}
      </Typography>
    </Paper>
  );
}

// ── Formatting ──────────────────────────────────────────────────────
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** Renders plain-text blocks (action plans, kit bodies) with paragraph breaks. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <Stack spacing={1.5}>
      {blocks.map((block, i) => (
        <Typography key={i} variant="body1" sx={{ whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
          {block}
        </Typography>
      ))}
    </Stack>
  );
}
