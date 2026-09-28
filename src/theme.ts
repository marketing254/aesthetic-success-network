"use client";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";

/**
 * Aesthetic Success Network MUI theme.
 *
 * Ivory canvas, navy ink, gold accents, clay hairlines, white cards. The
 * component overrides below carry most of the portal look (buttons, cards,
 * chips, inputs, tables, tabs, dialogs) so page files can stay light.
 */
const COLORS = {
  ink: "#0A1320",
  inkSoft: "#3B4A55",
  muted: "#5C6770",
  faint: "#7A8590",
  /** Ivory canvas (portal page background). */
  surface: "#F6F1E7",
  /** Cream (table header rows, recessed bands). */
  surfaceAlt: "#FBF8F1",
  /** Clay hairline. */
  line: "#E0DACE",
  primary: "#0E2A3D",
  primaryDark: "#06182A",
  primaryDeep: "#020A14",
  accent: "#D9A84B",
  accentBright: "#F0C16E",
  accentDeep: "#A07823",
  /** Portal accents (chips, active tab underline, small marks only). */
  expert: "#2C7A52",
  expertDark: "#1F5238",
  company: "#6E3346",
  companyDark: "#4A2030",
  admin: "#8C1D1D",
};

const DISPLAY = "var(--font-display), 'Fraunces', Georgia, serif";
const BODY = "var(--font-body), 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

let theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: COLORS.primary, dark: COLORS.primaryDark, light: "#1B4258", contrastText: "#FFFFFF" },
    secondary: { main: COLORS.accent, light: COLORS.accentBright, dark: COLORS.accentDeep, contrastText: COLORS.ink },
    success: { main: COLORS.expert, dark: COLORS.expertDark, contrastText: "#FFFFFF" },
    error: { main: COLORS.admin, dark: "#6B1414", contrastText: "#FFFFFF" },
    warning: { main: COLORS.accentDeep, light: COLORS.accentBright, contrastText: COLORS.ink },
    info: { main: COLORS.primary, contrastText: "#FFFFFF" },
    background: { default: COLORS.surface, paper: "#FFFFFF" },
    text: { primary: COLORS.ink, secondary: COLORS.muted, disabled: "#9C9485" },
    divider: COLORS.line,
    grey: {
      50: "#FBF8F1",
      100: "#F6F1E7",
      200: "#E0DACE",
      300: "#C5BDAB",
      400: "#9C9485",
      500: "#5C6770",
      900: "#0A1320",
    },
  },
  shape: { borderRadius: 9 },
  typography: {
    fontFamily: BODY,
    h1: {
      fontFamily: DISPLAY,
      fontWeight: 500,
      letterSpacing: "-0.03em",
      lineHeight: 1.02,
      fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)",
      color: COLORS.ink,
    },
    h2: {
      fontFamily: DISPLAY,
      fontWeight: 500,
      letterSpacing: "-0.025em",
      lineHeight: 1.08,
      fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)",
      color: COLORS.ink,
    },
    h3: {
      fontFamily: DISPLAY,
      fontWeight: 500,
      letterSpacing: "-0.02em",
      lineHeight: 1.12,
      fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
      color: COLORS.ink,
    },
    h4: {
      fontFamily: DISPLAY,
      fontWeight: 500,
      fontSize: "1.4rem",
      letterSpacing: "-0.015em",
      lineHeight: 1.2,
      color: COLORS.ink,
    },
    h5: {
      fontFamily: DISPLAY,
      fontWeight: 500,
      fontSize: "1.15rem",
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
      color: COLORS.ink,
    },
    h6: {
      fontWeight: 600,
      fontSize: "0.9rem",
      letterSpacing: "0.02em",
      lineHeight: 1.35,
      color: COLORS.ink,
    },
    subtitle1: { fontSize: "1.05rem", lineHeight: 1.6, color: COLORS.inkSoft },
    subtitle2: { fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.5, color: COLORS.ink },
    body1: { fontSize: "0.95rem", lineHeight: 1.65, color: COLORS.inkSoft },
    body2: { fontSize: "0.875rem", lineHeight: 1.6, color: COLORS.muted },
    caption: { fontSize: "0.75rem", lineHeight: 1.5, color: COLORS.faint },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    // Eyebrow: uppercase, letter-spaced, gold-deep. Pages use variant="overline"
    // above their H1/H2 so the pattern is consistent portal-wide.
    overline: {
      fontWeight: 700,
      letterSpacing: "0.16em",
      fontSize: "0.68rem",
      lineHeight: 1.6,
      textTransform: "uppercase",
      color: COLORS.accentDeep,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: COLORS.surface,
          color: COLORS.ink,
        },
      },
    },

    /* Buttons: pills. Primary = gold with navy text. Outlined = navy outline. */
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 20,
          paddingBlock: 10,
          fontWeight: 600,
          fontSize: "0.9rem",
          lineHeight: 1.3,
          transition:
            "transform 200ms cubic-bezier(.2,.8,.2,1), background-color 200ms ease, box-shadow 200ms ease, border-color 200ms ease, color 200ms ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&.Mui-disabled": { transform: "none" },
          "&.MuiButton-containedPrimary": {
            backgroundColor: COLORS.accent,
            backgroundImage: "none",
            color: COLORS.ink,
            boxShadow: "0 8px 20px -12px rgba(160,120,35,0.55)",
            "&:hover": {
              backgroundColor: "#E2B45A",
              boxShadow: "0 14px 28px -14px rgba(160,120,35,0.6)",
            },
            "&:active": { backgroundColor: "#CC9B3F" },
            "&.Mui-disabled": {
              backgroundColor: "#EAD9B3",
              color: "rgba(10,19,32,0.45)",
              boxShadow: "none",
            },
          },
          "&.MuiButton-containedSecondary": {
            backgroundColor: COLORS.ink,
            backgroundImage: "none",
            color: "#FFFFFF",
            boxShadow: "0 8px 20px -12px rgba(10,19,32,0.5)",
            "&:hover": { backgroundColor: COLORS.primary },
            "&.Mui-disabled": {
              backgroundColor: "#B9BEC4",
              color: "rgba(255,255,255,0.7)",
              boxShadow: "none",
            },
          },
          "&.MuiButton-containedSuccess": {
            backgroundColor: COLORS.expert,
            color: "#FFFFFF",
            "&:hover": { backgroundColor: COLORS.expertDark },
          },
          "&.MuiButton-containedError": {
            backgroundColor: COLORS.admin,
            color: "#FFFFFF",
            "&:hover": { backgroundColor: "#6B1414" },
          },
          "&.MuiButton-outlined": {
            borderColor: COLORS.ink,
            color: COLORS.ink,
            backgroundColor: "transparent",
            "&:hover": { backgroundColor: "rgba(10,19,32,0.05)", borderColor: COLORS.ink },
          },
          "&.MuiButton-outlinedSecondary": {
            borderColor: COLORS.accentDeep,
            color: COLORS.accentDeep,
            "&:hover": { backgroundColor: "rgba(217,168,75,0.10)" },
          },
          "&.MuiButton-outlinedError": {
            borderColor: COLORS.admin,
            color: COLORS.admin,
            "&:hover": { backgroundColor: "rgba(140,29,29,0.06)" },
          },
          "&.MuiButton-outlinedSuccess": {
            borderColor: COLORS.expert,
            color: COLORS.expertDark,
            "&:hover": { backgroundColor: "rgba(44,122,82,0.06)" },
          },
          "&.MuiButton-text": {
            color: COLORS.ink,
            "&:hover": { backgroundColor: "rgba(10,19,32,0.05)", transform: "none" },
          },
          "&.MuiButton-textError": { color: COLORS.admin },
          "&.MuiButton-textSecondary": { color: COLORS.accentDeep },
        },
        sizeSmall: { paddingInline: 14, paddingBlock: 6, fontSize: "0.82rem" },
        sizeLarge: { paddingInline: 28, paddingBlock: 13, fontSize: "0.98rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          color: COLORS.inkSoft,
          "&:hover": { backgroundColor: "rgba(10,19,32,0.06)" },
        },
      },
    },

    /* Surfaces */
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#FFFFFF",
        },
        rounded: { borderRadius: 18 },
        outlined: { borderColor: COLORS.line },
        elevation1: { boxShadow: "0 1px 2px rgba(10,19,32,0.04), 0 14px 32px -24px rgba(10,19,32,0.18)" },
        elevation2: { boxShadow: "0 1px 2px rgba(10,19,32,0.05), 0 18px 40px -24px rgba(10,19,32,0.22)" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${COLORS.line}`,
          backgroundColor: "#FFFFFF",
          boxShadow: "0 1px 2px rgba(10,19,32,0.03), 0 14px 32px -26px rgba(10,19,32,0.16)",
          transition: "border-color 220ms ease, box-shadow 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1)",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 22, "&:last-child": { paddingBottom: 22 } } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "default" },
      styleOverrides: {
        root: { backgroundImage: "none", boxShadow: "none" },
        colorDefault: { backgroundColor: COLORS.ink, color: "#FFFFFF" },
        colorPrimary: { backgroundColor: COLORS.ink, color: "#FFFFFF" },
        colorTransparent: { backgroundColor: "transparent", color: COLORS.ink },
      },
    },
    MuiToolbar: {
      styleOverrides: { root: { minHeight: 60 } },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
      styleOverrides: { root: { paddingInline: 20 } },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: COLORS.surfaceAlt,
          borderRight: `1px solid ${COLORS.line}`,
          backgroundImage: "none",
        },
      },
    },

    /* Inputs */
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        fullWidth: true,
        slotProps: { inputLabel: { shrink: true } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          minHeight: 48,
          fontSize: "0.92rem",
          transition: "background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#B9AE97" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: COLORS.accentDeep,
            borderWidth: 1.5,
          },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(217,168,75,0.18)" },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: COLORS.admin },
        },
        notchedOutline: { borderColor: COLORS.line, transition: "border-color 200ms ease" },
        input: {
          padding: "12px 14px",
          fontSize: "0.92rem",
          "&::placeholder": { color: COLORS.muted, opacity: 0.6, fontSize: "0.85rem" },
        },
        sizeSmall: { "& .MuiInputBase-input": { padding: "8px 12px", fontSize: "0.86rem" } },
        multiline: {
          padding: 0,
          "& textarea": {
            padding: "12px 14px",
            fontSize: "0.92rem",
            "&::placeholder": { color: COLORS.muted, opacity: 0.6, fontSize: "0.85rem" },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: COLORS.muted,
          fontSize: "0.95rem",
          fontWeight: 500,
          "&.MuiInputLabel-shrink": { color: COLORS.inkSoft, fontWeight: 600 },
          "&.Mui-focused": { color: COLORS.accentDeep },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 4, marginTop: 6, fontSize: "0.76rem", color: COLORS.muted },
      },
    },
    MuiSelect: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        select: {
          padding: "12px 14px",
          paddingRight: "44px",
          minHeight: "1.4em",
          fontSize: "0.92rem",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#B9AE97",
          "&.Mui-checked": { color: COLORS.accentDeep },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: { color: "#B9AE97", "&.Mui-checked": { color: COLORS.accentDeep } },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": { color: COLORS.accentDeep },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: COLORS.accent },
        },
      },
    },

    /* Chips: soft tints, pill shape */
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: "0.01em",
          fontSize: "0.78rem",
          height: 26,
          backgroundColor: "rgba(10,19,32,0.06)",
          color: COLORS.inkSoft,
        },
        sizeSmall: { height: 22, fontSize: "0.7rem" },
        label: { paddingInline: 10 },
        filled: {
          "&.MuiChip-colorPrimary": { backgroundColor: "rgba(14,42,61,0.10)", color: COLORS.primary },
          "&.MuiChip-colorSecondary": { backgroundColor: "rgba(217,168,75,0.18)", color: COLORS.accentDeep },
          "&.MuiChip-colorSuccess": { backgroundColor: "rgba(44,122,82,0.12)", color: COLORS.expertDark },
          "&.MuiChip-colorError": { backgroundColor: "rgba(140,29,29,0.10)", color: COLORS.admin },
          "&.MuiChip-colorWarning": { backgroundColor: "rgba(217,168,75,0.18)", color: COLORS.accentDeep },
          "&.MuiChip-colorInfo": { backgroundColor: "rgba(14,42,61,0.08)", color: COLORS.primary },
        },
        outlined: {
          borderColor: COLORS.line,
          backgroundColor: "transparent",
          color: COLORS.inkSoft,
          "&.MuiChip-colorPrimary": { borderColor: "rgba(14,42,61,0.3)", color: COLORS.primary },
          "&.MuiChip-colorSecondary": { borderColor: "rgba(160,120,35,0.45)", color: COLORS.accentDeep },
          "&.MuiChip-colorSuccess": { borderColor: "rgba(44,122,82,0.4)", color: COLORS.expertDark },
          "&.MuiChip-colorError": { borderColor: "rgba(140,29,29,0.4)", color: COLORS.admin },
        },
        deleteIcon: { color: "inherit", opacity: 0.6, "&:hover": { opacity: 1, color: "inherit" } },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorSecondary: { backgroundColor: COLORS.accent, color: COLORS.ink },
      },
    },

    /* Tables: cream header row, clay dividers */
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${COLORS.line}`,
          backgroundColor: "#FFFFFF",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            backgroundColor: COLORS.surfaceAlt,
            color: COLORS.faint,
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            borderBottom: `1px solid ${COLORS.line}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${COLORS.line}`,
          fontSize: "0.88rem",
          color: COLORS.ink,
          padding: "12px 16px",
        },
        sizeSmall: { padding: "8px 12px" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child .MuiTableCell-root": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": { backgroundColor: "rgba(217,168,75,0.06)" },
        },
      },
    },

    /* Tabs: gold underline, ink labels */
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 42 },
        indicator: { height: 3, borderRadius: 3, backgroundColor: COLORS.accent },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.88rem",
          minHeight: 42,
          paddingInline: 14,
          color: COLORS.muted,
          "&.Mui-selected": { color: COLORS.ink },
          "&:hover": { color: COLORS.ink },
        },
      },
    },

    /* Dialogs */
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 30px 80px -30px rgba(10,19,32,0.35)",
          backgroundImage: `linear-gradient(${COLORS.accent}, ${COLORS.accent})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 3px",
          backgroundPosition: "top",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: "1.35rem",
          letterSpacing: "-0.015em",
          color: COLORS.ink,
          padding: "22px 24px 8px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: "8px 24px 16px" } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: "12px 24px 20px", gap: 8 } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: "rgba(10,19,32,0.45)", backdropFilter: "blur(2px)" },
        invisible: { backgroundColor: "transparent", backdropFilter: "none" },
      },
    },

    /* Menus, popovers, tooltips */
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 24px 56px -28px rgba(10,19,32,0.3)",
        },
        list: { paddingBlock: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.88rem",
          borderRadius: 8,
          marginInline: 6,
          paddingBlock: 8,
          "&:hover": { backgroundColor: "rgba(217,168,75,0.10)" },
          "&.Mui-selected": {
            backgroundColor: "rgba(217,168,75,0.16)",
            "&:hover": { backgroundColor: "rgba(217,168,75,0.22)" },
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 16, border: `1px solid ${COLORS.line}` },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: COLORS.ink,
          color: "#FFFFFF",
          fontSize: "0.74rem",
          fontWeight: 500,
          borderRadius: 8,
          padding: "6px 10px",
        },
        arrow: { color: COLORS.ink },
      },
    },

    /* Feedback */
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 14, fontSize: "0.86rem", alignItems: "center" },
        standard: {
          "&.MuiAlert-colorInfo": { backgroundColor: "rgba(14,42,61,0.07)", color: COLORS.primary },
          "&.MuiAlert-colorSuccess": { backgroundColor: "rgba(44,122,82,0.10)", color: COLORS.expertDark },
          "&.MuiAlert-colorWarning": { backgroundColor: "rgba(217,168,75,0.16)", color: COLORS.accentDeep },
          "&.MuiAlert-colorError": { backgroundColor: "rgba(140,29,29,0.08)", color: COLORS.admin },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6, backgroundColor: "rgba(10,19,32,0.08)" },
        bar: { borderRadius: 999, backgroundColor: COLORS.accent },
      },
    },
    MuiCircularProgress: {
      styleOverrides: { root: { color: COLORS.accentDeep } },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: "rgba(10,19,32,0.06)", borderRadius: 8 } },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { backgroundColor: COLORS.ink, color: "#FFFFFF", borderRadius: 12, fontSize: "0.86rem" },
      },
    },

    /* Misc */
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: false },
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          borderTop: `1px solid ${COLORS.line}`,
          "&::before": { display: "none" },
          "&:last-of-type": { borderBottom: `1px solid ${COLORS.line}` },
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: COLORS.line } },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontFamily: BODY, fontWeight: 700 },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { color: COLORS.inkSoft, minWidth: 36 } },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: { root: { color: COLORS.accentDeep, fontWeight: 600 } },
    },
    MuiSlider: {
      styleOverrides: {
        thumb: {
          width: 20,
          height: 20,
          backgroundColor: "#FFFFFF",
          border: `2px solid ${COLORS.accentDeep}`,
          boxShadow: "0 4px 12px -4px rgba(10,19,32,0.4)",
          "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 8px rgba(217,168,75,0.16)" },
        },
        track: { border: "none", height: 6, backgroundColor: COLORS.accent },
        rail: { opacity: 1, backgroundColor: COLORS.line, height: 6 },
      },
    },
  },
});

theme = responsiveFontSizes(theme, { variants: ["h1", "h2", "h3"] });

export { COLORS };
export default theme;
