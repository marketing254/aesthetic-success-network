"use client";
import { useEffect, useMemo, useState } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  target?: string;
  variant?: "dark" | "light";
  compact?: boolean;
};

const DEFAULT_TARGET = "2026-06-18T13:00:00.000Z";

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
};

function diff(targetMs: number): Parts {
  const now = Date.now();
  let delta = Math.max(0, Math.floor((targetMs - now) / 1000));
  const days = Math.floor(delta / 86_400);
  delta -= days * 86_400;
  const hours = Math.floor(delta / 3_600);
  delta -= hours * 3_600;
  const minutes = Math.floor(delta / 60);
  const seconds = delta - minutes * 60;
  return { days, hours, minutes, seconds, finished: targetMs - now <= 0 };
}

/**
 * Eye-catching countdown — each cell has a deep charcoal panel with a soft
 * gold inner ring + animated shimmer band. The seconds cell has a pulsing
 * gold halo to draw attention. Digits flip via framer-motion.
 */
export default function Countdown({ target, compact = false }: Props) {
  const targetMs = useMemo(() => {
    const iso = target ?? process.env.NEXT_PUBLIC_LAUNCH_AT ?? DEFAULT_TARGET;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Date.parse(DEFAULT_TARGET);
  }, [target]);

  const [mounted, setMounted] = useState(false);
  const [parts, setParts] = useState<Parts>(() => diff(targetMs));

  useEffect(() => {
    setMounted(true);
    setParts(diff(targetMs));
    const id = setInterval(() => setParts(diff(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const cells = [
    { label: "days", value: parts.days, pad: 1 },
    { label: "hours", value: parts.hours, pad: 2 },
    { label: "minutes", value: parts.minutes, pad: 2 },
    { label: "seconds", value: parts.seconds, pad: 2 },
  ];

  return (
    <Stack
      direction="row"
      spacing={compact ? 0.85 : 1.1}
      sx={{ width: "100%", "& > *": { flex: 1 } }}
      role="timer"
      aria-label="Time until launch"
    >
      {cells.map((cell, i) => {
        const isSeconds = i === 3;
        return (
          <Box
            key={cell.label}
            sx={{
              position: "relative",
              borderRadius: 2,
              background:
                "linear-gradient(180deg, #1F1F22 0%, #131316 100%)",
              py: compact ? 1.5 : 1.85,
              px: 0.75,
              textAlign: "center",
              overflow: "hidden",
              border: "1px solid rgba(201,168,118,0.2)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 28px -16px rgba(20,20,20,0.5)",
              // Animated gold shimmer band that sweeps every ~4s
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "60%",
                height: "100%",
                background:
                  "linear-gradient(120deg, transparent 0%, rgba(201,168,118,0.18) 50%, transparent 100%)",
                animation: `shimmer${i} 4.${4 + i}s ease-in-out infinite`,
              },
              [`@keyframes shimmer${i}`]: {
                "0%, 60%": { left: "-100%" },
                "100%": { left: "120%" },
              },
              "@media (prefers-reduced-motion: reduce)": {
                "&::before": { animation: "none" },
              },
            }}
          >
            {/* Gold accent stripe on top */}
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                top: 0,
                left: "15%",
                right: "15%",
                height: 1.5,
                background:
                  "linear-gradient(90deg, transparent, #C9A876, transparent)",
              }}
            />

            {/* Soft halo pulse on the seconds cell to anchor urgency */}
            {isSeconds && (
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: 2,
                  border: "1px solid rgba(201,168,118,0.6)",
                  pointerEvents: "none",
                  animation: "secondsPulse 2.4s ease-in-out infinite",
                  "@keyframes secondsPulse": {
                    "0%, 100%": {
                      opacity: 0.55,
                      boxShadow: "0 0 0 0 rgba(201,168,118,0.45)",
                    },
                    "50%": {
                      opacity: 1,
                      boxShadow: "0 0 16px 4px rgba(201,168,118,0.55)",
                    },
                  },
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              />
            )}

            <Box
              sx={{
                position: "relative",
                fontFamily: "var(--font-display)",
                color: "#F8F5EE",
                fontSize: compact ? "1.65rem" : "2.1rem",
                lineHeight: 1,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                minHeight: compact ? 28 : 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
                textShadow: "0 1px 12px rgba(201,168,118,0.25)",
              }}
              aria-live={isSeconds ? "off" : "polite"}
            >
              {!mounted ? (
                <span>--</span>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={cell.value}
                    initial={{ y: -16, opacity: 0, rotateX: -45 }}
                    animate={{ y: 0, opacity: 1, rotateX: 0 }}
                    exit={{ y: 16, opacity: 0, rotateX: 45 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: "inline-block" }}
                  >
                    {String(cell.value).padStart(cell.pad, "0")}
                  </motion.span>
                </AnimatePresence>
              )}
            </Box>
            <Typography
              sx={{
                mt: 0.85,
                position: "relative",
                color: "#C9A876",
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {cell.label}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

export function CountdownProgress({ target }: { target?: string }) {
  const targetMs = useMemo(() => {
    const iso = target ?? process.env.NEXT_PUBLIC_LAUNCH_AT ?? DEFAULT_TARGET;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Date.parse(DEFAULT_TARGET);
  }, [target]);

  const [mounted, setMounted] = useState(false);
  const [parts, setParts] = useState<Parts>(() => diff(targetMs));

  useEffect(() => {
    setMounted(true);
    setParts(diff(targetMs));
    const id = setInterval(() => setParts(diff(targetMs)), 60_000);
    return () => clearInterval(id);
  }, [targetMs]);

  const TOTAL_DAYS = 30;
  const remaining =
    parts.days * 86_400 + parts.hours * 3_600 + parts.minutes * 60 + parts.seconds;
  const total = TOTAL_DAYS * 86_400;
  const pct = !mounted
    ? 71
    : Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
        <Typography sx={{ color: "#52525B", fontSize: "0.78rem" }}>
          247 owners in line
        </Typography>
        <Typography sx={{ color: "#9B7B3A", fontSize: "0.82rem", fontWeight: 700 }}>
          {pct}% of interest
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 999,
          bgcolor: "#F4F4F5",
          "& .MuiLinearProgress-bar": {
            borderRadius: 999,
            backgroundImage: "linear-gradient(90deg, #B89968, #9B7B3A)",
          },
        }}
      />
    </Box>
  );
}
