"use client";

import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { statusLabel, type ReviewStatus } from "@/lib/catalogData";
import { CP, cardSxFor, useCommunityVariant, usePortalPageTitle } from "@/components/shared/CommunityPortalShell";

/**
 * Portal UI primitives (community-platform look).
 * Shared typography, cards, stat tiles, status chips, media thumbs, list
 * rows and empty states so every portal page renders with the same warm,
 * confident language: white 16px cards with a soft layered shadow on an
 * off-white canvas, navy ink, gold highlights, sand tints.
 *
 * Tokens come from CommunityPortalShell (CP). Exports and props are stable
 * so pages that predate this look keep compiling.
 */

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const LINE = CP.border;
const NAVY = CP.navy;

export const portalText = {
  pageTitle: {
    fontSize: "1.375rem",
    fontWeight: 700,
    lineHeight: 1.25,
    color: INK,
    letterSpacing: "-0.02em",
  } as SxProps<Theme>,
  pageSubtitle: {
    fontSize: "0.9375rem",
    color: MUTED,
    lineHeight: 1.55,
    maxWidth: 720,
  } as SxProps<Theme>,
  sectionTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: NAVY,
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
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
    fontSize: "1.75rem",
    fontWeight: 700,
    color: INK,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
  } as SxProps<Theme>,
};

/** Table-ish header row above a list inside a `SectionCard padding="none"`. */
export const listHeadSx: SxProps<Theme> = {
  px: 3,
  py: 1.25,
  borderBottom: `1px solid ${LINE}`,
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "rgba(10,19,32,0.6)",
  letterSpacing: 0,
  textTransform: "none",
};

/** 56px list row with a sand hover tint. Pair with `Stack divider`. */
export const listRowSx: SxProps<Theme> = {
  minHeight: 56,
  px: 3,
  py: 1.5,
  alignItems: "center",
  transition: "background-color 120ms ease",
  "&:hover": { bgcolor: CP.sandSoft },
};

/** Divider element for `Stack divider={<ListDivider />}`. */
export function ListDivider() {
  return <Box sx={{ borderTop: `1px solid ${LINE}` }} />;
}

/**
 * Page header used at the top of every portal page.
 * Inside a CommunityPortalShell the title moves into the transparent top
 * bar, so this renders only the description and actions. Outside a shell
 * (older portals) it renders the title inline as before.
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
  const inShell = usePortalPageTitle(title);
  const hasLeft = !inShell || !!subtitle;
  if (inShell && !subtitle && !actions) return null;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { sm: inShell ? "center" : "flex-start" }, mb: 0.5 }}
    >
      {hasLeft ? (
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {!inShell && eyebrow && (
            <Typography sx={{ ...portalText.eyebrow, display: "block", mb: 0.25 }}>{sentenceCase(eyebrow)}</Typography>
          )}
          {!inShell && (
            <Typography component="h1" sx={portalText.pageTitle}>
              {title}
            </Typography>
          )}
          {subtitle && <Typography sx={{ ...portalText.pageSubtitle, mt: inShell ? 0 : 0.5 }}>{subtitle}</Typography>}
        </Box>
      ) : (
        <Box sx={{ flex: 1 }} />
      )}
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1, justifyContent: { sm: "flex-end" } }}
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
 * Reusable white card (16px radius, soft layered shadow) with an optional
 * title bar and action slot. `accent` draws a sand-tinted panel instead of
 * plain white (highlighted panels, e.g. the founding waiver).
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  padding = "default",
  accent = false,
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
  const padMap = {
    default: { p: 3 },
    compact: { px: 2.5, py: 2 },
    none: { p: 0 },
  } as const;
  // The expert variant marks section titles with a short accent rule on
  // the left; the company variant (default) renders the plain title.
  const v = useCommunityVariant();
  const titleSx = v.sectionRule
    ? {
        ...(portalText.sectionTitle as object),
        position: "relative" as const,
        pl: 1.5,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 3,
          bottom: 3,
          width: 3,
          borderRadius: 999,
          bgcolor: v.link,
        },
      }
    : portalText.sectionTitle;
  return (
    <Box
      sx={{
        ...(cardSxFor(v) as object),
        ...(accent ? { bgcolor: CP.sand, borderColor: "rgba(217,168,75,0.35)" } : {}),
        overflow: "hidden",
        ...((sx as object) ?? {}),
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
            pt: 2.5,
            pb: padding === "none" ? 2 : 0,
            borderBottom: padding === "none" ? `1px solid ${accent ? "rgba(217,168,75,0.3)" : LINE}` : 0,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {title && <Typography sx={titleSx}>{title}</Typography>}
            {subtitle && <Typography sx={{ ...portalText.meta, mt: 0.25, pl: v.sectionRule ? 1.5 : 0 }}>{subtitle}</Typography>}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
      )}
      <Box sx={{ ...padMap[padding], ...(title && padding !== "none" ? { pt: 2 } : {}) }}>{children}</Box>
    </Box>
  );
}

const STAT_TONES = {
  gold: { bg: CP.goldTint, fg: CP.goldText },
  navy: { bg: "rgba(10,19,32,0.08)", fg: CP.navy },
  green: { bg: CP.successBg, fg: CP.successFg },
  red: { bg: CP.errorBg, fg: CP.errorFg },
  wine: { bg: "#FCE7F3", fg: "#9D174D" },
} as const;

/**
 * KPI tile. Icon in a tinted circle, small gray label, large value and an
 * optional footer line. `accent` picks the icon tint; when omitted the
 * portal variant decides (navy in the company portal, green in the
 * expert portal).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  footer,
  accent,
}: {
  icon?: SvgIconComponent;
  label: string;
  value: string;
  footer?: React.ReactNode;
  accent?: "gold" | "navy" | "green" | "red" | "wine";
}) {
  const v = useCommunityVariant();
  const tone = accent ? STAT_TONES[accent] ?? STAT_TONES.navy : { bg: v.statIconBg, fg: v.statIconFg };
  return (
    <Box
      sx={{
        ...(cardSxFor(v) as object),
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        transition: "box-shadow 140ms ease, transform 140ms ease",
        "&:hover": { boxShadow: CP.shadowHover },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ ...portalText.eyebrow, fontWeight: 500 }}>{label}</Typography>
        {Icon && (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: tone.bg,
              color: tone.fg,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
        )}
      </Stack>
      <Box>
        <Typography sx={{ ...(portalText.statValue as object), color: v.statValue }}>{value || "0"}</Typography>
        {footer && <Box sx={{ mt: 0.75, fontSize: "0.8125rem", color: MUTED, lineHeight: 1.5 }}>{footer}</Box>}
      </Box>
    </Box>
  );
}

const STATUS_TINT: Record<ReviewStatus, { bg: string; fg: string; dot: string }> = {
  approved: { bg: CP.successBg, fg: CP.successFg, dot: "#22C55E" },
  pending_review: { bg: CP.warningBg, fg: CP.warningFg, dot: "#F59E0B" },
  needs_changes: { bg: CP.warningBg, fg: CP.warningFg, dot: "#F59E0B" },
  rejected: { bg: CP.errorBg, fg: CP.errorFg, dot: "#EF4444" },
  draft: { bg: CP.neutralBg, fg: CP.neutralFg, dot: CP.faint },
};

/**
 * Status chip: 8px radius tint with a small dot and dark text.
 */
export function StatusPill({ status, size = "md" }: { status: ReviewStatus; size?: "sm" | "md" }) {
  const palette = STATUS_TINT[status] ?? STATUS_TINT.draft;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        px: size === "sm" ? 0.9 : 1.1,
        height: size === "sm" ? 22 : 26,
        borderRadius: `${CP.radiusChip}px`,
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
        fontWeight: 600,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: palette.dot, flexShrink: 0 }} />
      {statusLabel(status)}
    </Box>
  );
}

/**
 * Plain tag chip (non-status). Neutral by default; `gold` for founding and
 * verified markers, `navy` for the current step, `green` for good news.
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
      ? { bg: CP.goldTint, fg: CP.goldText }
      : tone === "navy"
        ? { bg: CP.navyTint, fg: NAVY }
        : tone === "green"
          ? { bg: CP.successBg, fg: CP.successFg }
          : tone === "wine"
            ? { bg: "#FCE7F3", fg: "#9D174D" }
            : { bg: CP.neutralBg, fg: CP.neutralFg };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: size === "sm" ? 0.9 : 1.1,
        height: size === "sm" ? 22 : 26,
        borderRadius: `${CP.radiusChip}px`,
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
        fontWeight: 600,
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
 * Segmented filter: rounded pills on a light track, each with an optional
 * count. Replaces underline tabs for list filters.
 */
export function SegmentedFilter<K extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Filter",
}: {
  value: K;
  onChange: (next: K) => void;
  options: { key: K; label: string; count?: number }[];
  ariaLabel?: string;
}) {
  const v = useCommunityVariant();
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        p: 0.5,
        borderRadius: 999,
        bgcolor: v.sectionRule ? v.accentTint : CP.neutralBg,
        maxWidth: "100%",
        overflowX: "auto",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Box
            key={o.key}
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              height: 32,
              px: 1.5,
              borderRadius: 999,
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.8125rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              color: active ? (v.sectionRule ? "#FFFFFF" : INK) : (v.sectionRule ? v.accent : MUTED),
              bgcolor: active ? (v.sectionRule ? v.accent : CP.white) : "transparent",
              boxShadow: active ? "0 1px 2px rgba(10,19,32,0.08)" : "none",
              transition: "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
              "&:hover": { color: active && v.sectionRule ? "#FFFFFF" : INK },
              "&:focus-visible": { outline: `2px solid ${v.link}`, outlineOffset: 2 },
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <Box
                component="span"
                sx={{
                  minWidth: 20,
                  height: 20,
                  px: 0.6,
                  borderRadius: 999,
                  display: "inline-grid",
                  placeItems: "center",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  bgcolor: active ? (v.sectionRule ? "rgba(255,255,255,0.18)" : CP.goldTint) : "rgba(10,19,32,0.06)",
                  color: active ? (v.sectionRule ? "#FFFFFF" : CP.goldText) : MUTED,
                }}
              >
                {o.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
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
        borderRadius: `${CP.radiusSm}px`,
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        bgcolor: CP.sandSoft,
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
            bgcolor: "rgba(10,19,32,0.6)",
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
        borderRadius: `${CP.radiusSm}px`,
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
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#FFFFFF" }}>
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
            borderRadius: "6px",
            bgcolor: "rgba(10,19,32,0.85)",
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
 * Empty state shown when a list has no rows: a small tinted icon circle,
 * a short sentence and one navy button, centred.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: SvgIconComponent;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const v = useCommunityVariant();
  return (
    <Box
      sx={{
        ...(cardSxFor(v) as object),
        textAlign: "center",
        py: 7,
        px: 3,
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            bgcolor: v.sectionRule ? v.accentTint : CP.sand,
            color: v.sectionRule ? v.link : CP.goldDeep,
            display: "grid",
            placeItems: "center",
            mx: "auto",
            mb: 2,
          }}
        >
          <Icon sx={{ fontSize: 22 }} />
        </Box>
      )}
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK, mb: 0.5 }}>{title}</Typography>
      {body && (
        <Typography sx={{ fontSize: "0.875rem", color: MUTED, maxWidth: 420, mx: "auto", lineHeight: 1.6, mb: action ? 2.5 : 0 }}>
          {body}
        </Typography>
      )}
      {action}
    </Box>
  );
}

