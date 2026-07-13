"use client";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";

// Admin-console theme in the ASN visual system (warm cream, near-black
// ink, gold/bronze accent, Fraunces display + Inter body).
const COLORS = {
  ink: "#0A1320",
  inkSoft: "#3B4A55",
  muted: "#5C6673",
  surface: "#F7F5F0",
  surfaceAlt: "#EFEAE0",
  line: "#E5DFD2",
  primary: "#0A1320",
  primaryDark: "#000000",
  accent: "#D9A84B",
  accentBright: "#F0C16E",
  accentDeep: "#A87D2C",
};

let theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: COLORS.primary, dark: COLORS.primaryDark, contrastText: "#FFFFFF" },
    secondary: {
      main: COLORS.accent,
      light: COLORS.accentBright,
      dark: COLORS.accentDeep,
      contrastText: COLORS.ink,
    },
    background: { default: COLORS.surface, paper: "#FFFFFF" },
    text: { primary: COLORS.ink, secondary: COLORS.muted },
    divider: COLORS.line,
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: "var(--font-body), 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    h1: {
      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
      fontWeight: 400,
      letterSpacing: "-0.03em",
      lineHeight: 1,
      fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
    },
    h2: {
      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
      fontWeight: 400,
      letterSpacing: "-0.02em",
      lineHeight: 1.05,
      fontSize: "clamp(2rem, 4vw, 3rem)",
    },
    h3: {
      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
      fontWeight: 500,
      letterSpacing: "-0.015em",
      lineHeight: 1.1,
      fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
    },
    h4: {
      fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
      fontWeight: 500,
      fontSize: "1.4rem",
      letterSpacing: "-0.01em",
    },
    h5: { fontWeight: 600, fontSize: "1.1rem", lineHeight: 1.35 },
    h6: { fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.04em", textTransform: "uppercase" },
    body1: { fontSize: "1rem", lineHeight: 1.65, color: COLORS.inkSoft },
    body2: { fontSize: "0.9375rem", lineHeight: 1.6, color: COLORS.muted },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    overline: { fontWeight: 600, letterSpacing: "0.18em", fontSize: "0.75rem", color: COLORS.muted },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: COLORS.surface, color: COLORS.ink },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 22,
          paddingBlock: 11,
          fontWeight: 600,
          fontSize: "0.9rem",
          "&.MuiButton-containedPrimary": {
            backgroundColor: COLORS.ink,
            "&:hover": { backgroundColor: "#000000" },
          },
          "&.MuiButton-containedSecondary": {
            color: COLORS.ink,
            backgroundColor: COLORS.accent,
            "&:hover": { backgroundColor: COLORS.accentDeep },
          },
          "&.MuiButton-outlinedPrimary": {
            borderColor: COLORS.line,
            color: COLORS.ink,
            backgroundColor: "rgba(255,255,255,0.5)",
            "&:hover": { borderColor: COLORS.ink, backgroundColor: "rgba(255,255,255,0.85)" },
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: COLORS.line },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: { root: { backgroundColor: "transparent", backgroundImage: "none" } },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
      styleOverrides: { root: { paddingInline: 24 } },
    },
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
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: COLORS.inkSoft },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: COLORS.ink,
            borderWidth: 1.5,
          },
        },
        notchedOutline: { borderColor: COLORS.line },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600, letterSpacing: "0.02em" },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: COLORS.line } } },
  },
});

theme = responsiveFontSizes(theme);

export { COLORS };
export default theme;
