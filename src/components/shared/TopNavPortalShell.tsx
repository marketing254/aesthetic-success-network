"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  COMMUNITY_VARIANTS,
  CommunityVariantProvider,
  PORTAL_FONT,
  PortalTitleProvider,
  createCommunityPortalTheme,
  isCommunityPathActive,
  portalFontClassName,
  type CommunityNavItem,
  type CommunityVariantTokens,
  type PortalTitleContextValue,
} from "@/components/shared/CommunityPortalShell";

/**
 * TopNavPortalShell
 *
 * The light, top-navigation frame used by the expert portal. It is
 * deliberately unlike the company portal's dark sidebar:
 *
 *   - 72px white top bar with a 1px bottom border: ASN monogram and
 *     network name on the left, the sections as horizontal text tabs in
 *     the centre (active = espresso text with a 2px bronze underline),
 *     switcher / bell / avatar on the right
 *   - below md the tabs collapse into a scrollable pill row under the
 *     bar (no drawer)
 *   - warm cream canvas, content in a 1120px column, one footer line
 *   - espresso primary buttons, bronze links and accents, white 20px
 *     cards with a warm shadow
 *
 * Purely presentational. The expert shell keeps its data hooks, menus
 * and billing gate and passes them in. Shares the title context and the
 * variant context with CommunityPortalShell so PortalUI pieces
 * (PageHeader, SectionCard, StatCard, SegmentedFilter) work unchanged.
 */

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/** Expert portal palette: espresso, bronze, cream (from the ASN public site). */
export const EP = {
  espresso: "#2B1E14",
  espressoDeep: "#4A3421",
  espressoHover: "#4A3421",
  bronze: "#B07A2C",
  bronzeDeep: "#8F6222",
  bronzeTint: "#F4E8D6",
  bronzeTintHover: "#EEDDC3",
  cream: "#FBF7EF",
  white: "#FFFFFF",
  ivory: "#F6F1E7",
  ivory80: "rgba(246,241,231,0.8)",
  ivory55: "rgba(246,241,231,0.55)",
  ink: "#2B1E14",
  body: "#4B3F36",
  muted: "#6B6157",
  faint: "#A39A90",
  border: "rgba(43,30,20,0.08)",
  borderStrong: "rgba(43,30,20,0.16)",
  shadow: "0 10px 30px -22px rgba(43,30,20,0.25)",
  shadowHover: "0 14px 34px -20px rgba(43,30,20,0.32)",
  liveBg: "#E6F4EA",
  liveFg: "#1E6B3B",
  pendingBg: "#FBF0D9",
  pendingFg: "#8A5A0A",
  offBg: "#F1EDE6",
  offFg: "#6B6157",
  gold: "#D9A84B",
  goldTint: "#FBF3E1",
  goldText: "#7A5B17",
  radius: 20,
  radiusSm: 10,
  topbarHeight: 72,
  contentMax: 1120,
} as const;

/** Card surface for the expert portal: white, 20px radius, warm border and shadow. */
export const topNavCardSx: SxProps<Theme> = {
  bgcolor: EP.white,
  border: `1px solid ${EP.border}`,
  borderRadius: `${EP.radius}px`,
  boxShadow: EP.shadow,
};

/** Status tints: live (green), pending (amber), off (warm gray). */
export const EP_STATUS = {
  live: { bg: EP.liveBg, fg: EP.liveFg },
  pending: { bg: EP.pendingBg, fg: EP.pendingFg },
  off: { bg: EP.offBg, fg: EP.offFg },
  founding: { bg: EP.goldTint, fg: EP.goldText },
} as const;

/** Small tinted chip for statuses (8px radius, 600 weight). */
export function StatusTint({ label, tone, size = "md" }: { label: string; tone: keyof typeof EP_STATUS; size?: "sm" | "md" }) {
  const p = EP_STATUS[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: size === "sm" ? 0.9 : 1.1,
        height: size === "sm" ? 22 : 26,
        borderRadius: "8px",
        bgcolor: p.bg,
        color: p.fg,
        fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const v: CommunityVariantTokens = COMMUNITY_VARIANTS.expert;

/**
 * Espresso / bronze theme. Starts from the shared community theme (font,
 * controls, chips, dialogs) with the expert tokens, then retunes the
 * warm surfaces: 20px cards, bronze progress, links and sliders, cream
 * table hover, status chip tints.
 */
export const topNavPortalTheme = createTheme(createCommunityPortalTheme(v), {
  palette: {
    secondary: { main: EP.bronze, dark: EP.bronzeDeep, light: EP.bronzeTint, contrastText: "#FFFFFF" },
    success: { main: EP.liveFg, dark: EP.liveFg, light: EP.liveBg, contrastText: "#FFFFFF" },
    warning: { main: EP.pendingFg, dark: EP.pendingFg, light: EP.pendingBg, contrastText: "#FFFFFF" },
    text: { primary: EP.ink, secondary: EP.muted, disabled: EP.faint },
    divider: EP.border,
  },
  components: {
    MuiPaper: { styleOverrides: { rounded: { borderRadius: EP.radius }, elevation1: { boxShadow: EP.shadow } } },
    MuiCard: {
      styleOverrides: { root: { borderRadius: EP.radius, border: `1px solid ${EP.border}`, boxShadow: EP.shadow } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&.MuiButton-containedPrimary": {
            backgroundColor: EP.espresso,
            color: EP.ivory,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(43,30,20,0.16)",
            "&:hover": { backgroundColor: EP.espressoHover, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px -10px rgba(43,30,20,0.55)" },
            "&.Mui-disabled": { backgroundColor: "#E7E0D4", color: EP.faint, boxShadow: "none" },
          },
          "&.MuiButton-containedSecondary": {
            backgroundColor: EP.bronze,
            color: "#FFFFFF",
            "&:hover": { backgroundColor: EP.bronzeDeep, color: "#FFFFFF" },
          },
          "&.MuiButton-outlined": {
            borderColor: EP.espresso,
            color: EP.espresso,
            backgroundColor: EP.white,
            "&:hover": { backgroundColor: EP.bronzeTint, borderColor: EP.espresso, boxShadow: EP.shadow },
          },
          "&.MuiButton-outlinedSecondary": { borderColor: EP.bronze, color: EP.bronzeDeep, "&:hover": { backgroundColor: EP.bronzeTint } },
          "&.MuiButton-text": { color: EP.bronzeDeep, "&:hover": { backgroundColor: EP.bronzeTint, transform: "none" } },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: EP.muted, "&:hover": { backgroundColor: EP.bronzeTint, color: EP.ink } } } },
    MuiLink: { styleOverrides: { root: { color: EP.bronzeDeep } } },
    MuiLinearProgress: { styleOverrides: { root: { backgroundColor: EP.bronzeTint }, bar: { backgroundColor: EP.bronze } } },
    MuiSlider: {
      styleOverrides: { thumb: { border: `2px solid ${EP.espresso}` }, track: { backgroundColor: EP.bronze }, rail: { backgroundColor: EP.bronzeTint } },
    },
    MuiCircularProgress: { styleOverrides: { root: { color: EP.bronze } } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: "#F1EAE0" } } },
    MuiChip: {
      styleOverrides: {
        root: { backgroundColor: EP.offBg, color: EP.offFg },
        filled: {
          "&.MuiChip-colorPrimary": { backgroundColor: EP.bronzeTint, color: EP.espresso },
          "&.MuiChip-colorSecondary": { backgroundColor: EP.goldTint, color: EP.goldText },
          "&.MuiChip-colorSuccess": { backgroundColor: EP.liveBg, color: EP.liveFg },
          "&.MuiChip-colorWarning": { backgroundColor: EP.pendingBg, color: EP.pendingFg },
          "&.MuiChip-colorInfo": { backgroundColor: EP.bronzeTint, color: EP.espresso },
        },
      },
    },
    MuiTableRow: { styleOverrides: { root: { "&.MuiTableRow-hover:hover": { backgroundColor: EP.bronzeTint } } } },
    MuiMenuItem: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: EP.bronzeTint }, "&.Mui-selected": { backgroundColor: EP.bronzeTint, "&:hover": { backgroundColor: EP.bronzeTintHover } } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standard: {
          "&.MuiAlert-colorInfo": { backgroundColor: EP.bronzeTint, color: EP.ink, borderColor: "rgba(176,122,44,0.35)", "& .MuiAlert-icon": { color: EP.bronze } },
          "&.MuiAlert-colorSuccess": { backgroundColor: EP.liveBg, color: EP.liveFg },
          "&.MuiAlert-colorWarning": { backgroundColor: EP.pendingBg, color: EP.pendingFg },
        },
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: EP.espresso }, arrow: { color: EP.espresso } } },
    MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: EP.espresso } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(43,30,20,0.36)" } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: EP.bronze, borderWidth: 1 },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: EP.borderStrong },
        },
        notchedOutline: { borderColor: EP.borderStrong },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { "&.Mui-focused": { color: EP.bronzeDeep } } } },
  },
});

/* ------------------------------------------------------------------ */
/* Top-bar buttons                                                     */
/* ------------------------------------------------------------------ */

/** Pill button (switcher) for the light top bar: white with an espresso border. */
export const topNavPillButtonSx: SxProps<Theme> = {
  minHeight: 36,
  borderRadius: 999,
  px: 1.5,
  fontSize: "0.8125rem",
  fontWeight: 600,
  bgcolor: EP.white,
  borderColor: EP.espresso,
  color: EP.espresso,
  boxShadow: "none",
  "&:hover": { bgcolor: EP.bronzeTint, borderColor: EP.espresso, transform: "none", boxShadow: "none" },
};

/* ------------------------------------------------------------------ */
/* Nav pieces                                                          */
/* ------------------------------------------------------------------ */

function NavTab({ item, active }: { item: CommunityNavItem; active: boolean }) {
  return (
    <Box
      component={Link}
      href={item.href}
      aria-current={active ? "page" : undefined}
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        height: EP.topbarHeight,
        px: 1.25,
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: active ? 700 : 500,
        color: active ? EP.espresso : EP.muted,
        whiteSpace: "nowrap",
        transition: "color 140ms ease",
        "&:hover": { color: EP.espresso },
        "&:focus-visible": { outline: `2px solid ${EP.bronze}`, outlineOffset: -4, borderRadius: 8 },
        "&::after": {
          content: '""',
          position: "absolute",
          left: 10,
          right: 10,
          bottom: -1,
          height: 2,
          borderRadius: 999,
          bgcolor: EP.bronze,
          transform: `scaleX(${active ? 1 : 0})`,
          transformOrigin: "center",
          transition: "transform 160ms ease",
        },
      }}
    >
      {item.label}
      {item.badge && item.badge > 0 ? (
        <Box
          component="span"
          sx={{
            px: 0.7,
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            fontSize: "0.6875rem",
            fontWeight: 700,
            display: "inline-grid",
            placeItems: "center",
            bgcolor: EP.bronze,
            color: "#FFFFFF",
          }}
        >
          {item.badge}
        </Box>
      ) : null}
    </Box>
  );
}

function NavPill({ item, active }: { item: CommunityNavItem; active: boolean }) {
  return (
    <Box
      component={Link}
      href={item.href}
      aria-current={active ? "page" : undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 34,
        px: 1.5,
        borderRadius: 999,
        textDecoration: "none",
        fontSize: "0.8125rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        color: active ? EP.ivory : EP.espresso,
        bgcolor: active ? EP.espresso : EP.white,
        border: `1px solid ${active ? EP.espresso : EP.border}`,
        transition: "background-color 140ms ease, color 140ms ease",
        "&:hover": { bgcolor: active ? EP.espressoHover : EP.bronzeTint },
        "&:focus-visible": { outline: `2px solid ${EP.bronze}`, outlineOffset: 2 },
      }}
    >
      {item.label}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export type TopNavPortalShellProps = {
  /** Small line under the network name in the brand block, e.g. "Expert portal". */
  portalName: string;
  /** Where the brand block links to. Also the exact-match root for active state. */
  homeHref: string;
  items: CommunityNavItem[];
  pathname: string;
  /** Right side of the top bar: switcher, bell, avatar. */
  topRight?: React.ReactNode;
  /** Optional strip rendered between the bar and the content (banners). */
  beforeContent?: React.ReactNode;
  supportEmail?: string;
  supportPhone?: string;
  footerLine?: string;
  /** Extra nodes (menus, dialogs) rendered at the root. */
  overlays?: React.ReactNode;
  /** Widest content column, default 1120px. */
  maxWidth?: number;
  children: React.ReactNode;
};

export default function TopNavPortalShell({
  portalName,
  homeHref,
  items,
  pathname,
  topRight,
  beforeContent,
  supportEmail,
  supportPhone = "(855) 567-5323",
  footerLine = "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics",
  overlays,
  maxWidth = EP.contentMax,
  children,
}: TopNavPortalShellProps) {
  const [pageTitleOverride, setPageTitleOverride] = useState<string | null>(null);

  const activeItem = items.find((i) => isCommunityPathActive(i.href, pathname, homeHref));
  const navTitle = activeItem?.label ?? portalName;
  const pageTitle = pageTitleOverride ?? navTitle;

  const titleCtx = useMemo<PortalTitleContextValue>(
    () => ({ title: pageTitle, setTitle: setPageTitleOverride }),
    [pageTitle],
  );

  const phoneDigits = supportPhone ? supportPhone.replace(/[^0-9]/g, "") : "";
  const phoneHref = phoneDigits ? `tel:+${phoneDigits.length === 10 ? `1${phoneDigits}` : phoneDigits}` : undefined;

  const column = { maxWidth, mx: "auto", px: { xs: 2, md: 3 } } as const;

  return (
    <ThemeProvider theme={topNavPortalTheme}>
      <CommunityVariantProvider value={v}>
        <PortalTitleProvider value={titleCtx}>
          <Box
            className={`asn-topnav-portal ${portalFontClassName}`}
            sx={{
              minHeight: "100vh",
              bgcolor: EP.cream,
              color: EP.ink,
              fontFamily: PORTAL_FONT,
              display: "flex",
              flexDirection: "column",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {/* Top bar */}
            <Box
              component="header"
              sx={{
                position: "sticky",
                top: 0,
                zIndex: (t) => t.zIndex.appBar,
                bgcolor: EP.white,
                borderBottom: `1px solid ${EP.border}`,
              }}
            >
              <Box sx={{ ...column, height: EP.topbarHeight, display: "flex", alignItems: "center", gap: 2 }}>
                {/* Brand */}
                <Box
                  component={Link}
                  href={homeHref}
                  aria-label="Aesthetic Success Network"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    textDecoration: "none",
                    color: "inherit",
                    flexShrink: 0,
                    minWidth: 0,
                    "&:focus-visible": { outline: `2px solid ${EP.bronze}`, outlineOffset: 4, borderRadius: 8 },
                  }}
                >
                  <Box sx={{ position: "relative", width: 40, height: 40, borderRadius: "10px", overflow: "hidden", flexShrink: 0 }}>
                    <Image src="/asn-nav-icon.png" alt="" fill sizes="40px" style={{ objectFit: "cover" }} />
                  </Box>
                  <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 800, letterSpacing: "-0.02em", color: EP.espresso, lineHeight: 1.15 }} noWrap>
                      Aesthetic Success Network
                    </Typography>
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: EP.bronze, lineHeight: 1.2, mt: 0.2 }} noWrap>
                      {portalName}
                    </Typography>
                  </Box>
                </Box>

                {/* Centre tabs (md and up) */}
                <Box
                  component="nav"
                  aria-label={`${portalName} sections`}
                  sx={{ flex: 1, minWidth: 0, display: { xs: "none", md: "flex" }, justifyContent: "center", alignItems: "center", gap: 0.25 }}
                >
                  {items.map((item) => (
                    <NavTab key={item.href} item={item} active={isCommunityPathActive(item.href, pathname, homeHref)} />
                  ))}
                </Box>
                <Box sx={{ flex: 1, display: { xs: "block", md: "none" } }} />

                {/* Right actions */}
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                  {topRight}
                </Stack>
              </Box>

              {/* Mobile: scrollable pill row under the bar */}
              <Box
                component="nav"
                aria-label={`${portalName} sections`}
                sx={{
                  display: { xs: "flex", md: "none" },
                  gap: 1,
                  px: 2,
                  pb: 1.5,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {items.map((item) => (
                  <NavPill key={item.href} item={item} active={isCommunityPathActive(item.href, pathname, homeHref)} />
                ))}
              </Box>
            </Box>

            {beforeContent}

            {/* Page title + content */}
            <Box component="main" sx={{ flex: 1, width: "100%" }}>
              <Box sx={{ ...column, pt: { xs: 3, md: 4 }, pb: { xs: 4, md: 6 } }}>
                <Typography
                  component="h1"
                  sx={{ fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 800, letterSpacing: "-0.025em", color: EP.espresso, lineHeight: 1.2, mb: 2.5 }}
                >
                  {pageTitle}
                </Typography>
                {children}
              </Box>
            </Box>

            {/* Footer */}
            <Box component="footer" sx={{ py: 3, borderTop: `1px solid ${EP.border}` }}>
              <Box sx={column}>
                <Typography sx={{ fontSize: "0.75rem", color: EP.muted, lineHeight: 1.6 }}>
                  {footerLine}
                  {supportEmail && (
                    <>
                      {" · "}
                      <Box
                        component="a"
                        href={`mailto:${supportEmail}`}
                        sx={{ color: EP.bronzeDeep, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                      >
                        {supportEmail}
                      </Box>
                    </>
                  )}
                  {supportPhone && (
                    <>
                      {" · "}
                      <Box
                        component="a"
                        href={phoneHref}
                        sx={{ color: EP.muted, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { color: EP.ink, textDecoration: "underline" } }}
                      >
                        {supportPhone}
                      </Box>
                    </>
                  )}
                </Typography>
              </Box>
            </Box>

            {overlays}
          </Box>
        </PortalTitleProvider>
      </CommunityVariantProvider>
    </ThemeProvider>
  );
}
