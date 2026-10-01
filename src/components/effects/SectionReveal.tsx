"use client";
import { type ReactNode } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";

type Variant = "fade-up" | "fade-down" | "blur-in" | "slide-left" | "slide-right" | "scale-in";

const VARIANTS: Record<Variant, { initial: Record<string, number | string>; animate: Record<string, number | string> }> = {
  "fade-up": { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } },
  "fade-down": { initial: { opacity: 0, y: -30 }, animate: { opacity: 1, y: 0 } },
  "blur-in": { initial: { opacity: 0, filter: "blur(8px)" }, animate: { opacity: 1, filter: "blur(0px)" } },
  "slide-left": { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 } },
  "slide-right": { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 } },
  "scale-in": { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
};

/**
 * Whileview reveal wrapper with multiple animation flavors. Centralizes the
 * easing curve and viewport margins so reveals across the page feel cohesive.
 */
export default function SectionReveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 0.75,
  sx,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  sx?: SxProps<Theme>;
}) {
  const reduced = useReducedMotion();
  const v = VARIANTS[variant];

  if (reduced) {
    return <Box sx={sx}>{children}</Box>;
  }

  return (
    <Box sx={sx}>
      <motion.div
        initial={v.initial}
        whileInView={v.animate}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </Box>
  );
}
