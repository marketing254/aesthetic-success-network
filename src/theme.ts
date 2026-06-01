"use client";
import { createTheme } from "@mui/material/styles";

// ASN palette (plum / orchid-rose / clay / porcelain) — the MUI equivalent of
// the tokens in tokens.css, so the ported src forms render in ASN colours.
export const C = {
  ink: "#3A2333",
  inkDark: "#2A1825",
  inkSoft: "#5E4654",
  muted: "#897581",
  paper: "#F8F2F5",
  paperTint: "#FBF6F8",
  white: "#FFFFFF",
  line: "rgba(58,35,51,0.10)",
  line2: "rgba(58,35,51,0.18)",
  accent: "#C24E72",
  accentBright: "#D98AA6",
  accentDark: "#A1395E",
  clay: "#E2A07C",
};

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: C.ink, dark: C.inkDark, contrastText: C.white },
    secondary: { main: C.accent, light: C.accentBright, dark: C.accentDark, contrastText: C.white },
    background: { default: C.paper, paper: C.white },
    text: { primary: C.ink, secondary: C.muted },
    divider: C.line,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "'Hanken Grotesk', 'Inter', system-ui, sans-serif",
    h1: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.1 },
    h3: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, letterSpacing: "-0.015em" },
    h4: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600 },
    overline: { fontWeight: 700, letterSpacing: "0.16em" },
    button: { textTransform: "none", fontWeight: 600 },
    subtitle1: { lineHeight: 1.6 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 22,
          paddingBlock: 12,
          fontWeight: 600,
          transition: "transform 220ms cubic-bezier(.16,1,.3,1), box-shadow 220ms ease, background-color 220ms ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&.MuiButton-containedSecondary": {
            backgroundImage: `linear-gradient(180deg, ${C.accentBright} 0%, ${C.accent} 100%)`,
            color: C.white,
            "&:hover": { backgroundImage: `linear-gradient(180deg, ${C.accent} 0%, ${C.accentDark} 100%)` },
          },
        },
      },
    },
  },
});

export default theme;
