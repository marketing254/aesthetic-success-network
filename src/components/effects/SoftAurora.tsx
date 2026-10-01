"use client";
import { Box } from "@mui/material";

/**
 * Simple, attractive background animation for the hero — pure CSS, no WebGL.
 *
 * Three soft mesh blobs drift slowly across the viewport with `filter: blur(80px)`,
 * one warm gold, one cool blue, one cream. They're constrained inside the hero
 * via the parent's overflow:hidden, so they never bleed onto other sections.
 *
 * Tuned for performance: pure CSS keyframes (GPU compositor only),
 * no JavaScript per-frame work, and `prefers-reduced-motion` honored via
 * media query inside the keyframe block.
 */
export default function SoftAurora() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        // Mask softens the blob edges so they fade into the page edges
        maskImage:
          "radial-gradient(ellipse at center, black 50%, transparent 95%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 50%, transparent 95%)",
      }}
    >
      {/* Blob 1 — warm gold, top-left, large slow drift */}
      <Box
        sx={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, rgba(217,168,75,0.55) 0%, rgba(217,168,75,0) 70%)",
          filter: "blur(80px)",
          animation: "softAuroraDriftA 22s ease-in-out infinite",
          "@keyframes softAuroraDriftA": {
            "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
            "50%": { transform: "translate3d(60px, 40px, 0) scale(1.12)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />

      {/* Blob 2 — cool sky-blue, bottom-right */}
      <Box
        sx={{
          position: "absolute",
          bottom: "-20%",
          right: "-12%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 60% 40%, rgba(34,108,165,0.38) 0%, rgba(34,108,165,0) 70%)",
          filter: "blur(90px)",
          animation: "softAuroraDriftB 28s ease-in-out infinite",
          "@keyframes softAuroraDriftB": {
            "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
            "50%": { transform: "translate3d(-50px, -30px, 0) scale(1.08)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />

      {/* Blob 3 — cream highlight, center-back */}
      <Box
        sx={{
          position: "absolute",
          top: "20%",
          left: "30%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,237,196,0.45) 0%, rgba(255,237,196,0) 70%)",
          filter: "blur(70px)",
          animation: "softAuroraDriftC 24s ease-in-out infinite",
          "@keyframes softAuroraDriftC": {
            "0%, 100%": { transform: "translate3d(0,0,0) scale(0.95)" },
            "50%": { transform: "translate3d(30px, -50px, 0) scale(1.1)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />

      {/* Faint dot grid texture, masked behind the blobs */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(14,42,61,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 80%)",
          opacity: 0.7,
        }}
      />
    </Box>
  );
}
