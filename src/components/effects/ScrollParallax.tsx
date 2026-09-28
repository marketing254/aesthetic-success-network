"use client";
import { useRef, type ReactNode } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * Wrap any element to translate it vertically as the user scrolls past it.
 * `speed` > 0 moves the element UP relative to the scroll (parallax-back),
 * `speed` < 0 moves it DOWN (parallax-forward).
 *
 * Tuned for short, sectionwise parallax, not for full-page heavy effects.
 */
export default function ScrollParallax({
  children,
  speed = 0.18,
  sx,
}: {
  children: ReactNode;
  speed?: number;
  sx?: SxProps<Theme>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}px`, `${-speed * 100}px`]);

  return (
    <Box ref={ref} sx={{ position: "relative", ...sx }}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </Box>
  );
}
