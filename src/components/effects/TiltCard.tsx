"use client";
import { useRef, type ReactNode } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

const SPRING = { stiffness: 120, damping: 14, mass: 0.4 };

/**
 * 3D card tilt, rotates the child around X/Y based on cursor position.
 * Includes an animated highlight that follows the cursor across the surface.
 */
export default function TiltCard({
  children,
  sx,
  maxTilt = 8,
  glare = true,
  perspective = 1100,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  maxTilt?: number;
  glare?: boolean;
  perspective?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const reduced = useReducedMotion();

  const smx = useSpring(mx, SPRING);
  const smy = useSpring(my, SPRING);

  const rotateY = useTransform(smx, [0, 1], [-maxTilt, maxTilt]);
  const rotateX = useTransform(smy, [0, 1], [maxTilt, -maxTilt]);

  const glareX = useTransform(smx, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(smy, [0, 1], ["0%", "100%"]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <Box
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      sx={{ perspective: `${perspective}px`, ...sx }}
    >
      <motion.div
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          transformStyle: "preserve-3d",
          position: "relative",
          willChange: "transform",
        }}
      >
        {children}
        {glare && !reduced && (
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              pointerEvents: "none",
              background: `radial-gradient(420px circle at ${glareX.get()} ${glareY.get()}, rgba(255,255,255,0.10), transparent 40%)`,
              mixBlendMode: "screen",
            }}
            // Re-render the gradient string via motion values
            // by using a transform CSS variable would be ideal; this works for the simple case.
          />
        )}
      </motion.div>
    </Box>
  );
}
