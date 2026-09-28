"use client";

import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { statusLabel, type ReviewStatus } from "@/lib/catalogData";

/**
 * Portal UI primitives (standard dashboard look).
 * Shared typography, cards, status chips and media thumbs so every portal
 * page renders with the same plain white-card-on-light-gray look.
 *
 * Tokens: canvas #F7F7F5, border #E5E7EB, ink #111827, muted #6B7280,
 * navy #0E2A3D (only accent). Cards are white, 1px border, 8px radius,
 * no shadow. Status chips are small 6px tints with dark text.
 */

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#E5E7EB";
const SOFT = "#F9FAFB";
const NAVY = "#0E2A3D";
const GOLD_BG = "#FBF3E1";
const GOLD_FG = "#7A5B17";

export const portalText = {
  pageTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: 1.3,
    color: INK,
    letterSpacing: 0,
  } as SxProps<Theme>,
  pageSubtitle: {
    fontSize: "0.875rem",
    color: MUTED,
    lineHeight: 1.55,
    maxWidth: 680,
  } as SxProps<Theme>,
  sectionTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: INK,
    lineHeight: 1.4,
    letterSpacing: 0,
  } as SxProps<Theme>,
  /** Small field label (13px, gray). No uppercase, no letter-spacing. */
  eyebrow: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    letterSpacing: 0,
    textTransform: "none",
    color: MUTED,
  } as SxProps<Theme>,
  body: {
    fontSize: "0.875rem",
    color: BODY,
    lineHeight: 1.6,
  } as SxProps<Theme>,
  meta: {
    fontSize: "0.8125rem",
    color: MUTED,
    lineHeight: 1.5,
  } as SxProps<Theme>,
  statValue: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: INK,
    lineHeight: 1.2,
    letterSpacing: 0,
  } as SxProps<Theme>,
};

/**
 * Page header used at the top of every portal page.
 * Title + one-line description on the left, optional right-aligned actions.
 * `eyebrow` is kept for API compatibility and rendered as a small gray
 * label above the title (no uppercase).
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, mb: 0.5 }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <Typography sx={{ ...portalText.eyebrow, display: "block", mb: 0.25 }}>{sentenceCase(eyebrow)}</Typography>
        )}
        <Typography component="h1" sx={portalText.pageTitle}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ ...portalText.pageSubtitle, mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1, justifyContent: { sm: "flex-end" }, pt: { sm: 0.25 } }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/** "CATALOG" -> "Catalog". Leaves mixed-case labels untouched. */
function sentenceCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Reusable white card with an optional title bar and action slot.
 * `accent` is accepted for API compatibility and no longer draws a rule.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  padding = "default",
  accent: _accent = false,
  sx,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padding?: "default" | "compact" | "none";
  accent?: boolean;
  sx?: SxProps<Theme>;
}) {
  void _accent;
  const padMap = {
    default: { p: 3 },
    compact: { px: 2, py: 1.75 },
    none: { p: 0 },
  } as const;
  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: "8px",
        overflow: "hidden",
        ...(sx ?? {}),
      }}
    >
      {(title || action) && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {title && <Typography sx={portalText.sectionTitle}>{title}</Typography>}
            {subtitle && <Typography sx={{ ...portalText.meta, mt: 0.25 }}>{subtitle}</Typography>}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
      )}
      <Box sx={padMap[padding]}>{children}</Box>
    </Box>
  );
}

/**
 * KPI tile. Small gray label + value, optional footer line and icon.
 * `accent` is accepted for API compatibility; the icon renders in gray.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  footer,
  accent: _accent,
}: {
  icon?: SvgIconComponent;
  label: string;
  value: string;
  footer?: React.ReactNode;
  accent?: "gold" | "navy" | "green" | "red" | "wine";
}) {
  void _accent;
  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: "8px",
        p: 3,
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={portalText.eyebrow}>{label}</Typography>
        {Icon && <Icon sx={{ fontSize: 18, color: FAINT, flexShrink: 0 }} />}
      </Stack>
      <Typography sx={portalText.statValue}>{value}</Typography>
      {footer && <Box sx={{ mt: 0.5, fontSize: "0.8125rem", color: MUTED, lineHeight: 1.5 }}>{footer}</Box>}
    </Box>
  );
}

const STATUS_TINT: Record<ReviewStatus, { bg: string; fg: string }> = {
  approved: { bg: "#DCFCE7", fg: "#166534" },
  pending_review: { bg: "#FEF3C7", fg: "#92400E" },
  needs_changes: { bg: "#FEF3C7", fg: "#92400E" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
  draft: { bg: "#F3F4F6", fg: "#374151" },
};

/**
 * Small status chip: 6px radius tint with dark text.
 */
export function StatusPill({ status, size = "md" }: { status: ReviewStatus; size?: "sm" | "md" }) {
  const palette = STATUS_TINT[status] ?? STATUS_TINT.draft;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: size === "sm" ? 0.75 : 1,
        height: size === "sm" ? 20 : 24,
        borderRadius: "6px",
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
        fontWeight: 500,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(status)}
    </Box>
  );
}

/**
 * Plain tag chip (non-status). Neutral gray by default; `gold` is reserved
 * for founding / verified markers. Other tones render neutral or navy.
 */
export function TagPill({
  label,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  tone?: "neutral" | "gold" | "navy" | "wine" | "green";
  size?: "sm" | "md";
}) {
  const palette =
    tone === "gold"
      ? { bg: GOLD_BG, fg: GOLD_FG }
      : tone === "navy"
        ? { bg: "rgba(14,42,61,0.08)", fg: NAVY }
        : tone === "green"
          ? { bg: "#DCFCE7", fg: "#166534" }
          : { bg: "#F3F4F6", fg: BODY };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: size === "sm" ? 0.75 : 1,
        height: size === "sm" ? 20 : 24,
        borderRadius: "6px",
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
        fontWeight: 500,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      {tagCase(label)}
    </Box>
  );
}

/** "FOUNDING" -> "Founding", "MONTH-TO-MONTH" -> "Month-to-month". Mixed case stays. */
function tagCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Image thumb with caption-on-hover.
 */
export function MediaThumb({
  src,
  caption,
  size = 64,
}: {
  src: string;
  caption?: string;
  size?: number;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "6px",
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        bgcolor: SOFT,
        "&:hover .media-caption": { opacity: 1 },
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption ?? ""}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {caption && (
        <Box
          className="media-caption"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "stretch",
            bgcolor: "rgba(17,24,39,0.6)",
            color: "#FFFFFF",
            fontSize: "0.6875rem",
            lineHeight: 1.3,
            p: 0.5,
            opacity: 0,
            transition: "opacity 150ms ease",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
            {caption}
          </span>
        </Box>
      )}
    </Box>
  );
}

/**
 * Video thumb with play overlay + duration label.
 */
export function VideoThumb({
  thumbnail,
  title,
  duration,
  size = 84,
}: {
  thumbnail: string;
  title: string;
  duration?: string;
  size?: number;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: Math.round(size * 0.66),
        flexShrink: 0,
        borderRadius: "6px",
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        bgcolor: INK,
      }}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt={title}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, display: "block" }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#FFFFFF",
        }}
      >
        <PlayArrowRoundedIcon sx={{ fontSize: 28 }} />
      </Box>
      {duration && (
        <Box
          sx={{
            position: "absolute",
            right: 4,
            bottom: 4,
            px: 0.6,
            py: "1px",
            borderRadius: "4px",
            bgcolor: "rgba(17,24,39,0.85)",
            color: "#FFFFFF",
            fontSize: "0.625rem",
            fontWeight: 600,
          }}
        >
          {duration}
        </Box>
      )}
    </Box>
  );
}

/**
 * Generic empty state shown when a list has no rows: a short sentence plus
 * one button, centred. `icon` is accepted for API compatibility and not drawn.
 */
export function EmptyState({
  icon: _icon,
  title,
  body,
  action,
}: {
  icon?: SvgIconComponent;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  void _icon;
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 6,
        px: 3,
        borderRadius: "8px",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
      }}
    >
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: INK, mb: 0.5 }}>{title}</Typography>
      {body && (
        <Typography sx={{ fontSize: "0.875rem", color: MUTED, maxWidth: 420, mx: "auto", mb: action ? 2.5 : 0 }}>
          {body}
        </Typography>
      )}
      {action}
    </Box>
  );
}
