"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isSupabaseImage } from "@/lib/images";
import {
  Box,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { COLORS } from "@/theme";

// One API page — we loop pages client-side so EVERYONE is on the rail.
const PAGE_SIZE = 24;


export type DirectoryRow = {
  /** DB rows have an id (→ profile page); house/anchor rows have null (no link). */
  id?: string | null;
  name: string;
  badge?: string;
  // experts
  specialty?: string | null;
  company_name?: string | null;
  bio?: string | null;
  headshot_url?: string | null;
  // partners
  category?: string | null;
  description?: string | null;
  logo_url?: string | null;
};

/**
 * FoundingDirectory — ONE unified public roster of experts / partners.
 *
 * Every member renders on a continuously gliding marquee rail — nobody is
 * relegated to "page 2". The rail pauses on hover, each card clicks
 * through to the public profile, and with few cards (or reduced-motion
 * users) it falls back to a static centered row.
 */
export default function FoundingDirectory({
  kind,
  house = [],
  eyebrow,
  title,
  subtitle,
}: {
  kind: "experts" | "partners";
  house?: DirectoryRow[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Auto-glide: the rail is a real scroll container (so the arrows and
  // touch swipes work), advanced a fraction of a pixel per frame. The
  // card list is doubled, and the loop resets at the halfway point where
  // the content repeats — invisible to the eye.
  const railRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (reduceMotion || loading) return;
    const el = railRef.current;
    if (!el) return;
    let raf = 0;
    const step = () => {
      if (!pausedRef.current && el.scrollWidth > el.clientWidth + 40) {
        el.scrollLeft += 0.55;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, loading, rows.length]);

  const resumeTimerRef = useRef<number | null>(null);
  const nudge = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    // Hold the auto-glide while the smooth scroll animates — the rAF loop
    // writes scrollLeft every frame, which cancels scrollBy() mid-flight
    // and makes the arrows appear dead.
    pausedRef.current = true;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 1600);
    const half = el.scrollWidth / 2;
    // Stay inside the doubled content so smooth scrolling never hits an edge.
    if (dir === -1 && el.scrollLeft < 360) el.scrollLeft += half;
    if (dir === 1 && el.scrollLeft > half - 360) el.scrollLeft -= half;
    el.scrollBy({ left: dir * 330, behavior: "smooth" });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        // Page through the whole roster so every member is on the rail.
        const all: DirectoryRow[] = [];
        let page = 1;
        for (;;) {
          const res = await fetch(`/api/directory/${kind}?page=${page}&pageSize=${PAGE_SIZE}`, {
            cache: "no-store",
          });
          if (!res.ok) break;
          const body = (await res.json()) as { experts?: DirectoryRow[]; partners?: DirectoryRow[]; total?: number };
          const batch = (kind === "experts" ? body.experts : body.partners) ?? [];
          all.push(...batch);
          const total = body.total ?? all.length;
          if (all.length >= total || batch.length === 0 || page >= 20) break;
          page += 1;
        }
        if (!active) return;
        setRows(all);
      } catch {
        /* DB set stays empty on error; house anchors still render */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [kind]);

  const isExperts = kind === "experts";
  // Nothing to show at all → render nothing.
  if (!loading && rows.length === 0 && house.length === 0) return null;

  const cards: DirectoryRow[] = [...house, ...rows];
  const useMarquee = cards.length > 3;

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: COLORS.surfaceAlt, borderTop: `1px solid ${COLORS.line}`, borderBottom: `1px solid ${COLORS.line}` }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center", mb: 4 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: COLORS.accent }}>
            {eyebrow ?? (isExperts ? "The bench" : "The network")}
          </Typography>
          <Typography
            component="h2"
            sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 500, color: COLORS.ink, letterSpacing: "-0.01em" }}
          >
            {title ?? (isExperts ? "Meet the ASN experts" : "Meet the ASN partners")}
          </Typography>
          <Typography sx={{ color: COLORS.muted, fontSize: "0.98rem", maxWidth: 620 }}>
            {subtitle ??
              (isExperts
                ? "The people behind the kits: every hand-picked founding expert, live inside the member portal."
                : "The companies behind the member-exclusive offers: every hand-picked founding partner, live inside the member portal.")}
          </Typography>
        </Stack>

        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}>
            <CircularProgress size={22} sx={{ color: COLORS.accent }} />
          </Stack>
        ) : useMarquee ? (
          // Auto-gliding rail with manual arrows. Pauses while hovered so
          // every card is easy to click; the list is doubled for a
          // seamless loop.
          <Box
            // Pause on the WRAPPER so hovering the arrow buttons (siblings of
            // the rail, not children) also stops the auto-glide.
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            sx={{ position: "relative" }}
          >
            <Box
              ref={railRef}
              onTouchStart={() => { pausedRef.current = true; }}
              onTouchEnd={() => { window.setTimeout(() => { pausedRef.current = false; }, 1500); }}
              sx={{
                display: "flex",
                gap: 2.5,
                overflowX: "auto",
                mx: { xs: -2, md: -3 },
                px: { xs: 2, md: 3 },
                pb: 1,
                maskImage: "linear-gradient(90deg, transparent 0, black 4%, black 96%, transparent 100%)",
                "&::-webkit-scrollbar": { display: "none" },
                scrollbarWidth: "none",
              }}
            >
              {cards.map((r) => (
                <Box key={`a-${r.id ?? r.name}`} sx={{ width: { xs: 264, md: 300 }, flexShrink: 0, display: "flex" }}>
                  <DirectoryCard row={r} kind={kind} />
                </Box>
              ))}
              {cards.map((r) => (
                <Box key={`b-${r.id ?? r.name}`} aria-hidden sx={{ width: { xs: 264, md: 300 }, flexShrink: 0, display: "flex" }}>
                  <DirectoryCard row={r} kind={kind} />
                </Box>
              ))}
            </Box>

            {/* Manual scroll arrows */}
            <IconButton
              aria-label="Scroll left"
              onClick={() => nudge(-1)}
              sx={{
                position: "absolute",
                left: { xs: -6, md: -18 },
                top: "42%",
                zIndex: 3,
                width: 40,
                height: 40,
                bgcolor: "#FFFFFF",
                border: `1px solid ${COLORS.line}`,
                color: COLORS.ink,
                boxShadow: "0 8px 20px -8px rgba(10,26,47,0.35)",
                "&:hover": { bgcolor: "#FFFFFF", borderColor: COLORS.accent, color: COLORS.accent },
              }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
            <IconButton
              aria-label="Scroll right"
              onClick={() => nudge(1)}
              sx={{
                position: "absolute",
                right: { xs: -6, md: -18 },
                top: "42%",
                zIndex: 3,
                width: 40,
                height: 40,
                bgcolor: "#FFFFFF",
                border: `1px solid ${COLORS.line}`,
                color: COLORS.ink,
                boxShadow: "0 8px 20px -8px rgba(10,26,47,0.35)",
                "&:hover": { bgcolor: "#FFFFFF", borderColor: COLORS.accent, color: COLORS.accent },
              }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2.5 }}>
            {cards.map((r) => (
              <Box key={r.id ?? r.name} sx={{ width: { xs: "100%", sm: 300 }, display: "flex" }}>
                <DirectoryCard row={r} kind={kind} />
              </Box>
            ))}
          </Box>
        )}

        <Typography sx={{ textAlign: "center", mt: 2, fontSize: "0.74rem", color: COLORS.muted }}>
          Hover to pause · use the arrows to browse · click any card for the full profile
        </Typography>
      </Container>
    </Box>
  );
}

function DirectoryCard({ row, kind }: { row: DirectoryRow; kind: "experts" | "partners" }) {
  const isExperts = kind === "experts";
  const tagline = isExperts ? row.specialty : row.category;
  const blurb = isExperts ? row.bio : row.description;
  const img = isExperts ? row.headshot_url : row.logo_url;
  const href = row.id ? `/${kind}/${row.id}` : null;
  const badge = row.badge ?? (isExperts ? "Founding Expert" : "Founding Partner");

  const linkProps = href ? { component: Link, href } : {};

  return (
    <Box
      {...linkProps}
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        textDecoration: "none",
        color: "inherit",
        borderRadius: 3,
        border: `1px solid ${COLORS.line}`,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        cursor: href ? "pointer" : "default",
        transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
        ...(href
          ? {
              "&:hover": {
                transform: "translateY(-3px)",
                borderColor: COLORS.accent,
                boxShadow: "0 22px 44px -20px rgba(217,168,75,0.4)",
              },
              "&:focus-visible": { outline: `2px solid ${COLORS.accent}`, outlineOffset: 3 },
            }
          : {}),
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: isExperts ? "1 / 1" : "16 / 9",
          bgcolor: COLORS.surfaceAlt,
          borderBottom: `1px solid ${COLORS.line}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        {img ? (
          <Image
            src={img}
            alt={row.name}
            fill
            sizes="(max-width: 600px) 100vw, 320px"
            // Only Supabase-hosted images go through the optimizer — these
            // URLs are expert/partner-supplied data, and next/image THROWS
            // on any hostname not in next.config remotePatterns.
            unoptimized={!isExperts || !isSupabaseImage(img)}
            style={isExperts ? { objectFit: "cover", objectPosition: "center top" } : { objectFit: "contain", padding: 26 }}
          />
        ) : (
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700, color: COLORS.accent, fontSize: "2.4rem" }}>
            {initials(row.name)}
          </Typography>
        )}
        <Box
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            px: 1.25,
            py: 0.4,
            borderRadius: 999,
            bgcolor: "rgba(10,26,47,0.85)",
            color: "#F0C16E",
            fontSize: "0.62rem",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </Box>
      </Box>

      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", flex: 1 }}>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 600, color: COLORS.ink, lineHeight: 1.2, letterSpacing: "-0.01em" }} noWrap>
          {row.name}
        </Typography>
        {tagline && (
          <Typography sx={{ fontSize: "0.72rem", color: COLORS.accent, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", mt: 0.5 }} noWrap>
            {tagline}
          </Typography>
        )}
        {blurb && (
          <Typography
            sx={{ fontSize: "0.87rem", color: COLORS.inkSoft, lineHeight: 1.55, mt: 1.25, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {blurb}
          </Typography>
        )}
        {href && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: "auto", pt: 1.75, color: COLORS.accent, fontSize: "0.8rem", fontWeight: 700 }}>
            View profile <ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
