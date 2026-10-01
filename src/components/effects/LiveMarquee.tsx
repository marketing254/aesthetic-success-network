"use client";
import { Box } from "@mui/material";
import CircleIcon from "@mui/icons-material/FiberManualRecord";

// Legacy hero experiment (not on the current home page). Sample strings
// only; never show these as real activity.
const SAMPLE_ACTIVITY = [
  "M.S. from Boston, MA just joined",
  "R.T. from Austin, TX just joined",
  "Radiance Devices, Partner",
  "K.P. from Seattle, WA just joined",
  "Brightway Patient Financing, Partner",
  "J.L. from Miami, FL just joined",
  "A.W. from Denver, CO just joined",
  "Aesthetic CE Collective, Partner",
  "P.G. from Chicago, IL just joined",
  "N.K. from Portland, OR just joined",
];

export default function LiveMarquee({ items = SAMPLE_ACTIVITY }: { items?: string[] }) {
  // Duplicate so the loop is seamless.
  const looped = [...items, ...items];
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        overflow: "hidden",
        py: 1.5,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        bgcolor: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(8px)",
        maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 5,
          width: "fit-content",
          animation: "marqueeScroll 36s linear infinite",
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {looped.map((item, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.78rem",
              fontWeight: 500,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            <CircleIcon sx={{ fontSize: 5, color: "rgba(217,168,75,0.7)" }} />
            {item}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
