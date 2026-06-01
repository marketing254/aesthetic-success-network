"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive constellation — a depth-layered network of nodes that drift,
 * connect with hairlines, and respond to the cursor. Meaningful (it IS the
 * "network"), lightweight (2D canvas, no deps), and respects reduced-motion.
 */
export default function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Read brand colours from CSS tokens so the canvas stays on-theme.
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--color-accent").trim() || "oklch(60% 0.155 358)";
    const ink = styles.getPropertyValue("--color-ink").trim() || "oklch(23% 0.05 338)";

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: -9999, y: -9999 };

    type Node = { x: number; y: number; z: number; vx: number; vy: number };
    let nodes: Node[] = [];

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(64, Math.round((width * height) / 16000));
      nodes = Array.from({ length: count }, (_, i) => {
        // deterministic-ish spread (no Math.random reliance for SSR parity)
        const a = (i * 2.3999) % (Math.PI * 2);
        const r = ((i * 97) % 100) / 100;
        return {
          x: width * (0.5 + 0.5 * r * Math.cos(a)),
          y: height * (0.5 + 0.5 * r * Math.sin(a * 1.3)),
          z: 0.4 + (((i * 53) % 100) / 100) * 0.6,
          vx: (((i * 31) % 100) / 100 - 0.5) * 0.12,
          vy: (((i * 17) % 100) / 100 - 0.5) * 0.12,
        };
      });
    }

    let raf = 0;
    function frame() {
      ctx!.clearRect(0, 0, width, height);
      const linkDist = Math.min(width, height) * 0.18;

      for (const n of nodes) {
        n.x += n.vx * n.z;
        n.y += n.vy * n.z;

        // gentle cursor repulsion (parallax-by-depth)
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) {
          const d = Math.sqrt(d2) || 1;
          const force = ((130 - d) / 130) * 0.6 * n.z;
          n.x += (dx / d) * force;
          n.y += (dy / d) * force;
        }

        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.5 * Math.min(a.z, b.z);
            ctx!.strokeStyle = withAlpha(ink, alpha * 0.5);
            ctx!.lineWidth = 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const r = 1.1 + n.z * 2.2;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = withAlpha(n.z > 0.8 ? accent : ink, 0.35 + n.z * 0.3);
        ctx!.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    function withAlpha(color: string, alpha: number) {
      const a = Math.max(0, Math.min(1, alpha)).toFixed(3);
      if (color.startsWith("oklch(")) return color.replace(/\)\s*$/, ` / ${a})`);
      return color;
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    }
    function onLeave() {
      pointer.x = -9999;
      pointer.y = -9999;
    }

    build();
    if (reduce) {
      // draw one static frame, no animation loop
      const saved = frame;
      saved();
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
      // simple static render
      raf = 0;
      // draw nodes + links once
      // (frame already drew once above; stop here)
    } else {
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation" aria-hidden="true" />;
}
