"use client";
import { Box } from "@mui/material";
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

/**
 * A thin gold progress bar pinned to the top of the viewport that fills as
 * the user scrolls down the page. Subtle, but anchors the page in motion.
 */
export default function ScrollProgressBar() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 30,
    mass: 0.4,
  });

  if (reduced) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: (t) => t.zIndex.appBar + 2,
        pointerEvents: "none",
      }}
    >
      <motion.div
        style={{
          height: "100%",
          backgroundImage:
            "linear-gradient(90deg, #F0C16E 0%, #D9A84B 50%, #A07823 100%)",
          transformOrigin: "0% 50%",
          scaleX,
          boxShadow: "0 0 8px rgba(217,168,75,0.6)",
        }}
      />
    </Box>
  );
}
