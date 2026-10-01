"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Box, Container, Typography } from "@mui/material";
import { keyframes } from "@mui/system";
import { isSupabaseImage } from "@/lib/images";

// Lifted from the restructure prototype: the shelf slides by exactly half
// its width (the card list is doubled), so the loop point is invisible.
const marq = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

type KitCard = { slug: string; title: string; card: string };

// Phase-one holdback (ASN-SWAP-CANON §6): the shelf is hidden until the
// library has real kits. Flip NEXT_PUBLIC_SHOW_JUST_DROPPED=true to show it.
const SHOW_JUST_DROPPED = process.env.NEXT_PUBLIC_SHOW_JUST_DROPPED === "true";

/**
 * "Just dropped." A single right-to-left auto-scrolling shelf of real
 * kit cards, newest first. Replaces the portal mockup + resource-count
 * sections. Under prefers-reduced-motion the marquee stops and the shelf
 * becomes a plain swipeable overflow-x row (the mobile fallback too).
 */
export default function JustDropped() {
  const [cards, setCards] = useState<KitCard[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!SHOW_JUST_DROPPED) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/kit-cards");
        if (!active || !res.ok) return;
        const body = (await res.json()) as { cards?: KitCard[] };
        if (active) setCards(body.cards ?? []);
      } catch {
        /* section renders nothing without cards */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!SHOW_JUST_DROPPED || cards.length === 0) return null;

  const animate = !reduceMotion && cards.length > 3;
  // ~7s per card feels like the prototype's 60s for its shelf; floor 30s.
  const seconds = Math.max(30, cards.length * 5);

  const shelf = (doubled: boolean) =>
    (doubled ? [...cards, ...cards] : cards).map((c, i) => (
      <Box
        key={`${c.slug}-${i}`}
        aria-hidden={doubled && i >= cards.length ? true : undefined}
        sx={{
          flex: "none",
          width: { xs: 150, md: 206 },
          // Uniform 3:4 frame regardless of the source art. The topic-led
          // portal cards are exactly 3:4 and fill it edge-to-edge; any
          // square cover sits sharp over a blurred blow-up of its own
          // artwork, so the frame fills with the card's own colors instead
          // of flat letterbox bars.
          position: "relative",
          aspectRatio: "3 / 4",
          borderRadius: "10px",
          overflow: "hidden",
          bgcolor: "#0A1A2F",
          boxShadow: "0 10px 26px -8px rgba(14,42,61,0.35)",
        }}
      >
        <Image
          src={c.card}
          alt=""
          aria-hidden
          fill
          unoptimized={!isSupabaseImage(c.card)}
          sizes="(max-width: 900px) 150px, 206px"
          style={{
            objectFit: "cover",
            filter: "blur(16px) brightness(0.7) saturate(1.15)",
            transform: "scale(1.3)",
          }}
        />
        <Image
          src={c.card}
          alt={doubled && i >= cards.length ? "" : c.title}
          fill
          unoptimized={!isSupabaseImage(c.card)}
          sizes="(max-width: 900px) 150px, 206px"
          style={{ objectFit: "contain" }}
        />
      </Box>
    ));

  return (
    <Box id="library" component="section" sx={{ bgcolor: "#F6F1E7", py: { xs: 5, md: 7 } }}>
      <Container maxWidth="lg" sx={{ textAlign: "center" }}>
        <Typography
          sx={{
            color: "#A07823",
            fontSize: "0.78rem",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          The library
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.7rem", md: "2.25rem" },
            color: "#0A1A2F",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            my: 0.75,
          }}
        >
          Just dropped.
        </Typography>
        <Typography sx={{ color: "#5C6770", fontSize: "1rem", lineHeight: 1.6, maxWidth: 640, mx: "auto", mb: 3.5 }}>
          New expert kits from real expert sessions land every week. Every one is yours
          from day one: action guide, checklist, worksheet, training video, and
          the expert a booking button away.
        </Typography>
      </Container>

      {animate ? (
        <Box
          sx={{
            overflow: "hidden",
            maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 2,
              width: "max-content",
              animation: `${marq} ${seconds}s linear infinite`,
            }}
          >
            {shelf(true)}
          </Box>
        </Box>
      ) : (
        // Reduced-motion / few-cards fallback: plain momentum swipe. A
        // partially visible card at the edge is the scroll affordance.
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            px: { xs: 2, md: 4 },
            pb: 1,
            WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {shelf(false)}
        </Box>
      )}
    </Box>
  );
}
