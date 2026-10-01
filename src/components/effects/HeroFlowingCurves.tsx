"use client";
import { Box } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Champagne flowing curves — animated SVG bezier paths that
 * continuously draw themselves across the hero background.
 *
 * Pure SVG with `strokeDasharray` + animated `strokeDashoffset` — no
 * WebGL, no canvas, no network fetches, scales perfectly at any DPI.
 * Honours prefers-reduced-motion.
 *
 * Strict champagne / gold / cream palette — no blue, no off-brand
 * accents. The mask gradient fades the curves at the top + bottom
 * so they read as background texture, not foreground graphics.
 */
export default function HeroFlowingCurves() {
  const reduced = useReducedMotion();

  // Curves originating from the top-left, sweeping toward the bottom-right.
  // Each one has a different cubic-bezier signature, stroke colour, and
  // animation duration so they never feel synchronised.
  const tlCurves = [
    {
      d: "M-60,80 C 280,140 540,360 820,320 S 1280,260 1560,460",
      stroke: "rgba(217,168,75,0.45)",
      width: 1.4,
      duration: 16,
    },
    {
      d: "M-50,160 C 220,260 480,420 760,400 S 1240,340 1560,540",
      stroke: "rgba(217,168,75,0.28)",
      width: 1.1,
      duration: 20,
    },
    {
      d: "M-80,40 C 260,40 520,200 800,260 S 1280,240 1560,360",
      stroke: "rgba(255,237,196,0.55)",
      width: 1.2,
      duration: 18,
    },
  ];

  // Curves originating from the bottom-right, sweeping back the other way.
  const brCurves = [
    {
      d: "M1560,720 C 1280,620 1000,500 720,520 S 240,620 -50,500",
      stroke: "rgba(155,123,58,0.32)",
      width: 1.3,
      duration: 18,
    },
    {
      d: "M1560,640 C 1240,540 960,420 700,460 S 240,540 -50,420",
      stroke: "rgba(217,168,75,0.22)",
      width: 1,
      duration: 22,
    },
    {
      d: "M1560,800 C 1200,700 880,600 600,620 S 220,700 -50,600",
      stroke: "rgba(240,193,110,0.35)",
      width: 1.2,
      duration: 24,
    },
  ];

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 1500 800"
        preserveAspectRatio="xMidYMid slice"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          // Fade the curves at the very centre band so they wrap the
          // headline rather than cross through it. Keeps the contrast
          // crisp on the text.
          maskImage:
            "radial-gradient(ellipse 55% 45% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 45%, black 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 55% 45% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 45%, black 80%)",
        }}
      >
        {tlCurves.map((c, i) => (
          <motion.path
            key={`tl-${i}`}
            d={c.d}
            fill="none"
            stroke={c.stroke}
            strokeWidth={c.width}
            strokeLinecap="round"
            strokeDasharray="220 900"
            initial={reduced ? false : { strokeDashoffset: 0 }}
            animate={reduced ? undefined : { strokeDashoffset: [-1120, 0] }}
            transition={{
              duration: c.duration,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.6,
            }}
          />
        ))}
        {brCurves.map((c, i) => (
          <motion.path
            key={`br-${i}`}
            d={c.d}
            fill="none"
            stroke={c.stroke}
            strokeWidth={c.width}
            strokeLinecap="round"
            strokeDasharray="220 900"
            initial={reduced ? false : { strokeDashoffset: 0 }}
            animate={reduced ? undefined : { strokeDashoffset: [1120, 0] }}
            transition={{
              duration: c.duration,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.8,
            }}
          />
        ))}
      </Box>

      {/* Faint dot grid texture, fades at the edges */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(155,123,58,0.16) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 55%, black 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 55%, black 85%)",
          opacity: 0.7,
        }}
      />
    </Box>
  );
}
