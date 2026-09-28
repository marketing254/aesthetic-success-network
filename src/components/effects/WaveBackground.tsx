"use client";
import { Box } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Animated SVG wave background — three stacked layers at different depths
 * and speeds for a calm, ocean-like feel. Pure SVG paths animated with
 * framer-motion's keyframe X translation. No WebGL, no JS per-frame work
 * outside framer-motion's rAF batching.
 *
 * Sits absolutely inside the hero. Layers:
 *  1. Faint dot grid (depth + texture)
 *  2. Back wave (gold, low opacity, slow)
 *  3. Mid wave (cream, slow)
 *  4. Front wave (navy at low opacity, slow)
 *  5. Soft top-down gradient overlay for legibility
 */
export default function WaveBackground() {
  const reduced = useReducedMotion();

  // Each wave is a 2880-wide path (2× viewport) — we slide it by -1440 and
  // loop. That makes the wave appear to scroll horizontally infinitely.
  const waveD = (amplitude: number, frequency: number) => {
    // Build an SVG path with `frequency` peaks over 2880 width.
    const steps = frequency * 2;
    const stepW = 2880 / steps;
    let d = `M0,200 `;
    for (let i = 0; i <= steps; i++) {
      const x = stepW * i;
      const ctrlX = x - stepW / 2;
      const ctrlY = i % 2 === 0 ? 200 + amplitude : 200 - amplitude;
      d += `Q${ctrlX},${ctrlY} ${x},200 `;
    }
    d += `L2880,400 L0,400 Z`;
    return d;
  };

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
      {/* Faint dot grid */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(14,42,61,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
          opacity: 0.55,
        }}
      />

      {/* Soft gold halo at top-left */}
      <Box
        sx={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 40% 40%, rgba(217,168,75,0.32) 0%, rgba(217,168,75,0) 70%)",
          filter: "blur(70px)",
          animation: reduced ? "none" : "softHalo 18s ease-in-out infinite",
          "@keyframes softHalo": {
            "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
            "50%": { transform: "translate3d(40px,30px,0) scale(1.12)" },
          },
        }}
      />

      {/* Cool sky halo at bottom-right */}
      <Box
        sx={{
          position: "absolute",
          bottom: "-15%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(34,108,165,0.28) 0%, rgba(34,108,165,0) 70%)",
          filter: "blur(80px)",
          animation: reduced ? "none" : "softHalo 22s ease-in-out infinite reverse",
        }}
      />

      {/* Wave stack at the bottom */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: { xs: 220, md: 320 },
          overflow: "hidden",
        }}
      >
        {/* Back wave — gold, slow */}
        <motion.svg
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          width="200%"
          height="100%"
          style={{
            position: "absolute",
            bottom: -40,
            left: 0,
            display: "block",
          }}
          animate={reduced ? undefined : { x: [0, -1440] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          <path d={waveD(18, 5)} fill="rgba(217,168,75,0.18)" />
        </motion.svg>

        {/* Mid wave — cream, medium speed, offset phase */}
        <motion.svg
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          width="200%"
          height="100%"
          style={{
            position: "absolute",
            bottom: -20,
            left: 0,
            display: "block",
          }}
          animate={reduced ? undefined : { x: [0, -1440] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <path d={waveD(24, 4)} fill="rgba(255,237,196,0.55)" />
        </motion.svg>

        {/* Front wave — soft navy, faster */}
        <motion.svg
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          width="200%"
          height="100%"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            display: "block",
          }}
          animate={reduced ? undefined : { x: [0, -1440] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <path d={waveD(32, 3)} fill="rgba(14,42,61,0.08)" />
        </motion.svg>
      </Box>
    </Box>
  );
}
