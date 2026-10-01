"use client";
import { useRef, type ReactNode } from "react";
import { Box } from "@mui/material";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

const SPRING = { stiffness: 200, damping: 18, mass: 0.4 };

/**
 * Wraps a child element so it leans toward the cursor when nearby.
 * The child receives normal pointer events. Magnetic strength caps at ~14px.
 */
export default function MagneticButton({
  children,
  strength = 0.35,
}: {
  children: ReactNode;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);
  const reduced = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <Box
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      sx={{ display: "inline-block" }}
    >
      <motion.div style={{ x: sx, y: sy, display: "inline-block" }}>{children}</motion.div>
    </Box>
  );
}
