"use client";
import { Box } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Unique animated hero background — flowing curves that "draw themselves"
 * continuously from both corners, suggesting connection and motion.
 *
 * Built from pure SVG <path> elements with stroke-dasharray + animated
 * stroke-dashoffset (via framer-motion). No WebGL, no rasterization, scales
 * perfectly on any DPI.
 *
 * Five layers, back to front:
 *  1. Faint dot grid (depth texture)
 *  2. Top-left flowing curves (gold + cream)
 *  3. Bottom-right flowing curves (navy + cream)
 *  4. Floating accent dots that orbit slowly
 *  5. Soft mask on edges so curves fade into the page
 */
export default function FlowingCurves() {
  const reduced = useReducedMotion();

  // Curves originating from top-left corner — each is a smooth cubic curve.
  // Different control points so they spread like flowing ribbons.
  const tlCurves = [
    { d: "M-50,-50 C 200,80 380,300 600,260 S 1100,180 1500,400", stroke: "rgba(217,168,75,0.32)", width: 1.5, duration: 14 },
    { d: "M-80,80 C 180,200 420,360 720,340 S 1180,290 1500,520", stroke: "rgba(217,168,75,0.18)", width: 1, duration: 18 },
    { d: "M-50,-50 C 240,30 500,180 760,240 S 1240,220 1500,300", stroke: "rgba(255,237,196,0.6)", width: 1.2, duration: 16 },
  ];

  // Curves originating from bottom-right corner
  const brCurves = [
    { d: "M1500,750 C 1260,640 1000,520 760,540 S 240,640 -50,520", stroke: "rgba(14,42,61,0.16)", width: 1.5, duration: 16 },
    { d: "M1500,700 C 1240,580 960,440 700,500 S 260,580 -50,460", stroke: "rgba(34,108,165,0.18)", width: 1, duration: 20 },
    { d: "M1500,820 C 1200,720 880,640 600,640 S 220,720 -50,620", stroke: "rgba(217,168,75,0.22)", width: 1.2, duration: 22 },
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
      {/* Faint dot grid */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(14,42,61,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 80%)",
          opacity: 0.6,
        }}
      />

      {/* Soft gold halo top-left */}
      <Box
        sx={{
          position: "absolute",
          top: "-12%",
          left: "-8%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 40% 40%, rgba(217,168,75,0.32) 0%, rgba(217,168,75,0) 70%)",
          filter: "blur(70px)",
          animation: reduced ? "none" : "haloDrift 20s ease-in-out infinite",
          "@keyframes haloDrift": {
            "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
            "50%": { transform: "translate3d(40px,30px,0) scale(1.1)" },
          },
        }}
      />

      {/* Soft sky halo bottom-right */}
      <Box
        sx={{
          position: "absolute",
          bottom: "-12%",
          right: "-8%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(34,108,165,0.28) 0%, rgba(34,108,165,0) 70%)",
          filter: "blur(80px)",
          animation: reduced ? "none" : "haloDrift 24s ease-in-out infinite reverse",
        }}
      />

      {/* Flowing curve SVG — full hero size */}
      <Box
        component="svg"
        viewBox="0 0 1500 800"
        preserveAspectRatio="xMidYMid slice"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          maskImage:
            "linear-gradient(135deg, black 0%, black 35%, transparent 75%), linear-gradient(315deg, black 0%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "linear-gradient(135deg, black 0%, black 35%, transparent 75%), linear-gradient(315deg, black 0%, black 35%, transparent 75%)",
          maskComposite: "add",
          WebkitMaskComposite: "source-over",
        }}
      >
        {/* Top-left flowing curves */}
        {tlCurves.map((c, i) => (
          <motion.path
            key={`tl-${i}`}
            d={c.d}
            fill="none"
            stroke={c.stroke}
            strokeWidth={c.width}
            strokeLinecap="round"
            strokeDasharray="200 800"
            initial={reduced ? false : { strokeDashoffset: 0 }}
            animate={reduced ? undefined : { strokeDashoffset: [-1000, 0] }}
            transition={{
              duration: c.duration,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.6,
            }}
          />
        ))}

        {/* Bottom-right flowing curves */}
        {brCurves.map((c, i) => (
          <motion.path
            key={`br-${i}`}
            d={c.d}
            fill="none"
            stroke={c.stroke}
            strokeWidth={c.width}
            strokeLinecap="round"
            strokeDasharray="200 800"
            initial={reduced ? false : { strokeDashoffset: 0 }}
            animate={reduced ? undefined : { strokeDashoffset: [0, -1000] }}
            transition={{
              duration: c.duration,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.8,
            }}
          />
        ))}

        {/* Floating accent dots — gold + cream, slow vertical drift */}
        {[
          { cx: 280, cy: 180, r: 4, fill: "rgba(217,168,75,0.55)", dy: 12, dur: 6 },
          { cx: 1180, cy: 240, r: 3, fill: "rgba(255,237,196,0.7)", dy: 16, dur: 7 },
          { cx: 920, cy: 600, r: 5, fill: "rgba(217,168,75,0.45)", dy: 14, dur: 8 },
          { cx: 420, cy: 540, r: 3.5, fill: "rgba(34,108,165,0.45)", dy: 18, dur: 9 },
          { cx: 1320, cy: 460, r: 3, fill: "rgba(217,168,75,0.4)", dy: 10, dur: 7.5 },
        ].map((dot, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill={dot.fill}
            animate={reduced ? undefined : { cy: [dot.cy, dot.cy - dot.dy, dot.cy] }}
            transition={{
              duration: dot.dur,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
