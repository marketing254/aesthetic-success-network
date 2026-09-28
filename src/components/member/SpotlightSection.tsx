"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { keyframes } from "@mui/system";
import { Box, Button, Chip, IconButton, Stack, Typography } from "@mui/material";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type { SvgIconComponent } from "@mui/icons-material";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

const ROTATE_MS = 4000;

export type Spotlight = {
  id: string;
  kind: "update" | "event" | "news" | "feature";
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  event_date: string | null;
  published_at: string | null;
};

type KindMeta = { label: string; fg: string; bg: string; accent: string; Icon: SvgIconComponent };
const KIND_META: Record<Spotlight["kind"], KindMeta> = {
  update: { label: "Update", fg: "#7A5B12", bg: "rgba(160,120,35,0.14)", accent: GOLD, Icon: CampaignRoundedIcon },
  event: { label: "Event", fg: "#1F5C40", bg: "rgba(34,108,78,0.14)", accent: "#2C7A52", Icon: EventRoundedIcon },
  news: { label: "News", fg: "#1B3A5C", bg: "rgba(31,58,92,0.14)", accent: "#1B3A5C", Icon: ArticleRoundedIcon },
  feature: { label: "Feature", fg: "#6E3346", bg: "rgba(110,51,70,0.14)", accent: "#6E3346", Icon: AutoAwesomeRoundedIcon },
};

const grow = keyframes`from { width: 0%; } to { width: 100%; }`;

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}

/**
 * "Spotlight / What's New" for expert + partner profiles.
 *
 * A standard media-and-text spotlight card (squared corners) in a
 * crossfading carousel. Fixed footprint so the sections below never
 * shift. Renders nothing when empty.
 */
export default function SpotlightSection({
  spotlights,
  hideHeader = false,
}: {
  spotlights: Spotlight[];
  /** Skip the built-in "Spotlight" header — for nesting under another
   *  section title (e.g. "Member offers" on profile pages). */
  hideHeader?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const count = spotlights?.length ?? 0;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (active >= count && count > 0) setActive(0);
  }, [active, count]);

  useEffect(() => {
    if (count <= 1 || paused || reduce) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reduce, active]);

  const go = useCallback((i: number) => setActive(() => ((i % count) + count) % count), [count]);

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  if (!spotlights || count === 0) return null;
  const idx = Math.min(active, count - 1);
  const activeAccent = KIND_META[spotlights[idx]!.kind].accent;

  return (
    <Box sx={{ maxWidth: { xs: "100%", sm: 560 } }}>
      {/* Header */}
      {!hideHeader && (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 1.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: "rgba(160,120,35,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: GOLD }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", color: INK_MUTED, textTransform: "uppercase", lineHeight: 1.2 }}>
            Spotlight
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK_SOFT, fontWeight: 500 }}>
            Latest news &amp; events
          </Typography>
        </Box>
        {count > 1 && (
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: INK_MUTED, letterSpacing: "0.04em" }}>
            {idx + 1}/{count}
          </Typography>
        )}
      </Stack>
      )}

      {/* Stage */}
      <Box
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        sx={{
          position: "relative",
          height: { xs: 250, sm: 212 },
          "&:hover .spot-arrow": { opacity: 0.96 },
        }}
      >
        {spotlights.map((s, i) => {
          const on = i === idx;
          return (
            <Box
              key={s.id}
              aria-hidden={!on}
              sx={{
                position: "absolute",
                inset: 0,
                opacity: on ? 1 : 0,
                transform: on ? "translateX(0)" : "translateX(10px)",
                transition: reduce ? "none" : "opacity 460ms ease, transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: on ? "auto" : "none",
                zIndex: on ? 2 : 1,
              }}
            >
              <SpotlightCard s={s} />
            </Box>
          );
        })}

        {count > 1 && (
          <>
            <CarouselArrow side="left" onClick={() => go(active - 1)} />
            <CarouselArrow side="right" onClick={() => go(active + 1)} />
          </>
        )}
      </Box>

      {/* Progress + dots */}
      {count > 1 && (
        <Stack spacing={1.25} sx={{ mt: 1.75, alignItems: "center" }}>
          {!reduce && (
            <Box sx={{ width: "100%", maxWidth: 200, height: 3, bgcolor: "rgba(10,26,47,0.08)", overflow: "hidden" }}>
              <Box
                key={`${idx}-${paused}`}
                sx={{
                  height: "100%",
                  bgcolor: activeAccent,
                  width: paused ? "0%" : undefined,
                  animation: paused ? "none" : `${grow} ${ROTATE_MS}ms linear forwards`,
                }}
              />
            </Box>
          )}
          <Stack direction="row" spacing={0.75}>
            {spotlights.map((s, i) => {
              const on = i === idx;
              return (
                <Box
                  key={s.id}
                  role="button"
                  aria-label={`Go to spotlight ${i + 1}`}
                  onClick={() => go(i)}
                  sx={{
                    height: 6,
                    width: on ? 22 : 6,
                    cursor: "pointer",
                    bgcolor: on ? GOLD : "rgba(122,133,144,0.3)",
                    transition: "width 260ms ease, background-color 260ms ease",
                    "&:hover": { bgcolor: on ? GOLD : "rgba(122,133,144,0.55)" },
                  }}
                />
              );
            })}
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <IconButton
      className="spot-arrow"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      size="small"
      sx={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [side]: { xs: 4, sm: -8 },
        zIndex: 10,
        width: 34,
        height: 34,
        borderRadius: 0.5,
        bgcolor: "rgba(255,255,255,0.92)",
        border: `1px solid ${LINE}`,
        color: INK,
        boxShadow: "0 6px 16px -8px rgba(10,26,47,0.45)",
        opacity: { xs: 0.92, sm: 0 },
        transition: "opacity 220ms ease, background-color 220ms ease",
        "&:hover": { bgcolor: "#FFFFFF" },
      }}
    >
      {side === "left" ? <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />}
    </IconButton>
  );
}

function SpotlightCard({ s }: { s: Spotlight }) {
  const m = KIND_META[s.kind];
  const date = s.kind === "event" ? fmtDate(s.event_date) : "";

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        borderRadius: 0.5,
        overflow: "hidden",
        display: "flex",
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        boxShadow: "0 14px 30px -22px rgba(10,26,47,0.4)",
      }}
    >
      {/* Media panel — flush to the card edge (standard media+text card) */}
      {s.image_url ? (
        <Box sx={{ position: "relative", width: { xs: 116, sm: 178 }, height: "100%", flexShrink: 0, bgcolor: "#FBF8F1" }}>
          <Image src={s.image_url} alt={s.title} fill unoptimized sizes="(max-width:600px) 116px, 178px" style={{ objectFit: "cover" }} />
          {/* thin accent seam */}
          <Box aria-hidden sx={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 3, bgcolor: m.accent }} />
        </Box>
      ) : (
        <Box aria-hidden sx={{ width: 5, flexShrink: 0, bgcolor: m.accent }} />
      )}

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", p: { xs: 2, sm: 2.5 } }}>
        {/* Meta row */}
        <Stack direction="row" spacing={0.9} sx={{ alignItems: "center", mb: 1.1, flexWrap: "wrap", gap: 0.6 }}>
          <Chip
            icon={<m.Icon sx={{ fontSize: "0.8rem !important", color: `${m.fg} !important` }} />}
            label={m.label}
            size="small"
            sx={{ bgcolor: m.bg, color: m.fg, height: 21, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", borderRadius: 0.5, "& .MuiChip-label": { px: 0.7 } }}
          />
          {date && (
            <Stack direction="row" spacing={0.4} sx={{ alignItems: "center", color: INK_MUTED }}>
              <EventRoundedIcon sx={{ fontSize: 13 }} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>{date}</Typography>
            </Stack>
          )}
        </Stack>

        {/* Title */}
        <Typography
          sx={{
            fontFamily: "var(--font-display)", fontSize: { xs: "1.1rem", sm: "1.2rem" }, fontWeight: 600, color: INK, lineHeight: 1.22, letterSpacing: "-0.015em", mb: 0.7,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {s.title}
        </Typography>

        {/* Body */}
        <Typography
          sx={{
            fontSize: "0.85rem", color: INK_SOFT, lineHeight: 1.55, whiteSpace: "pre-line",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {s.body}
        </Typography>

        {/* Link pinned to the bottom */}
        <Box sx={{ mt: "auto", pt: 1.25 }}>
          {s.link_url && (
            <Button
              component="a"
              href={s.link_url}
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ px: 1.5, py: 0.5, borderRadius: 0.5, textTransform: "none", fontWeight: 700, fontSize: "0.8rem", color: "#fff", bgcolor: m.accent, "&:hover": { bgcolor: m.accent, filter: "brightness(1.06)" } }}
            >
              {s.link_label || "Learn more"}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * SpotlightOfferCard — renders a "feature"-kind spotlight as an offer row
 * under a profile's "Member offers" heading, so spotlight-only offers
 * (e.g. promo codes announced via spotlights) don't leave that section
 * blank. The carousel above stays untouched.
 */
export function SpotlightOfferCard({ s }: { s: Spotlight }) {
  return (
    <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2, bgcolor: "#FFFFFF", p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "rgba(110,51,70,0.12)", display: "grid", placeItems: "center", flexShrink: 0, mt: 0.25 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 17, color: "#6E3346" }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{s.title}</Typography>
          <Typography sx={{ fontSize: "0.88rem", color: INK_SOFT, lineHeight: 1.55, mt: 0.5, whiteSpace: "pre-line" }}>
            {s.body}
          </Typography>
          {s.link_url && (
            <Button
              component="a"
              href={s.link_url}
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
              sx={{ mt: 0.75, px: 0, textTransform: "none", fontWeight: 700, color: GOLD, "&:hover": { bgcolor: "transparent", textDecoration: "underline" } }}
            >
              {s.link_label || "Claim this offer"}
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
