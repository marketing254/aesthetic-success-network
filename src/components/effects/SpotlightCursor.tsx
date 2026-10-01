"use client";
import { useEffect, useRef } from "react";
import { Box } from "@mui/material";

/**
 * A soft glow that follows the cursor. Mount inside a positioned ancestor
 * (the hero/section), it absolute-positions itself to fill that ancestor.
 * Pointer-events: none so it never blocks UI.
 */
export default function SpotlightCursor({
  color = "rgba(217, 168, 75, 0.18)",
  size = 520,
}: {
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
    };
    const onLeave = () => {
      targetX = -9999;
      targetY = -9999;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      el.style.transform = `translate3d(${currentX - size / 2}px, ${currentY - size / 2}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
    };
  }, [size]);

  return (
    <Box
      ref={ref}
      aria-hidden
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        pointerEvents: "none",
        background: `radial-gradient(circle at center, ${color} 0%, transparent 65%)`,
        mixBlendMode: "screen",
        willChange: "transform",
        zIndex: 1,
        transform: "translate3d(-9999px, -9999px, 0)",
      }}
    />
  );
}
