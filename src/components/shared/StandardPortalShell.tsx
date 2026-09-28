"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Avatar,
  Box,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";

/**
 * StandardPortalShell
 *
 * The plain, conventional B2B dashboard frame used by the expert and
 * company portals: a fixed white left sidebar (logo, nav, portal label,
 * sign out), a white 56px top bar (page title, bell, avatar menu), a
 * light gray canvas and a one-line footer. On small screens the sidebar
 * becomes a drawer behind a hamburger in the top bar.
 *
 * Purely presentational. Each shell keeps its own data hooks, nav items,
 * menus and billing gates and passes them in. A nested MUI theme sets
 * Inter, 6px radius, navy primary and no shadows for everything rendered
 * inside, so page files only need light styling.
 */

export const STD = {
  canvas: "#F7F7F5",
  white: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  hover: "#F3F4F6",
  hoverSoft: "#F9FAFB",
  ink: "#111827",
  body: "#374151",
  muted: "#6B7280",
  faint: "#9CA3AF",
  navy: "#0E2A3D",
  navyHover: "#0B2232",
  navyTint: "rgba(14,42,61,0.08)",
  gold: "#D9A84B",
  goldTint: "#FBF3E1",
  goldText: "#7A5B17",
  successBg: "#DCFCE7",
  successFg: "#166534",
  warningBg: "#FEF3C7",
  warningFg: "#92400E",
  errorBg: "#FEE2E2",
  errorFg: "#991B1B",
  neutralBg: "#F3F4F6",
  neutralFg: "#374151",
  sidebarWidth: 240,
  topbarHeight: 56,
  contentMax: 1200,
} as const;

const INTER = "var(--font-body), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Nested theme: Inter everywhere, 6px radius, navy primary, no shadows. */
export const standardPortalTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: STD.navy, dark: STD.navyHover, light: "#1B4258", contrastText: "#FFFFFF" },
    secondary: { main: STD.gold, dark: STD.goldText, light: STD.goldTint, contrastText: STD.ink },
    success: { main: "#15803D", dark: STD.successFg, light: STD.successBg, contrastText: "#FFFFFF" },
    warning: { main: "#B45309", dark: STD.warningFg, light: STD.warningBg, contrastText: "#FFFFFF" },
    error: { main: "#B91C1C", dark: STD.errorFg, light: STD.errorBg, contrastText: "#FFFFFF" },
    info: { main: STD.navy, contrastText: "#FFFFFF" },
    background: { default: STD.canvas, paper: STD.white },
    text: { primary: STD.ink, secondary: STD.muted, disabled: STD.faint },
    divider: STD.border,
    grey: {
      50: STD.hoverSoft,
      100: STD.hover,
      200: STD.border,
      300: STD.borderStrong,
      400: STD.faint,
      500: STD.muted,
      700: STD.body,
      900: STD.ink,
    },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: INTER,
    h1: { fontFamily: INTER, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3, letterSpacing: 0, color: STD.ink },
    h2: { fontFamily: INTER, fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3, letterSpacing: 0, color: STD.ink },
    h3: { fontFamily: INTER, fontSize: "1rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: 0, color: STD.ink },
    h4: { fontFamily: INTER, fontSize: "1rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: 0, color: STD.ink },
    h5: { fontFamily: INTER, fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: 0, color: STD.ink },
    h6: { fontFamily: INTER, fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.4, letterSpacing: 0, color: STD.ink },
    subtitle1: { fontSize: "0.9375rem", lineHeight: 1.5, color: STD.body },
    subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.5, color: STD.ink },
    body1: { fontSize: "0.875rem", lineHeight: 1.6, color: STD.body },
    body2: { fontSize: "0.8125rem", lineHeight: 1.55, color: STD.muted },
    caption: { fontSize: "0.75rem", lineHeight: 1.5, color: STD.muted },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0, fontSize: "0.875rem" },
    overline: {
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: 0,
      lineHeight: 1.5,
      textTransform: "none",
      color: STD.muted,
    },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          minHeight: 36,
          paddingInline: 14,
          paddingBlock: 0,
          fontWeight: 500,
          fontSize: "0.875rem",
          lineHeight: 1.2,
          boxShadow: "none",
          transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
          "&:hover": { transform: "none", boxShadow: "none" },
          "&.MuiButton-containedPrimary": {
            backgroundColor: STD.navy,
            backgroundImage: "none",
            color: "#FFFFFF",
            "&:hover": { backgroundColor: STD.navyHover },
            "&.Mui-disabled": { backgroundColor: STD.border, color: STD.faint },
          },
          "&.MuiButton-containedSecondary": {
            backgroundColor: STD.ink,
            backgroundImage: "none",
            color: "#FFFFFF",
            "&:hover": { backgroundColor: STD.navy },
          },
          "&.MuiButton-containedSuccess": { backgroundColor: "#15803D", color: "#FFFFFF", "&:hover": { backgroundColor: STD.successFg } },
          "&.MuiButton-containedError": { backgroundColor: "#B91C1C", color: "#FFFFFF", "&:hover": { backgroundColor: STD.errorFg } },
          "&.MuiButton-outlined": {
            borderColor: STD.borderStrong,
            color: STD.ink,
            backgroundColor: STD.white,
            "&:hover": { backgroundColor: STD.hoverSoft, borderColor: STD.borderStrong },
            "&.Mui-disabled": { borderColor: STD.border, color: STD.faint },
          },
          "&.MuiButton-outlinedError": { borderColor: "#FCA5A5", color: STD.errorFg, "&:hover": { backgroundColor: STD.errorBg } },
          "&.MuiButton-outlinedSuccess": { borderColor: "#86EFAC", color: STD.successFg, "&:hover": { backgroundColor: STD.successBg } },
          "&.MuiButton-outlinedSecondary": { borderColor: STD.borderStrong, color: STD.ink },
          "&.MuiButton-text": {
            color: STD.navy,
            "&:hover": { backgroundColor: STD.hover, transform: "none" },
          },
          "&.MuiButton-textError": { color: STD.errorFg },
          "&.MuiButton-textSecondary": { color: STD.body },
        },
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: "0.8125rem" },
        sizeLarge: { minHeight: 40, paddingInline: 18, fontSize: "0.9375rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          color: STD.muted,
          "&:hover": { backgroundColor: STD.hover, color: STD.ink },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", backgroundColor: STD.white },
        rounded: { borderRadius: 8 },
        outlined: { borderColor: STD.border },
        elevation1: { boxShadow: "0 1px 2px rgba(17,24,39,0.04)" },
        elevation2: { boxShadow: "0 1px 3px rgba(17,24,39,0.06)" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${STD.border}`,
          backgroundColor: STD.white,
          boxShadow: "none",
          transition: "none",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 24, "&:last-child": { paddingBottom: 24 } } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "default" },
      styleOverrides: {
        root: { backgroundImage: "none", boxShadow: "none" },
        colorDefault: { backgroundColor: STD.white, color: STD.ink },
        colorPrimary: { backgroundColor: STD.white, color: STD.ink },
      },
    },
    MuiToolbar: { styleOverrides: { root: { minHeight: STD.topbarHeight } } },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: STD.white, borderRight: `1px solid ${STD.border}`, backgroundImage: "none" },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true, slotProps: { inputLabel: { shrink: true } } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: STD.white,
          borderRadius: 8,
          minHeight: 40,
          fontSize: "0.875rem",
          color: STD.ink,
          transition: "border-color 120ms ease, box-shadow 120ms ease",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: STD.faint },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: STD.navy, borderWidth: 1 },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(14,42,61,0.12)" },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: "#B91C1C" },
        },
        notchedOutline: { borderColor: STD.borderStrong },
        input: {
          padding: "10px 12px",
          fontSize: "0.875rem",
          "&::placeholder": { color: STD.faint, opacity: 1, fontSize: "0.875rem" },
        },
        sizeSmall: { minHeight: 36, "& .MuiInputBase-input": { padding: "8px 12px", fontSize: "0.875rem" } },
        multiline: {
          padding: 0,
          "& textarea": {
            padding: "10px 12px",
            fontSize: "0.875rem",
            "&::placeholder": { color: STD.faint, opacity: 1 },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: STD.muted,
          fontSize: "0.875rem",
          fontWeight: 500,
          "&.MuiInputLabel-shrink": { color: STD.body, fontWeight: 500 },
          "&.Mui-focused": { color: STD.navy },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 2, marginTop: 6, fontSize: "0.8125rem", color: STD.muted } },
    },
    MuiSelect: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        select: {
          padding: "10px 12px",
          paddingRight: "40px",
          minHeight: "1.4em",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
        },
      },
    },
    MuiCheckbox: { styleOverrides: { root: { color: STD.faint, "&.Mui-checked": { color: STD.navy } } } },
    MuiRadio: { styleOverrides: { root: { color: STD.faint, "&.Mui-checked": { color: STD.navy } } } },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": { color: STD.navy },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: STD.navy },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          letterSpacing: 0,
          fontSize: "0.75rem",
          height: 24,
          backgroundColor: STD.neutralBg,
          color: STD.neutralFg,
        },
        sizeSmall: { height: 20, fontSize: "0.6875rem" },
        label: { paddingInline: 8 },
        filled: {
          "&.MuiChip-colorPrimary": { backgroundColor: STD.navyTint, color: STD.navy },
          "&.MuiChip-colorSecondary": { backgroundColor: STD.goldTint, color: STD.goldText },
          "&.MuiChip-colorSuccess": { backgroundColor: STD.successBg, color: STD.successFg },
          "&.MuiChip-colorError": { backgroundColor: STD.errorBg, color: STD.errorFg },
          "&.MuiChip-colorWarning": { backgroundColor: STD.warningBg, color: STD.warningFg },
          "&.MuiChip-colorInfo": { backgroundColor: STD.navyTint, color: STD.navy },
        },
        outlined: {
          borderColor: STD.borderStrong,
          backgroundColor: "transparent",
          color: STD.body,
          "&.MuiChip-colorPrimary": { borderColor: STD.navy, color: STD.navy },
          "&.MuiChip-colorSecondary": { borderColor: STD.gold, color: STD.goldText },
          "&.MuiChip-colorSuccess": { borderColor: "#86EFAC", color: STD.successFg },
          "&.MuiChip-colorError": { borderColor: "#FCA5A5", color: STD.errorFg },
        },
        deleteIcon: { color: "inherit", opacity: 0.6, "&:hover": { opacity: 1, color: "inherit" } },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorSecondary: { backgroundColor: STD.navy, color: "#FFFFFF" },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 8, border: `1px solid ${STD.border}`, backgroundColor: STD.white },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            backgroundColor: STD.white,
            color: STD.muted,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: "none",
            borderBottom: `1px solid ${STD.border}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${STD.border}`, fontSize: "0.875rem", color: STD.ink, padding: "12px 16px" },
        sizeSmall: { padding: "8px 12px" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child .MuiTableCell-root": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": { backgroundColor: STD.hoverSoft },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
        indicator: { height: 2, borderRadius: 0, backgroundColor: STD.navy },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          minHeight: 40,
          paddingInline: 12,
          color: STD.muted,
          "&.Mui-selected": { color: STD.ink, fontWeight: 600 },
          "&:hover": { color: STD.ink },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          border: `1px solid ${STD.border}`,
          boxShadow: "0 10px 30px -10px rgba(17,24,39,0.2)",
          backgroundImage: "none",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: INTER,
          fontWeight: 600,
          fontSize: "1rem",
          letterSpacing: 0,
          color: STD.ink,
          padding: "20px 24px 8px",
        },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: "8px 24px 16px" } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "12px 24px 20px", gap: 8 } } },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: "rgba(17,24,39,0.4)", backdropFilter: "none" },
        invisible: { backgroundColor: "transparent" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          border: `1px solid ${STD.border}`,
          boxShadow: "0 4px 16px -4px rgba(17,24,39,0.12)",
        },
        list: { paddingBlock: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          borderRadius: 4,
          marginInline: 4,
          paddingBlock: 8,
          color: STD.ink,
          "&:hover": { backgroundColor: STD.hover },
          "&.Mui-selected": { backgroundColor: STD.navyTint, "&:hover": { backgroundColor: STD.navyTint } },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 8, border: `1px solid ${STD.border}`, boxShadow: "0 4px 16px -4px rgba(17,24,39,0.12)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: STD.ink, color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 500, borderRadius: 6, padding: "6px 10px" },
        arrow: { color: STD.ink },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 6, fontSize: "0.875rem", alignItems: "center" },
        standard: {
          "&.MuiAlert-colorInfo": { backgroundColor: STD.navyTint, color: STD.navy },
          "&.MuiAlert-colorSuccess": { backgroundColor: STD.successBg, color: STD.successFg },
          "&.MuiAlert-colorWarning": { backgroundColor: STD.warningBg, color: STD.warningFg },
          "&.MuiAlert-colorError": { backgroundColor: STD.errorBg, color: STD.errorFg },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, backgroundColor: STD.hover },
        bar: { borderRadius: 4, backgroundColor: STD.navy },
      },
    },
    MuiCircularProgress: { styleOverrides: { root: { color: STD.navy } } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: STD.hover, borderRadius: 6 } } },
    MuiSnackbarContent: {
      styleOverrides: { root: { backgroundColor: STD.ink, color: "#FFFFFF", borderRadius: 8, fontSize: "0.875rem" } },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: false },
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          borderTop: `1px solid ${STD.border}`,
          "&::before": { display: "none" },
          "&:last-of-type": { borderBottom: `1px solid ${STD.border}` },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: STD.border } } },
    MuiAvatar: { styleOverrides: { root: { fontFamily: INTER, fontWeight: 600 } } },
    MuiListItemIcon: { styleOverrides: { root: { color: STD.muted, minWidth: 34 } } },
    MuiListItemText: {
      styleOverrides: {
        primary: { fontSize: "0.875rem", fontWeight: 500, color: STD.ink },
        secondary: { fontSize: "0.75rem", color: STD.muted },
      },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: { root: { color: STD.navy, fontWeight: 500 } },
    },
    MuiSlider: {
      styleOverrides: {
        thumb: { width: 16, height: 16, backgroundColor: "#FFFFFF", border: `2px solid ${STD.navy}`, boxShadow: "none" },
        track: { border: "none", height: 4, backgroundColor: STD.navy },
        rail: { opacity: 1, backgroundColor: STD.border, height: 4 },
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type StandardNavItem = {
  href: string;
  label: string;
  icon?: React.ElementType<{ sx?: object }>;
  /** Small count shown at the end of the row. */
  badge?: number;
};

export function isStandardPathActive(itemHref: string, pathname: string, rootHref: string): boolean {
  if (itemHref === rootHref) return pathname === rootHref;
  return pathname.startsWith(itemHref);
}

/* ------------------------------------------------------------------ */
/* Avatar button used in the top bar                                   */
/* ------------------------------------------------------------------ */

export function StandardAvatarButton({
  anchorRef,
  onClick,
  open,
  src,
  initials,
  name,
  subline,
}: {
  anchorRef: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  open?: boolean;
  src?: string | null;
  initials: string;
  name: string;
  subline?: string;
}) {
  return (
    <Box
      ref={anchorRef}
      component="button"
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open ? "true" : "false"}
      aria-label="Account menu"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 0.5,
        pr: { xs: 0.5, sm: 1 },
        py: 0.5,
        bgcolor: "transparent",
        border: "1px solid transparent",
        borderRadius: "6px",
        cursor: "pointer",
        color: STD.ink,
        fontFamily: "inherit",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": { bgcolor: STD.hover },
        "&:focus-visible": { outline: `2px solid ${STD.navy}`, outlineOffset: 2 },
      }}
    >
      <Avatar
        src={src ?? undefined}
        sx={{
          width: 30,
          height: 30,
          bgcolor: STD.navyTint,
          color: STD.navy,
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        {initials}
      </Avatar>
      <Box sx={{ display: { xs: "none", lg: "block" }, textAlign: "left", minWidth: 0, maxWidth: 180 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.15, color: STD.ink }} noWrap>
          {name}
        </Typography>
        {subline && (
          <Typography sx={{ fontSize: "0.75rem", color: STD.muted, lineHeight: 1.2 }} noWrap>
            {subline}
          </Typography>
        )}
      </Box>
      <KeyboardArrowDownOutlinedIcon
        sx={{
          fontSize: 16,
          color: STD.muted,
          display: { xs: "none", sm: "block" },
          transition: "transform 150ms ease",
          transform: open ? "rotate(180deg)" : "rotate(0)",
        }}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar pieces                                                      */
/* ------------------------------------------------------------------ */

function Brand({ href }: { href: string }) {
  return (
    <Box
      component={Link}
      href={href}
      aria-label="Aesthetic Success Network"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
        "&:focus-visible": { outline: `2px solid ${STD.navy}`, outlineOffset: 3, borderRadius: 6 },
      }}
    >
      <Box sx={{ position: "relative", width: 28, height: 28, borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
        <Image src="/asn-nav-icon.png" alt="" fill sizes="28px" style={{ objectFit: "cover" }} priority />
      </Box>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: STD.ink,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Aesthetic Success Network
      </Typography>
    </Box>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: StandardNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Box
      component={Link}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.25,
        height: 36,
        borderRadius: "6px",
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: 500,
        color: active ? STD.navy : STD.body,
        bgcolor: active ? STD.hover : "transparent",
        transition: "background-color 120ms ease, color 120ms ease",
        "&:hover": { bgcolor: STD.hover, color: STD.ink },
        "&:focus-visible": { outline: `2px solid ${STD.navy}`, outlineOffset: -2 },
      }}
    >
      {Icon && <Icon sx={{ fontSize: 18, color: active ? STD.navy : STD.muted, flexShrink: 0 }} />}
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
            borderRadius: "6px",
            fontSize: "0.6875rem",
            fontWeight: 600,
            display: "inline-grid",
            placeItems: "center",
            bgcolor: STD.navyTint,
            color: STD.navy,
          }}
        >
          {item.badge}
        </Box>
      ) : null}
    </Box>
  );
}

function SidebarBody({
  homeHref,
  items,
  pathname,
  portalName,
  sidebarFooter,
  onSignOut,
  onNavigate,
  onClose,
}: {
  homeHref: string;
  items: StandardNavItem[];
  pathname: string;
  portalName: string;
  sidebarFooter?: React.ReactNode;
  onSignOut?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", height: STD.topbarHeight, px: 2, flexShrink: 0 }}
      >
        <Brand href={homeHref} />
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close navigation">
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Stack>
      <Box component="nav" aria-label={`${portalName} sections`} sx={{ flex: 1, overflowY: "auto", px: 1.5, pt: 1, pb: 2 }}>
        <Stack spacing={0.25}>
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isStandardPathActive(item.href, pathname, homeHref)}
              onNavigate={onNavigate}
            />
          ))}
        </Stack>
      </Box>
      <Box sx={{ borderTop: `1px solid ${STD.border}`, px: 1.5, py: 1.5, flexShrink: 0 }}>
        <Typography sx={{ px: 1.25, fontSize: "0.75rem", fontWeight: 500, color: STD.muted, mb: sidebarFooter ? 0.75 : 0.5 }}>
          {portalName}
        </Typography>
        {sidebarFooter && <Box sx={{ px: 1.25, mb: 0.75 }}>{sidebarFooter}</Box>}
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
              px: 1.25,
              height: 36,
              borderRadius: "6px",
              border: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: STD.body,
              textAlign: "left",
              "&:hover": { bgcolor: STD.hover, color: STD.ink },
              "&:focus-visible": { outline: `2px solid ${STD.navy}`, outlineOffset: -2 },
            }}
          >
            <LogoutOutlinedIcon sx={{ fontSize: 18, color: STD.muted }} />
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

export type StandardPortalShellProps = {
  /** Label at the bottom of the sidebar and in the top-bar breadcrumb, e.g. "Expert portal". */
  portalName: string;
  /** Where the logo links to. Also the exact-match root for active state. */
  homeHref: string;
  items: StandardNavItem[];
  pathname: string;
  /** Right side of the top bar: switch buttons, help, bell, avatar button. */
  topRight?: React.ReactNode;
  /** Small content rendered above the sign-out button in the sidebar. */
  sidebarFooter?: React.ReactNode;
  /** Sidebar "Sign out" handler. */
  onSignOut?: () => void;
  /** Optional strip rendered between the top bar and the content (banners). */
  beforeContent?: React.ReactNode;
  /** Support email shown in the footer. */
  supportEmail?: string;
  /** Support phone shown in the footer. */
  supportPhone?: string;
  /** Footer brand line. */
  footerLine?: string;
  /** Extra nodes (menus, dialogs) rendered at the root. */
  overlays?: React.ReactNode;
  /** Widest content column, default 1200px. */
  maxWidth?: number;
  children: React.ReactNode;
};

export default function StandardPortalShell({
  portalName,
  homeHref,
  items,
  pathname,
  topRight,
  sidebarFooter,
  onSignOut,
  beforeContent,
  supportEmail,
  supportPhone = "(855) 567-5323",
  footerLine = "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics",
  overlays,
  maxWidth = STD.contentMax,
  children,
}: StandardPortalShellProps) {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeItem = items.find((i) => isStandardPathActive(i.href, pathname, homeHref));
  const pageTitle = activeItem?.label ?? portalName;
  const phoneDigits = supportPhone ? supportPhone.replace(/[^0-9]/g, "") : "";
  const phoneHref = phoneDigits ? `tel:+${phoneDigits.length === 10 ? `1${phoneDigits}` : phoneDigits}` : undefined;

  return (
    <ThemeProvider theme={standardPortalTheme}>
      <Box
        className="asn-standard-portal"
        sx={{
          minHeight: "100vh",
          bgcolor: STD.canvas,
          color: STD.ink,
          fontFamily: INTER,
          display: "flex",
        }}
      >
        {/* Fixed sidebar (md and up). CSS breakpoints, not a JS media
            query, so the server render already matches the viewport. */}
        <Box
          component="aside"
          sx={{
            display: { xs: "none", md: "block" },
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: STD.sidebarWidth,
            bgcolor: STD.white,
            borderRight: `1px solid ${STD.border}`,
            zIndex: theme.zIndex.appBar,
          }}
        >
          <SidebarBody
            homeHref={homeHref}
            items={items}
            pathname={pathname}
            portalName={portalName}
            sidebarFooter={sidebarFooter}
            onSignOut={onSignOut}
          />
        </Box>

        {/* Mobile drawer (opened by the hamburger, which only shows below md) */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{ paper: { sx: { width: 280, bgcolor: STD.white, border: 0 } } }}
        >
          <SidebarBody
            homeHref={homeHref}
            items={items}
            pathname={pathname}
            portalName={portalName}
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
            ml: { xs: 0, md: `${STD.sidebarWidth}px` },
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
          }}
        >
          {/* Top bar */}
          <Box
            component="header"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: theme.zIndex.appBar - 1,
              height: STD.topbarHeight,
              bgcolor: STD.white,
              borderBottom: `1px solid ${STD.border}`,
              display: "flex",
              alignItems: "center",
              px: { xs: 2, md: 3 },
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
              <IconButton
                onClick={() => setDrawerOpen(true)}
                edge="start"
                size="small"
                aria-label="Open navigation"
                sx={{ display: { xs: "inline-flex", md: "none" } }}
              >
                <MenuOutlinedIcon sx={{ fontSize: 22 }} />
              </IconButton>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
                <Typography
                  sx={{ fontSize: "0.875rem", color: STD.muted, display: { xs: "none", sm: "block" }, whiteSpace: "nowrap" }}
                >
                  {portalName}
                </Typography>
                <Typography sx={{ fontSize: "0.875rem", color: STD.faint, display: { xs: "none", sm: "block" } }}>/</Typography>
                <Typography component="h1" sx={{ fontSize: "0.9375rem", fontWeight: 600, color: STD.ink }} noWrap>
                  {pageTitle}
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
              {topRight}
            </Stack>
          </Box>

          {beforeContent}

          {/* Content */}
          <Box component="main" sx={{ flex: 1, width: "100%" }}>
            <Box sx={{ maxWidth, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 } }}>{children}</Box>
          </Box>

          {/* Footer */}
          <Box component="footer" sx={{ borderTop: `1px solid ${STD.border}`, py: 2, mt: 2 }}>
            <Box sx={{ maxWidth, mx: "auto", px: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
              >
                <Typography sx={{ fontSize: "0.75rem", color: STD.muted }}>{footerLine}</Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
                  {supportEmail && (
                    <Box
                      component="a"
                      href={`mailto:${supportEmail}`}
                      sx={{ fontSize: "0.75rem", color: STD.muted, textDecoration: "none", "&:hover": { color: STD.ink, textDecoration: "underline" } }}
                    >
                      {supportEmail}
                    </Box>
                  )}
                  {supportPhone && (
                    <Box
                      component="a"
                      href={phoneHref}
                      sx={{ fontSize: "0.75rem", color: STD.muted, textDecoration: "none", "&:hover": { color: STD.ink, textDecoration: "underline" } }}
                    >
                      {supportPhone}
                    </Box>
                  )}
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Box>

        {overlays}
      </Box>
    </ThemeProvider>
  );
}
