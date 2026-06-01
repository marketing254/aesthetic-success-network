"use client";

import { useRef, type ReactNode } from "react";

/**
 * Subtle 3D tilt — the element rotates toward the cursor on a perspective
 * plane, with a small lift. One signal, no overshoot. Disabled for
 * reduced-motion and coarse (touch) pointers via CSS + guard.
 */
export default function Tilt({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = innerRef.current;
    if (!el || e.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-4px)`;
  }
  function reset() {
    const el = innerRef.current;
    if (el) el.style.transform = "";
  }

  return (
    <div
      className={`tilt${className ? " " + className : ""}`}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      <div className="tilt__inner" ref={innerRef}>
        {children}
      </div>
    </div>
  );
}
