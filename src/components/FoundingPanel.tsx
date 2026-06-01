"use client";

import { useEffect, useRef, useState } from "react";
import { founding, hero } from "@/content";

// Fixed node graph for the hero-card network motif (viewBox 0 0 300 150).
const NODES = [
  { x: 36, y: 46, r: 2.4, on: false },
  { x: 78, y: 22, r: 2.0, on: false },
  { x: 96, y: 86, r: 2.6, on: true },
  { x: 150, y: 52, r: 4.2, on: true },
  { x: 158, y: 112, r: 2.2, on: false },
  { x: 214, y: 30, r: 2.6, on: true },
  { x: 228, y: 92, r: 2.0, on: false },
  { x: 274, y: 60, r: 3.0, on: true },
  { x: 56, y: 116, r: 2.0, on: false },
  { x: 128, y: 18, r: 2.2, on: false },
];
const EDGES: [number, number][] = [
  [0, 1], [0, 8], [1, 9], [1, 3], [2, 3], [2, 8], [3, 4], [3, 5],
  [4, 6], [5, 7], [6, 7], [5, 9], [2, 4], [3, 6],
];

export default function FoundingPanel() {
  const ref = useRef<HTMLDivElement | null>(null);
  const target = Number(hero.proofPoints[0].value);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  const claimed = founding.spotsClaimed;
  const total = founding.totalSpots;
  const pct = Math.round((claimed / total) * 100);

  useEffect(() => {
    const node = ref.current;
    if (!node || done) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(target);
      setDone(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        setDone(true);
        const duration = 1100;
        let start = 0;
        const stepFn = (t: number) => {
          if (!start) start = t;
          const p = Math.min((t - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setCount(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(stepFn);
        };
        requestAnimationFrame(stepFn);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [done, target]);

  return (
    <div className="hero__panel" ref={ref}>
      <svg className="hero__net" viewBox="0 0 300 150" aria-hidden="true">
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            className="hero__net-edge"
          />
        ))}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            className={n.on ? "hero__net-node is-on" : "hero__net-node"}
            style={{ animationDelay: `${(i % 5) * 0.6}s` }}
          />
        ))}
      </svg>

      <span className="hero__panel-label">Waitlist, and growing</span>
      <div className="counter">
        <span className="counter__num">{count}</span>
        {target > 0 && <span className="counter__plus">+</span>}
      </div>
      <p className="counter__caption">{hero.proofPoints[0].label}</p>

      <div className="progress">
        <div
          className="progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={claimed}
          aria-label={hero.progressLabel}
        >
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress__meta">
          <span>
            <strong>{claimed}</strong> of {total} {hero.progressLabel}
          </span>
          <span>{total - claimed} left</span>
        </div>
      </div>

      <div className="hero__panel-rule" />
      <div className="hero__panel-foot">
        <span>
          <span className="glyph">$49</span>/mo founding rate — locked while active.
        </span>
      </div>
    </div>
  );
}
