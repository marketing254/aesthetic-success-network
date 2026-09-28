"use client";
import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Lenis-powered smooth scroll, mounted once at the app root.
 *
 * Renders no DOM, it just spins up a Lenis instance, runs its RAF tick loop,
 * and disposes on unmount. This is the smoothness modern motion sites use:
 * inertia, subtle easing, no jank on parallax.
 *
 * Respects prefers-reduced-motion by skipping the smoothing.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Strong but not over-the-top smoothing
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
