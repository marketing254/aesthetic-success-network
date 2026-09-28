"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export default function AnimatedCounter({
  value,
  duration = 1.6,
  format = (n) => n.toLocaleString("en-US"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: easeOutExpo,
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return <span className={className}>{format(display)}</span>;
}
