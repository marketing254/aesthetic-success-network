"use client";
import { Box } from "@mui/material";

type Orb = {
  size: number;
  top: string;
  left: string;
  color: string;
  delay: number;
  duration: number;
};

const DEFAULT_ORBS: Orb[] = [
  { size: 520, top: "-10%", left: "-8%", color: "rgba(217, 168, 75, 0.28)", delay: 0, duration: 22 },
  { size: 460, top: "15%", left: "65%", color: "rgba(34, 108, 165, 0.22)", delay: 4, duration: 26 },
  { size: 380, top: "60%", left: "30%", color: "rgba(240, 193, 110, 0.18)", delay: 8, duration: 30 },
  { size: 300, top: "50%", left: "80%", color: "rgba(95, 70, 35, 0.30)", delay: 12, duration: 24 },
];

export default function AmbientOrbs({ orbs = DEFAULT_ORBS }: { orbs?: Orb[] }) {
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
      {orbs.map((orb, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at center, ${orb.color} 0%, transparent 65%)`,
            filter: "blur(60px)",
            opacity: 0.85,
            animation: `orbDrift${i % 3} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }}
        />
      ))}
    </Box>
  );
}
