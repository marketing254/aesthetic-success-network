"use client";

import { useEffect, useMemo, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number; finished: boolean };

// August 1, 2026, 9:00 AM ET. Override with NEXT_PUBLIC_LAUNCH_AT.
const DEFAULT_TARGET = "2026-08-01T13:00:00.000Z";

function diff(toMs: number): Parts {
  const now = Date.now();
  let delta = Math.max(0, Math.floor((toMs - now) / 1000));
  const days = Math.floor(delta / 86_400);
  delta -= days * 86_400;
  const hours = Math.floor(delta / 3_600);
  delta -= hours * 3_600;
  const minutes = Math.floor(delta / 60);
  const seconds = delta - minutes * 60;
  return { days, hours, minutes, seconds, finished: toMs - now <= 0 };
}

/**
 * Launch-phase countdown, styled in the ASN visual system.
 * Target date comes from NEXT_PUBLIC_LAUNCH_AT (ISO 8601).
 * `variant="dark"` for the espresso form sections, "light" for cream.
 */
export default function Countdown({
  target,
  variant = "light",
  label = "Founding doors open in",
  className,
}: {
  target?: string;
  variant?: "light" | "dark";
  label?: string;
  className?: string;
}) {
  const targetMs = useMemo(() => {
    const iso = target ?? process.env.NEXT_PUBLIC_LAUNCH_AT ?? DEFAULT_TARGET;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Date.parse(DEFAULT_TARGET);
  }, [target]);

  // Render "--" until mounted so the server and client markup match.
  const [mounted, setMounted] = useState(false);
  const [parts, setParts] = useState<Parts>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    finished: false,
  });

  useEffect(() => {
    setMounted(true);
    setParts(diff(targetMs));
    const id = setInterval(() => setParts(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const cells = [
    { unit: "Days", value: parts.days },
    { unit: "Hours", value: parts.hours },
    { unit: "Min", value: parts.minutes },
    { unit: "Sec", value: parts.seconds },
  ];

  return (
    <div
      className={`countdown${variant === "dark" ? " cd-dark" : ""}${className ? ` ${className}` : ""}`}
      role="timer"
      aria-label={
        mounted
          ? `${label}: ${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds`
          : label
      }
    >
      <span className="cd-label">{label}</span>
      {mounted && parts.finished ? (
        <span className="cd-live">The doors are open.</span>
      ) : (
        <div className="cd-cells">
          {cells.map((c) => (
            <div className="cd-cell" key={c.unit}>
              <div className="cd-num" aria-live="off">
                {mounted ? String(c.value).padStart(2, "0") : "--"}
              </div>
              <div className="cd-unit">{c.unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
