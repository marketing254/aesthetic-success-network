"use client";

import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";

/**
 * Editorial primitives — Hallmark "Almanac/Linen" theme axis.
 *
 * Discipline:
 *   - Locked tokens (var(--paper), var(--ink), var(--gold)) — no inline hex
 *   - Numbered macrostructure with italic serif numerals
 *   - Horizontal rules (--paper-rule) as the primary section divider
 *   - Display + body pairing: var(--font-display) for headings,
 *     system stack for body
 *   - Named easings (var(--ease-out)) on every animated property
 *   - 8-state interactive elements (focus-visible included)
 *   - Zero-chroma neutrals, gold accent capped at ~15% saturation
 */

export const ink = {
  primary: "var(--ink)",
  soft: "var(--ink-soft)",
  fade: "var(--ink-fade)",
  rule: "var(--paper-rule)",
};

export const editorialText = {
  // Hero display — 21-50 character target
  display: {
    fontFamily: "var(--font-display)",
    fontSize: { xs: "1.8rem", md: "2.4rem" },
    lineHeight: 1.08,
    letterSpacing: "-0.02em",
    fontWeight: 500,
    color: ink.primary,
  } as SxProps<Theme>,
  // Section title — page-level secondary
  title: {
    fontFamily: "var(--font-display)",
    fontSize: { xs: "1.3rem", md: "1.5rem" },
    lineHeight: 1.18,
    letterSpacing: "-0.01em",
    fontWeight: 500,
    color: ink.primary,
  } as SxProps<Theme>,
  // Section heading — inline within columns
  heading: {
    fontFamily: "var(--font-display)",
    fontSize: { xs: "1rem", md: "1.1rem" },
    lineHeight: 1.2,
    fontWeight: 500,
    color: ink.primary,
  } as SxProps<Theme>,
  // Body — for prose / descriptions
  body: {
    fontSize: "0.86rem",
    lineHeight: 1.65,
    color: ink.soft,
  } as SxProps<Theme>,
  // Meta — secondary info, captions
  meta: {
    fontSize: "0.74rem",
    lineHeight: 1.5,
    color: ink.fade,
  } as SxProps<Theme>,
  // Eyebrow — small caps lead-in
  eyebrow: {
    fontSize: "0.66rem",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: ink.fade,
  } as SxProps<Theme>,
  // KPI numeral — big editorial number
  numeral: {
    fontFamily: "var(--font-display)",
    fontSize: { xs: "1.65rem", md: "1.85rem" },
    lineHeight: 1,
    letterSpacing: "-0.02em",
    fontWeight: 500,
    color: ink.primary,
  } as SxProps<Theme>,
};

/**
 * Page-level editorial header.
 *
 * No card. Just display heading + standfirst + a hairline rule beneath.
 * The numeral arg renders an italic-serif "01" style index.
 */
export function EditorialHeader({
  index,
  eyebrow,
  title,
  standfirst,
  actions,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  standfirst?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Box sx={{ pb: 2, mb: 2.5, borderBottom: "1px solid var(--ink-rule)" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "flex-end" } }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", mb: 1.25 }}>
            {index && (
              <Box
                component="span"
                className="hk-numeral"
                sx={{
                  fontSize: { xs: "1.1rem", md: "1.25rem" },
                  color: "var(--gold)",
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                }}
              >
                {index}
              </Box>
            )}
            <Typography sx={editorialText.eyebrow}>{eyebrow}</Typography>
          </Stack>
          <Typography component="h1" sx={editorialText.display}>
            {title}
          </Typography>
          {standfirst && (
            <Typography sx={{ ...editorialText.body, mt: 1, maxWidth: 640 }}>
              {standfirst}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "flex-end" } }}>
            {actions}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

/**
 * Numbered section eyebrow: 01 · OVERVIEW
 * Sits above a section heading, separated by an em-rule.
 */
export function NumberedEyebrow({ index, label }: { index: string; label: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 0.75 }}>
      <Box
        component="span"
        className="hk-numeral"
        sx={{
          fontSize: "0.92rem",
          color: "var(--gold)",
          lineHeight: 1,
          letterSpacing: "0.02em",
        }}
      >
        {index}
      </Box>
      <Box
        aria-hidden
        sx={{ width: 18, height: "1px", bgcolor: "var(--ink-rule)", mb: "5px" }}
      />
      <Typography sx={editorialText.eyebrow}>{label}</Typography>
    </Stack>
  );
}

/**
 * Section block with optional numbered eyebrow + heading + trailing rule.
 * Used to compose pages without nesting card-after-card.
 */
export function EditorialSection({
  index,
  eyebrow,
  title,
  standfirst,
  actions,
  children,
  rule = true,
}: {
  index?: string;
  eyebrow?: string;
  title?: string;
  standfirst?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  rule?: boolean;
}) {
  return (
    <Box sx={{ pb: rule ? 2.5 : 0, mb: rule ? 2.5 : 0, borderBottom: rule ? "1px solid var(--paper-rule)" : "none" }}>
      {(eyebrow || title) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" }, mb: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {eyebrow && (index ? (
              <NumberedEyebrow index={index} label={eyebrow} />
            ) : (
              <Typography sx={{ ...editorialText.eyebrow, mb: 0.5 }}>{eyebrow}</Typography>
            ))}
            {title && <Typography sx={editorialText.heading}>{title}</Typography>}
            {standfirst && (
              <Typography sx={{ ...editorialText.meta, mt: 0.5, maxWidth: 540 }}>
                {standfirst}
              </Typography>
            )}
          </Box>
          {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
        </Stack>
      )}
      {children}
    </Box>
  );
}

/**
 * Editorial KPI line: numeral + label + supporting meta, separated by
 * vertical hairlines. Sits in a strip across the page rather than 4 cards.
 */
export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; meta?: string }>;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          md: `repeat(${items.length}, 1fr)`,
        },
        borderTop: "1px solid var(--paper-rule)",
        borderBottom: "1px solid var(--paper-rule)",
      }}
    >
      {items.map((it, i) => (
        <Box
          key={it.label}
          sx={{
            px: { xs: 1.5, md: 2 },
            py: { xs: 1.75, md: 2 },
            borderLeft: { md: i === 0 ? "none" : "1px solid var(--paper-rule)" },
            borderTop: {
              xs: i >= 2 ? "1px solid var(--paper-rule)" : "none",
              md: "none",
            },
            borderLeftStyle: { xs: i % 2 === 1 ? "solid" : "none", md: "solid" } as const,
            borderLeftWidth: { xs: i % 2 === 1 ? "1px" : 0, md: i === 0 ? 0 : "1px" } as const,
            borderLeftColor: "var(--paper-rule)",
          }}
        >
          <Typography sx={{ ...editorialText.eyebrow, mb: 0.75 }}>{it.label}</Typography>
          <Typography sx={editorialText.numeral}>{it.value}</Typography>
          {it.meta && (
            <Typography sx={{ ...editorialText.meta, mt: 0.5 }}>{it.meta}</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Hairline rule. Use to separate editorial regions without a card.
 */
export function Rule({ tone = "paper" }: { tone?: "paper" | "ink" }) {
  return (
    <Box
      role="separator"
      sx={{
        height: "1px",
        bgcolor: tone === "ink" ? "var(--ink-rule)" : "var(--paper-rule)",
      }}
    />
  );
}

/**
 * Inline tag. Tiny, rectangular, locked palette.
 */
export function InlineTag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "gold" | "leaf" | "ink";
}) {
  const palette =
    tone === "gold"
      ? { bg: "color-mix(in oklch, var(--gold) 10%, transparent)", fg: "var(--gold-deep)", border: "color-mix(in oklch, var(--gold) 40%, transparent)" }
      : tone === "leaf"
        ? { bg: "color-mix(in oklch, var(--leaf) 10%, transparent)", fg: "var(--leaf)", border: "color-mix(in oklch, var(--leaf) 40%, transparent)" }
        : tone === "ink"
          ? { bg: "color-mix(in oklch, var(--ink) 6%, transparent)", fg: "var(--ink)", border: "color-mix(in oklch, var(--ink) 20%, transparent)" }
          : { bg: "transparent", fg: "var(--ink-soft)", border: "var(--paper-rule)" };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        px: 0.85,
        borderRadius: 0.5,
        bgcolor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: "0.6rem",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}
