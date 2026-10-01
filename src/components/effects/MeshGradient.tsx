"use client";
import { Box } from "@mui/material";

/**
 * Subtle slow-moving gradient mesh — the design language used by Linear,
 * Stripe, Vercel. Three soft conic blobs drift across the viewport on a
 * 30-second cycle. Pure CSS keyframes, no JS, ~1KB.
 *
 * Designed for a near-white #FAFAF9 background. Blobs are very low opacity
 * so they suggest motion without distracting from the content.
 */
export default function MeshGradient() {
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
        sx={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 40% 40%, rgba(217,168,75,0.22) 0%, rgba(217,168,75,0) 70%)",
          filter: "blur(80px)",
          animation: "meshDriftA 28s ease-in-out infinite",
          "@keyframes meshDriftA": {
            "0%, 100%": { transform: "translate3d(0,0,0)" },
            "50%": { transform: "translate3d(60px, 40px, 0)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "-15%",
          right: "-10%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 60% 40%, rgba(34,108,165,0.16) 0%, rgba(34,108,165,0) 70%)",
          filter: "blur(90px)",
          animation: "meshDriftB 32s ease-in-out infinite",
          "@keyframes meshDriftB": {
            "0%, 100%": { transform: "translate3d(0,0,0)" },
            "50%": { transform: "translate3d(-50px, -30px, 0)" },
          },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(14,42,61,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
          opacity: 0.7,
        }}
      />
    </Box>
  );
}
