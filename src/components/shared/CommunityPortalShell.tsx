"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Avatar, Box, Drawer, IconButton, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";

/**
 * CommunityPortalShell
 *
 * The premium community-platform frame (Circle / Supabase / Square feel)
 * used by the company portal and, once approved, the expert portal:
 *
 *   - warm off-white canvas, 264px inset off-white sidebar with a
 *     "community card" at the top, grouped nav rows, identity + sign out
 *     at the bottom; collapses to a drawer behind a hamburger below md
 *   - transparent 64px top bar: page title left, action buttons right
 *   - one gray footer line with support email and phone
 *   - nested MUI theme: Plus Jakarta Sans, 16px cards, 10px controls,
 *     navy primary, gold highlights
 *
 * Purely presentational. Each portal shell keeps its own data hooks, nav
 * items, menus and billing gates and passes them in.
 */

/* ------------------------------------------------------------------ */
/* Font                                                                */
/* ------------------------------------------------------------------ */

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/** Font stack for everything rendered in the community portal. */
export const PORTAL_FONT = `${jakarta.style.fontFamily}, 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
/** Class that loads the font on a subtree (login page, shell root). */
export const portalFontClassName = jakarta.className;

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

export const CP = {
  canvas: "#F2EEE6",
  sidebar: "#0A1320",
  sidebarEnd: "#111C2E",
  sidebarPanel: "rgba(255,255,255,0.06)",
  sidebarLine: "rgba(255,255,255,0.08)",
  ivory: "#F6F1E7",
  ivory80: "rgba(246,241,231,0.8)",
  ivory55: "rgba(246,241,231,0.55)",
  white: "#FFFFFF",
  border: "rgba(10,19,32,0.06)",
  borderStrong: "rgba(10,19,32,0.14)",
  sand: "#F3EBDD",
  sandSoft: "#F8F4EC",
  ink: "#0A1320",
  navy: "#0A1320",
  navyHover: "#141F30",
  navyTint: "rgba(10,19,32,0.06)",
  body: "#3B4451",
  muted: "#6B7280",
  faint: "#9AA3AF",
  gold: "#D9A84B",
  goldDeep: "#B8862F",
  goldTint: "#FBF3E1",
  goldText: "#7A5B17",
  successBg: "#DCFCE7",
  successFg: "#166534",
  warningBg: "#FEF3C7",
  warningFg: "#92400E",
  errorBg: "#FEE2E2",
  errorFg: "#991B1B",
  neutralBg: "#F1EFEA",
  neutralFg: "#3B4451",
  shadow: "0 1px 2px rgba(10,19,32,0.04), 0 8px 24px -16px rgba(10,19,32,0.12)",
  shadowHover: "0 2px 4px rgba(10,19,32,0.05), 0 16px 32px -20px rgba(10,19,32,0.18)",
  shadowPop: "0 4px 12px rgba(10,19,32,0.06), 0 24px 48px -24px rgba(10,19,32,0.24)",
  radius: 16,
  radiusSm: 10,
  radiusChip: 8,
  sidebarWidth: 264,
  sidebarInset: 12,
  topbarHeight: 64,
  contentMax: 1200,
} as const;

/** Card surface used by every white panel in the portal. */
export const cardSx: SxProps<Theme> = {
  bgcolor: CP.white,
  border: `1px solid ${CP.border}`,
  borderRadius: `${CP.radius}px`,
  boxShadow: CP.shadow,
};

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

/**
 * The handful of tokens that differ between the two portals built on
 * this shell. Everything else (font, spacing, card language, footer)
 * is shared. `company` is the original look, so passing no variant
 * changes nothing for /vendor.
 */
export type CommunityVariantTokens = {
  name: "company" | "expert";
  /** Sidebar gradient start / end. */
  sidebar: string;
  sidebarEnd: string;
  /** Fill behind the active nav row and its hover state. */
  activeFill: string;
  activeHoverFill: string;
  /** Primary button, link and focus colour, its hover and its tint. */
  accent: string;
  accentHover: string;
  accentLight: string;
  accentTint: string;
  /** Page background. */
  canvas: string;
  /** List row hover tint. */
  rowHover: string;
  /** Icon circle tint on stat tiles. */
  statIconBg: string;
  statIconFg: string;
  /** Draw a short accent rule to the left of section titles. */
  sectionRule: boolean;
  /** Link / rule / progress colour (bronze in the expert portal). Defaults to accent. */
  link: string;
  /** Large stat number colour. */
  statValue: string;
  /** Card surface: radius, border and shadow. */
  cardRadius: number;
  cardBorder: string;
  cardShadow: string;
};

export const COMMUNITY_VARIANTS: Record<"company" | "expert", CommunityVariantTokens> = {
  company: {
    name: "company",
    sidebar: CP.sidebar,
    sidebarEnd: CP.sidebarEnd,
    activeFill: "rgba(255,255,255,0.08)",
    activeHoverFill: "rgba(255,255,255,0.10)",
    accent: CP.navy,
    accentHover: CP.navyHover,
    accentLight: "#2A3547",
    accentTint: CP.navyTint,
    canvas: CP.canvas,
    rowHover: CP.sandSoft,
    statIconBg: "rgba(10,19,32,0.08)",
    statIconFg: CP.navy,
    sectionRule: false,
    link: CP.navy,
    statValue: CP.ink,
    cardRadius: CP.radius,
    cardBorder: CP.border,
    cardShadow: CP.shadow,
  },
  // Espresso / bronze / cream, taken from the ASN public site. Light frame
  // with a top navigation bar (TopNavPortalShell), no sidebar.
  expert: {
    name: "expert",
    sidebar: "#2B1E14",
    sidebarEnd: "#4A3421",
    activeFill: "#F4E8D6",
    activeHoverFill: "#EEDDC3",
    accent: "#2B1E14",
    accentHover: "#4A3421",
    accentLight: "#6B5140",
    accentTint: "#F4E8D6",
    canvas: "#FBF7EF",
    rowHover: "#F4E8D6",
    statIconBg: "#F4E8D6",
    statIconFg: "#B07A2C",
    sectionRule: true,
    link: "#B07A2C",
    statValue: "#B07A2C",
    cardRadius: 20,
    cardBorder: "rgba(43,30,20,0.08)",
    cardShadow: "0 10px 30px -22px rgba(43,30,20,0.25)",
  },
};

/** Expert portal tokens, for the /expert pages. */
export const XP = COMMUNITY_VARIANTS.expert;

const VariantContext = createContext<CommunityVariantTokens>(COMMUNITY_VARIANTS.company);

/** Lets another shell (TopNavPortalShell) drive the variant-aware PortalUI pieces. */
export const CommunityVariantProvider = VariantContext.Provider;

/** Card surface for a variant (radius, border, shadow). */
export function cardSxFor(v: CommunityVariantTokens): SxProps<Theme> {
  return { bgcolor: CP.white, border: `1px solid ${v.cardBorder}`, borderRadius: `${v.cardRadius}px`, boxShadow: v.cardShadow };
}

/** Tokens of the portal variant this subtree renders in (company outside a shell). */
export function useCommunityVariant(): CommunityVariantTokens {
  return useContext(VariantContext);
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const HEADING = { fontFamily: PORTAL_FONT, letterSpacing: "-0.02em", color: CP.ink };

export function createCommunityPortalTheme(v: CommunityVariantTokens) {
  return createTheme({
  palette: {
    mode: "light",
    primary: { main: v.accent, dark: v.accentHover, light: v.accentLight, contrastText: "#FFFFFF" },
    secondary: { main: CP.gold, dark: CP.goldDeep, light: CP.goldTint, contrastText: CP.ink },
    success: { main: "#15803D", dark: CP.successFg, light: CP.successBg, contrastText: "#FFFFFF" },
    warning: { main: "#B45309", dark: CP.warningFg, light: CP.warningBg, contrastText: "#FFFFFF" },
    error: { main: "#B91C1C", dark: CP.errorFg, light: CP.errorBg, contrastText: "#FFFFFF" },
    info: { main: v.accent, contrastText: "#FFFFFF" },
    background: { default: v.canvas, paper: CP.white },
    text: { primary: CP.ink, secondary: CP.muted, disabled: CP.faint },
    divider: CP.border,
    grey: {
      50: CP.sandSoft,
      100: CP.neutralBg,
      200: "#E6E2D9",
      300: "#D6D1C6",
      400: CP.faint,
      500: CP.muted,
      700: CP.body,
      900: CP.ink,
    },
  },
  shape: { borderRadius: CP.radiusSm },
  typography: {
    fontFamily: PORTAL_FONT,
    h1: { ...HEADING, fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.25 },
    h2: { ...HEADING, fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3 },
    h3: { ...HEADING, fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.35 },
    h4: { ...HEADING, fontSize: "1rem", fontWeight: 700, lineHeight: 1.4 },
    h5: { ...HEADING, fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.4 },
    h6: { ...HEADING, fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.4 },
    subtitle1: { fontSize: "0.9375rem", lineHeight: 1.5, color: CP.body },
    subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.5, color: CP.ink },
    body1: { fontSize: "0.875rem", lineHeight: 1.6, color: CP.body, fontWeight: 400 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.55, color: CP.muted, fontWeight: 400 },
    caption: { fontSize: "0.75rem", lineHeight: 1.5, color: CP.muted },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0, fontSize: "0.875rem" },
    overline: { fontSize: "0.75rem", fontWeight: 600, letterSpacing: 0, lineHeight: 1.5, textTransform: "none", color: CP.muted },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: CP.radiusSm,
          minHeight: 40,
          paddingInline: 16,
          paddingBlock: 0,
          fontWeight: 600,
          fontSize: "0.875rem",
          lineHeight: 1.2,
          boxShadow: "none",
          transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0)" },
          "&.Mui-disabled": { transform: "none" },
          "&.MuiButton-containedPrimary": {
            backgroundColor: v.accent,
            backgroundImage: "none",
            color: "#FFFFFF",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
            "&:hover": { backgroundColor: v.accentHover, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)" },
            "&.Mui-disabled": { backgroundColor: "#E6E2D9", color: CP.faint, boxShadow: "none" },
          },
          "&.MuiButton-containedSecondary": {
            backgroundColor: CP.gold,
            backgroundImage: "none",
            color: CP.ink,
            "&:hover": { backgroundColor: CP.goldDeep, color: "#FFFFFF" },
          },
          "&.MuiButton-containedSuccess": { backgroundColor: "#15803D", color: "#FFFFFF", "&:hover": { backgroundColor: CP.successFg } },
          "&.MuiButton-containedError": { backgroundColor: "#B91C1C", color: "#FFFFFF", "&:hover": { backgroundColor: CP.errorFg } },
          "&.MuiButton-outlined": {
            borderColor: v.accent,
            color: v.accent,
            backgroundColor: CP.white,
            "&:hover": { backgroundColor: CP.sandSoft, borderColor: v.accent, boxShadow: CP.shadow },
            "&.Mui-disabled": { borderColor: CP.border, color: CP.faint },
          },
          "&.MuiButton-outlinedError": { borderColor: "#FCA5A5", color: CP.errorFg, "&:hover": { backgroundColor: CP.errorBg } },
          "&.MuiButton-outlinedSuccess": { borderColor: "#86EFAC", color: CP.successFg, "&:hover": { backgroundColor: CP.successBg } },
          "&.MuiButton-outlinedSecondary": { borderColor: CP.gold, color: CP.goldText, "&:hover": { backgroundColor: CP.goldTint } },
          "&.MuiButton-text": {
            color: v.accent,
            "&:hover": { backgroundColor: v.accentTint, transform: "none" },
          },
          "&.MuiButton-textError": { color: CP.errorFg, "&:hover": { backgroundColor: CP.errorBg } },
          "&.MuiButton-textSecondary": { color: CP.body },
        },
        sizeSmall: { minHeight: 34, paddingInline: 12, fontSize: "0.8125rem", borderRadius: 8 },
        sizeLarge: { minHeight: 46, paddingInline: 22, fontSize: "0.9375rem", borderRadius: 12 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          color: CP.muted,
          transition: "background-color 140ms ease, color 140ms ease, border-color 140ms ease",
          "&:hover": { backgroundColor: CP.sand, color: CP.ink },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", backgroundColor: CP.white },
        rounded: { borderRadius: CP.radius },
        outlined: { borderColor: CP.border },
        elevation1: { boxShadow: CP.shadow },
        elevation2: { boxShadow: CP.shadowHover },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: CP.radius,
          border: `1px solid ${CP.border}`,
          backgroundColor: CP.white,
          boxShadow: CP.shadow,
          transition: "none",
        },
      },
    },
    MuiCardContent: { styleOverrides: { root: { padding: 24, "&:last-child": { paddingBottom: 24 } } } },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: { root: { backgroundImage: "none", boxShadow: "none" } },
    },
    MuiToolbar: { styleOverrides: { root: { minHeight: CP.topbarHeight } } },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: v.sidebar, borderRight: 0, backgroundImage: `linear-gradient(180deg, ${v.sidebar} 0%, ${v.sidebarEnd} 100%)` },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true, slotProps: { inputLabel: { shrink: true } } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: CP.white,
          borderRadius: CP.radiusSm,
          minHeight: 44,
          fontSize: "0.875rem",
          color: CP.ink,
          transition: "border-color 140ms ease, box-shadow 140ms ease",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: CP.borderStrong },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: v.accent, borderWidth: 1 },
          "& input": { outline: "none", boxShadow: "none" },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: "#B91C1C" },
          "&.Mui-disabled": { backgroundColor: CP.sandSoft },
        },
        notchedOutline: { borderColor: "rgba(10,19,32,0.14)" },
        input: {
          padding: "12px 14px",
          fontSize: "0.875rem",
          "&::placeholder": { color: CP.faint, opacity: 1, fontSize: "0.875rem" },
        },
        sizeSmall: { minHeight: 38, borderRadius: 10, "& .MuiInputBase-input": { padding: "8px 12px", fontSize: "0.875rem" } },
        multiline: {
          padding: 0,
          "& textarea": { padding: "12px 14px", fontSize: "0.875rem", "&::placeholder": { color: CP.faint, opacity: 1 } },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: CP.muted,
          fontSize: "0.875rem",
          fontWeight: 500,
          "&.MuiInputLabel-shrink": { color: CP.body, fontWeight: 600 },
          "&.Mui-focused": { color: v.accent },
        },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginTop: 6, fontSize: "0.8125rem", color: CP.muted } } },
    MuiSelect: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        select: {
          padding: "12px 14px",
          paddingRight: "40px",
          minHeight: "1.4em",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
        },
      },
    },
    MuiCheckbox: { styleOverrides: { root: { color: CP.faint, "&.Mui-checked": { color: v.accent } } } },
    MuiRadio: { styleOverrides: { root: { color: CP.faint, "&.Mui-checked": { color: v.accent } } } },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": { color: v.accent },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: v.accent },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: CP.radiusChip,
          fontWeight: 600,
          letterSpacing: 0,
          fontSize: "0.75rem",
          height: 24,
          backgroundColor: CP.neutralBg,
          color: CP.neutralFg,
        },
        sizeSmall: { height: 22, fontSize: "0.6875rem" },
        label: { paddingInline: 8 },
        filled: {
          "&.MuiChip-colorPrimary": { backgroundColor: v.accentTint, color: v.accent },
          "&.MuiChip-colorSecondary": { backgroundColor: CP.goldTint, color: CP.goldText },
          "&.MuiChip-colorSuccess": { backgroundColor: CP.successBg, color: CP.successFg },
          "&.MuiChip-colorError": { backgroundColor: CP.errorBg, color: CP.errorFg },
          "&.MuiChip-colorWarning": { backgroundColor: CP.warningBg, color: CP.warningFg },
          "&.MuiChip-colorInfo": { backgroundColor: v.accentTint, color: v.accent },
        },
        outlined: {
          borderColor: CP.borderStrong,
          backgroundColor: "transparent",
          color: CP.body,
          "&.MuiChip-colorPrimary": { borderColor: v.accent, color: v.accent },
          "&.MuiChip-colorSecondary": { borderColor: CP.gold, color: CP.goldText },
          "&.MuiChip-colorSuccess": { borderColor: "#86EFAC", color: CP.successFg },
          "&.MuiChip-colorError": { borderColor: "#FCA5A5", color: CP.errorFg },
        },
        deleteIcon: { color: "inherit", opacity: 0.6, "&:hover": { opacity: 1, color: "inherit" } },
      },
    },
    MuiBadge: { styleOverrides: { colorSecondary: { backgroundColor: CP.gold, color: CP.ink } } },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: CP.radius, border: `1px solid ${CP.border}`, backgroundColor: CP.white, boxShadow: CP.shadow } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            backgroundColor: CP.white,
            color: CP.muted,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: "none",
            borderBottom: `1px solid ${CP.border}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${CP.border}`, fontSize: "0.875rem", color: CP.ink, padding: "14px 16px" },
        sizeSmall: { padding: "8px 12px" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child .MuiTableCell-root": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": { backgroundColor: CP.sandSoft },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, backgroundColor: CP.neutralBg, borderRadius: 999, padding: 4 },
        indicator: { display: "none" },
        list: { gap: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.8125rem",
          minHeight: 32,
          paddingInline: 14,
          paddingBlock: 0,
          borderRadius: 999,
          color: CP.muted,
          transition: "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
          "&.Mui-selected": { color: CP.ink, backgroundColor: CP.white, boxShadow: "0 1px 2px rgba(10,19,32,0.08)" },
          "&:hover": { color: CP.ink },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: CP.radius,
          border: `1px solid ${CP.border}`,
          boxShadow: CP.shadowPop,
          backgroundImage: "none",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { ...HEADING, fontWeight: 700, fontSize: "1.0625rem", padding: "22px 24px 6px" },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: "8px 24px 16px" } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "12px 24px 22px", gap: 8 } } },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: "rgba(10,19,32,0.36)", backdropFilter: "blur(2px)" },
        invisible: { backgroundColor: "transparent", backdropFilter: "none" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, border: `1px solid ${CP.border}`, boxShadow: CP.shadowPop },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          fontWeight: 500,
          borderRadius: 8,
          paddingBlock: 9,
          paddingInline: 12,
          color: CP.ink,
          "&:hover": { backgroundColor: CP.sandSoft },
          "&.Mui-selected": { backgroundColor: CP.sand, "&:hover": { backgroundColor: CP.sand } },
        },
      },
    },
    MuiPopover: {
      styleOverrides: { paper: { borderRadius: 12, border: `1px solid ${CP.border}`, boxShadow: CP.shadowPop } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: CP.ink, color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 500, borderRadius: 8, padding: "6px 10px" },
        arrow: { color: CP.ink },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontSize: "0.875rem", alignItems: "center", border: "1px solid transparent" },
        standard: {
          "&.MuiAlert-colorInfo": { backgroundColor: CP.sand, color: CP.ink, borderColor: "rgba(217,168,75,0.35)", "& .MuiAlert-icon": { color: CP.goldDeep } },
          "&.MuiAlert-colorSuccess": { backgroundColor: CP.successBg, color: CP.successFg },
          "&.MuiAlert-colorWarning": { backgroundColor: CP.warningBg, color: CP.warningFg },
          "&.MuiAlert-colorError": { backgroundColor: CP.errorBg, color: CP.errorFg },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 8, backgroundColor: CP.sand },
        bar: { borderRadius: 999, backgroundColor: CP.gold },
      },
    },
    MuiCircularProgress: { styleOverrides: { root: { color: v.accent } } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: CP.sandSoft, borderRadius: 10 } } },
    MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: CP.ink, color: "#FFFFFF", borderRadius: 12, fontSize: "0.875rem" } } },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: false },
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          borderTop: `1px solid ${CP.border}`,
          "&::before": { display: "none" },
          "&:last-of-type": { borderBottom: `1px solid ${CP.border}` },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: CP.border } } },
    MuiAvatar: { styleOverrides: { root: { fontFamily: PORTAL_FONT, fontWeight: 700 } } },
    MuiListItemIcon: { styleOverrides: { root: { color: CP.muted, minWidth: 34 } } },
    MuiListItemText: {
      styleOverrides: {
        primary: { fontSize: "0.875rem", fontWeight: 500, color: CP.ink },
        secondary: { fontSize: "0.75rem", color: CP.muted },
      },
    },
    MuiLink: { defaultProps: { underline: "hover" }, styleOverrides: { root: { color: v.accent, fontWeight: 600 } } },
    MuiSlider: {
      styleOverrides: {
        thumb: { width: 16, height: 16, backgroundColor: "#FFFFFF", border: `2px solid ${v.accent}`, boxShadow: "none" },
        track: { border: "none", height: 4, backgroundColor: CP.gold },
        rail: { opacity: 1, backgroundColor: CP.sand, height: 4 },
      },
    },
  },
  });
}

/** Company portal theme (the default). */
export const communityPortalTheme = createCommunityPortalTheme(COMMUNITY_VARIANTS.company);
/** Expert portal theme: forest sidebar, green accent, cooler canvas. */
export const expertPortalTheme = createCommunityPortalTheme(COMMUNITY_VARIANTS.expert);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CommunityNavItem = {
  href: string;
  label: string;
  icon?: React.ElementType<{ sx?: object }>;
  /** Small count shown at the end of the row. */
  badge?: number;
};

export type CommunityNavGroup = {
  /** Tiny gray section label, e.g. "Workspace". Omit for an unlabelled group. */
  label?: string;
  items: CommunityNavItem[];
};

export type CommunityIdentity = {
  name: string;
  subline?: string;
  avatarUrl?: string | null;
  initials: string;
  /** Status pill under the name, e.g. "Verified company". */
  status?: { label: string; tone: "success" | "warning" | "neutral" | "gold" };
};

export function isCommunityPathActive(itemHref: string, pathname: string, rootHref: string): boolean {
  if (itemHref === rootHref) return pathname === rootHref;
  return pathname.startsWith(itemHref);
}

/* ------------------------------------------------------------------ */
/* Page-title context                                                  */
/* ------------------------------------------------------------------ */

type TitleContextValue = {
  /** Title currently shown in the top bar. */
  title: string;
  /** Pages override the nav label (e.g. "Create offer" while on /offers/new). */
  setTitle: (title: string | null) => void;
};

const TitleContext = createContext<TitleContextValue | null>(null);

/** Lets another shell provide the top-bar title context PageHeader writes to. */
export const PortalTitleProvider = TitleContext.Provider;
export type PortalTitleContextValue = TitleContextValue;

/** Read the shell context. `null` outside a CommunityPortalShell. */
export function useCommunityPortalTitle(): TitleContextValue | null {
  return useContext(TitleContext);
}

/**
 * Sets the top-bar title for as long as the calling component is mounted.
 * Returns true when a shell is present (so the page can skip its own h1).
 */
export function usePortalPageTitle(title: string | undefined): boolean {
  const ctx = useContext(TitleContext);
  const setTitle = ctx?.setTitle;
  useEffect(() => {
    if (!setTitle || !title) return;
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);
  return !!ctx;
}

/* ------------------------------------------------------------------ */
/* Top-bar buttons                                                     */
/* ------------------------------------------------------------------ */

/** 36px circular white icon button with a 1px border (help, bell, etc.), in a variant's accent. */
export function communityIconButtonSxFor(v: CommunityVariantTokens): SxProps<Theme> {
  return {
    width: 36,
    height: 36,
    borderRadius: "50%",
    bgcolor: CP.white,
    border: `1px solid ${CP.borderStrong}`,
    color: v.accent,
    boxShadow: "0 1px 2px rgba(10,19,32,0.04)",
    "&:hover": { bgcolor: CP.sandSoft, color: v.accent, borderColor: v.accent },
    "&:focus-visible": { outline: `2px solid ${v.accent}`, outlineOffset: 2 },
  };
}

/** 36px circular white icon button with a 1px border (help, bell, etc.). */
export const communityIconButtonSx: SxProps<Theme> = communityIconButtonSxFor(COMMUNITY_VARIANTS.company);

/** Pill button used for the company switcher and "View as expert", in a variant's accent. */
export function communityPillButtonSxFor(v: CommunityVariantTokens): SxProps<Theme> {
  return {
    minHeight: 36,
    borderRadius: 999,
    px: 1.5,
    fontSize: "0.8125rem",
    fontWeight: 600,
    bgcolor: CP.white,
    borderColor: v.accent,
    color: v.accent,
    boxShadow: "0 1px 2px rgba(10,19,32,0.04)",
    "&:hover": { bgcolor: CP.sandSoft, borderColor: v.accent, transform: "none", boxShadow: "0 1px 2px rgba(10,19,32,0.04)" },
  };
}

/** Pill button used for the company switcher and "View as expert". */
export const communityPillButtonSx: SxProps<Theme> = communityPillButtonSxFor(COMMUNITY_VARIANTS.company);

export function CommunityAvatarButton({
  anchorRef,
  onClick,
  open,
  src,
  initials,
  name,
}: {
  anchorRef: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  open?: boolean;
  src?: string | null;
  initials: string;
  name: string;
}) {
  const v = useCommunityVariant();
  return (
    <Box
      ref={anchorRef}
      component="button"
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open ? "true" : "false"}
      aria-label={`Account menu for ${name}`}
      title={name}
      sx={{
        width: 36,
        height: 36,
        p: 0,
        borderRadius: "50%",
        bgcolor: CP.white,
        border: `1px solid ${open ? v.accent : CP.borderStrong}`,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 1px 2px rgba(10,19,32,0.04)",
        transition: "border-color 140ms ease, box-shadow 140ms ease",
        "&:hover": { borderColor: v.accent, boxShadow: CP.shadow },
        "&:focus-visible": { outline: `2px solid ${v.accent}`, outlineOffset: 2 },
      }}
    >
      <Avatar
        src={src ?? undefined}
        sx={{ width: 30, height: 30, bgcolor: v.sidebar, color: CP.gold, fontSize: "0.6875rem", fontWeight: 700 }}
      >
        {initials}
      </Avatar>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar pieces                                                      */
/* ------------------------------------------------------------------ */

function CommunityCard({ href, portalName }: { href: string; portalName: string }) {
  return (
    <Box
      component={Link}
      href={href}
      aria-label="Aesthetic Success Network"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.25,
        borderRadius: "12px",
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
        bgcolor: CP.sidebarPanel,
        border: `1px solid ${CP.sidebarLine}`,
        transition: "background-color 140ms ease, transform 140ms ease",
        "&:hover": { bgcolor: "rgba(255,255,255,0.10)", transform: "translateY(-1px)" },
        "&:focus-visible": { outline: `2px solid ${CP.gold}`, outlineOffset: 3 },
      }}
    >
      <Box sx={{ position: "relative", width: 40, height: 40, borderRadius: "10px", overflow: "hidden", flexShrink: 0 }}>
        <Image src="/asn-nav-icon.png" alt="" fill sizes="40px" style={{ objectFit: "cover" }} priority />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: CP.ivory,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Aesthetic Success Network
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: CP.ivory55, lineHeight: 1.2, mt: 0.25 }}>{portalName}</Typography>
      </Box>
    </Box>
  );
}

function NavRow({ item, active, onNavigate }: { item: CommunityNavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const v = useCommunityVariant();
  return (
    <Box
      component={Link}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        pl: 1.75,
        pr: 1.25,
        height: 40,
        borderRadius: `${CP.radiusSm}px`,
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: active ? 600 : 500,
        color: active ? "#FFFFFF" : CP.ivory80,
        bgcolor: active ? v.activeFill : "transparent",
        transition: "background-color 140ms ease, color 140ms ease",
        "&:hover": { bgcolor: active ? v.activeHoverFill : "rgba(255,255,255,0.05)", color: "#FFFFFF" },
        "&:focus-visible": { outline: `2px solid ${CP.gold}`, outlineOffset: -2 },
        "&::before": {
          content: '""',
          position: "absolute",
          left: 6,
          top: "50%",
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: CP.gold,
          transform: `translateY(-50%) scale(${active ? 1 : 0})`,
          transition: "transform 140ms ease",
        },
      }}
    >
      {Icon && <Icon sx={{ fontSize: 18, color: active ? CP.ivory : CP.ivory80, flexShrink: 0 }} />}
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.label}
      </Box>
      {item.badge && item.badge > 0 ? (
        <Box
          component="span"
          sx={{
            px: 0.75,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            fontSize: "0.6875rem",
            fontWeight: 700,
            display: "inline-grid",
            placeItems: "center",
            bgcolor: CP.gold,
            color: CP.ink,
          }}
        >
          {item.badge}
        </Box>
      ) : null}
    </Box>
  );
}

function StatusPillSmall({ label, tone }: { label: string; tone: "success" | "warning" | "neutral" | "gold" }) {
  const palette =
    tone === "success"
      ? { bg: CP.successBg, fg: CP.successFg }
      : tone === "warning"
        ? { bg: CP.warningBg, fg: CP.warningFg }
        : tone === "gold"
          ? { bg: CP.goldTint, fg: CP.goldText }
          : { bg: CP.neutralBg, fg: CP.neutralFg };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.75,
        height: 18,
        borderRadius: 999,
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: "0.625rem",
        fontWeight: 700,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

function SidebarBody({
  homeHref,
  groups,
  pathname,
  portalName,
  identity,
  onIdentityClick,
  sidebarFooter,
  onSignOut,
  onNavigate,
  onClose,
}: {
  homeHref: string;
  groups: CommunityNavGroup[];
  pathname: string;
  portalName: string;
  identity?: CommunityIdentity;
  onIdentityClick?: () => void;
  sidebarFooter?: React.ReactNode;
  onSignOut?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CommunityCard href={homeHref} portalName={portalName} />
        </Box>
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close navigation" sx={{ flexShrink: 0, color: CP.ivory80, "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: CP.ivory } }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Stack>

      <Box
        component="nav"
        aria-label={`${portalName} sections`}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          pt: 1,
          pb: 2,
          // Thin, dark-friendly scrollbar that only shows on hover.
          scrollbarWidth: "thin",
          scrollbarColor: "transparent transparent",
          "&:hover": { scrollbarColor: "rgba(255,255,255,0.22) transparent" },
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "transparent", borderRadius: 999 },
          "&:hover::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.22)" },
        }}
      >
        <Stack spacing={2.25}>
          {groups.map((group, gi) => (
            <Box key={group.label ?? `group-${gi}`}>
              {group.label && (
                <Typography
                  sx={{ px: 1.75, mb: 0.75, fontSize: "0.6875rem", fontWeight: 600, color: CP.ivory55, letterSpacing: "0.02em" }}
                >
                  {group.label}
                </Typography>
              )}
              <Stack spacing={0.25}>
                {group.items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isCommunityPathActive(item.href, pathname, homeHref)}
                    onNavigate={onNavigate}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ borderTop: `1px solid ${CP.sidebarLine}`, px: 1.5, py: 1.5, flexShrink: 0 }}>
        {identity && (
          <Box
            component={onIdentityClick ? "button" : "div"}
            type={onIdentityClick ? "button" : undefined}
            onClick={onIdentityClick}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              width: "100%",
              px: 1.25,
              py: 1,
              mb: 0.75,
              borderRadius: `${CP.radiusSm}px`,
              border: `1px solid ${CP.sidebarLine}`,
              bgcolor: CP.sidebarPanel,
              textAlign: "left",
              fontFamily: "inherit",
              cursor: onIdentityClick ? "pointer" : "default",
              "&:hover": onIdentityClick ? { bgcolor: "rgba(255,255,255,0.10)" } : {},
              "&:focus-visible": { outline: `2px solid ${CP.gold}`, outlineOffset: 2 },
            }}
          >
            <Avatar
              src={identity.avatarUrl ?? undefined}
              sx={{ width: 34, height: 34, bgcolor: CP.gold, color: CP.ink, fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}
            >
              {identity.initials}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: CP.ivory, lineHeight: 1.2 }} noWrap>
                {identity.name}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 0.4, minWidth: 0 }}>
                {identity.status && <StatusPillSmall label={identity.status.label} tone={identity.status.tone} />}
                {identity.subline && !identity.status && (
                  <Typography sx={{ fontSize: "0.6875rem", color: CP.ivory55, lineHeight: 1.2 }} noWrap>
                    {identity.subline}
                  </Typography>
                )}
              </Stack>
            </Box>
            {onIdentityClick && <KeyboardArrowDownOutlinedIcon sx={{ fontSize: 16, color: CP.ivory55, flexShrink: 0 }} />}
          </Box>
        )}
        {sidebarFooter && <Box sx={{ px: 1.25, mb: 0.75, color: CP.ivory80 }}>{sidebarFooter}</Box>}
        {onSignOut && (
          <Box
            component="button"
            type="button"
            onClick={onSignOut}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              width: "100%",
              pl: 1.75,
              pr: 1.25,
              height: 40,
              borderRadius: `${CP.radiusSm}px`,
              border: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: CP.ivory80,
              textAlign: "left",
              transition: "background-color 140ms ease, color 140ms ease",
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "#FFFFFF" },
              "&:focus-visible": { outline: `2px solid ${CP.gold}`, outlineOffset: -2 },
            }}
          >
            <LogoutOutlinedIcon sx={{ fontSize: 18, color: CP.ivory80 }} />
            Sign out
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export type CommunityPortalShellProps = {
  /** Small line under the network name in the community card, e.g. "Company portal". */
  portalName: string;
  /** Where the community card links to. Also the exact-match root for active state. */
  homeHref: string;
  groups: CommunityNavGroup[];
  pathname: string;
  /** Right side of the top bar: switcher, "View as", help, bell, avatar. */
  topRight?: React.ReactNode;
  /** Identity block at the bottom of the sidebar. */
  identity?: CommunityIdentity;
  /** Clicking the identity block (opens the account menu, for example). */
  onIdentityClick?: () => void;
  /** Small content rendered between the identity block and Sign out. */
  sidebarFooter?: React.ReactNode;
  onSignOut?: () => void;
  /** Optional strip rendered between the top bar and the content (banners). */
  beforeContent?: React.ReactNode;
  supportEmail?: string;
  supportPhone?: string;
  footerLine?: string;
  /** Extra nodes (menus, dialogs) rendered at the root. */
  overlays?: React.ReactNode;
  /** Widest content column, default 1200px. */
  maxWidth?: number;
  /** Look: "company" (default, navy) or "expert" (forest green). */
  variant?: "company" | "expert";
  children: React.ReactNode;
};

export default function CommunityPortalShell({
  portalName,
  homeHref,
  groups,
  pathname,
  topRight,
  identity,
  onIdentityClick,
  sidebarFooter,
  onSignOut,
  beforeContent,
  supportEmail,
  supportPhone = "(855) 567-5323",
  footerLine = "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics",
  overlays,
  maxWidth = CP.contentMax,
  variant = "company",
  children,
}: CommunityPortalShellProps) {
  const theme = useTheme();
  const v = COMMUNITY_VARIANTS[variant];
  const portalTheme = variant === "expert" ? expertPortalTheme : communityPortalTheme;
  const sidebarGradient = `linear-gradient(180deg, ${v.sidebar} 0%, ${v.sidebarEnd} 100%)`;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageTitleOverride, setPageTitleOverride] = useState<string | null>(null);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const activeItem = allItems.find((i) => isCommunityPathActive(i.href, pathname, homeHref));
  const navTitle = activeItem?.label ?? portalName;
  const pageTitle = pageTitleOverride ?? navTitle;

  const titleCtx = useMemo<TitleContextValue>(
    () => ({ title: pageTitle, setTitle: setPageTitleOverride }),
    [pageTitle],
  );

  const phoneDigits = supportPhone ? supportPhone.replace(/[^0-9]/g, "") : "";
  const phoneHref = phoneDigits ? `tel:+${phoneDigits.length === 10 ? `1${phoneDigits}` : phoneDigits}` : undefined;

  const sidebarWidth = CP.sidebarWidth;
  const inset = CP.sidebarInset;

  return (
    <ThemeProvider theme={portalTheme}>
      <VariantContext.Provider value={v}>
      <TitleContext.Provider value={titleCtx}>
        <Box
          className={`asn-community-portal asn-community-portal-${variant} ${portalFontClassName}`}
          sx={{
            minHeight: "100vh",
            bgcolor: v.canvas,
            color: CP.ink,
            fontFamily: PORTAL_FONT,
            display: "flex",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {/* Inset sidebar (md and up). CSS breakpoints keep the server
              render identical to the first client paint. */}
          <Box
            component="aside"
            sx={{
              display: { xs: "none", md: "block" },
              position: "fixed",
              top: inset,
              left: inset,
              bottom: inset,
              width: sidebarWidth,
              bgcolor: v.sidebar,
              backgroundImage: sidebarGradient,
              border: `1px solid ${CP.sidebarLine}`,
              borderRadius: `${CP.radius}px`,
              boxShadow: "0 12px 32px -20px rgba(10,19,32,0.6)",
              overflow: "hidden",
              zIndex: theme.zIndex.appBar,
            }}
          >
            <SidebarBody
              homeHref={homeHref}
              groups={groups}
              pathname={pathname}
              portalName={portalName}
              identity={identity}
              onIdentityClick={onIdentityClick}
              sidebarFooter={sidebarFooter}
              onSignOut={onSignOut}
            />
          </Box>

          {/* Mobile drawer (hamburger only shows below md) */}
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            slotProps={{ paper: { sx: { width: 288, bgcolor: v.sidebar, backgroundImage: sidebarGradient, border: 0 } } }}
          >
            <SidebarBody
              homeHref={homeHref}
              groups={groups}
              pathname={pathname}
              portalName={portalName}
              identity={identity}
              onIdentityClick={
                onIdentityClick
                  ? () => {
                      setDrawerOpen(false);
                      onIdentityClick();
                    }
                  : undefined
              }
              sidebarFooter={sidebarFooter}
              onSignOut={onSignOut}
              onNavigate={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </Drawer>

          {/* Main column */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              ml: { xs: 0, md: `${sidebarWidth + inset * 2}px` },
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
            }}
          >
            {/* Top bar: transparent on the canvas */}
            <Box
              component="header"
              sx={{
                height: CP.topbarHeight,
                display: "flex",
                alignItems: "center",
                px: { xs: 2, md: 4 },
                gap: 2,
                mt: { md: `${inset}px` },
              }}
            >
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  edge="start"
                  aria-label="Open navigation"
                  sx={{ ...communityIconButtonSx, display: { xs: "inline-flex", md: "none" }, ml: 0 }}
                >
                  <MenuOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Typography
                  component="h1"
                  sx={{ fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.02em", color: CP.navy, lineHeight: 1.2 }}
                  noWrap
                >
                  {pageTitle}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
                {topRight}
              </Stack>
            </Box>

            {beforeContent}

            {/* Content */}
            <Box component="main" sx={{ flex: 1, width: "100%" }}>
              <Box sx={{ maxWidth, mx: { xs: "auto", md: 0 }, px: { xs: 2, md: 4 }, pt: { xs: 1, md: 1.5 }, pb: { xs: 3, md: 4 } }}>
                {children}
              </Box>
            </Box>

            {/* Footer */}
            <Box component="footer" sx={{ py: 2.5 }}>
              <Box sx={{ maxWidth, mx: { xs: "auto", md: 0 }, px: { xs: 2, md: 4 } }}>
                <Typography sx={{ fontSize: "0.75rem", color: CP.muted, lineHeight: 1.6 }}>
                  {footerLine}
                  {supportEmail && (
                    <>
                      {" · "}
                      <Box
                        component="a"
                        href={`mailto:${supportEmail}`}
                        sx={{ color: CP.muted, textDecoration: "none", "&:hover": { color: CP.ink, textDecoration: "underline" } }}
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
                        sx={{ color: CP.muted, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { color: CP.ink, textDecoration: "underline" } }}
                      >
                        {supportPhone}
                      </Box>
                    </>
                  )}
                </Typography>
              </Box>
            </Box>
          </Box>

          {overlays}
        </Box>
      </TitleContext.Provider>
      </VariantContext.Provider>
    </ThemeProvider>
  );
}
