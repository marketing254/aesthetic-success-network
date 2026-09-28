"use client";
import { useEffect, useState } from "react";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Lock,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Pause,
  PhoneCall,
  Play,
  Search,
  Star,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { libraryPreviewSection, libraryPresenter } from "@/lib/content";

const MotionBox = motion.create(Box);

// Reduced from 8 to 6 cards for a less congested grid layout.
// Each entry maps to a topic-specific icon as the thumbnail "still frame."
type LibraryEntry = {
  title: string;
  track: string;
  duration: string;
  durationSec: number;
  Icon: LucideIcon;
};

// Dead component (not rendered anywhere). Kept for reference; titles are
// illustrative aesthetics examples, not real kits.
const NOW_PLAYING: LibraryEntry = {
  title: "Med spa KPIs that matter",
  track: "Operations & Compliance",
  duration: "47 min",
  durationSec: 47 * 60,
  Icon: BarChart3,
};

const LIBRARY: LibraryEntry[] = [
  {
    title: "Pricing injectables to protect your margin",
    track: "Pricing & Margins",
    duration: "58 min",
    durationSec: 58 * 60,
    Icon: TrendingUp,
  },
  {
    title: "Aesthetic marketing that fills the calendar",
    track: "Marketing & Growth",
    duration: "52 min",
    durationSec: 52 * 60,
    Icon: Search,
  },
  {
    title: "The consult that converts without pressure",
    track: "Consult & Conversion",
    duration: "33 min",
    durationSec: 33 * 60,
    Icon: Users,
  },
  {
    title: "Hiring and keeping a great injector",
    track: "Team & Culture",
    duration: "28 min",
    durationSec: 28 * 60,
    Icon: Calendar,
  },
  {
    title: "Retention and membership plans",
    track: "Patient Experience",
    duration: "44 min",
    durationSec: 44 * 60,
    Icon: Star,
  },
  {
    title: "Case acceptance with photos",
    track: "Practice Management",
    duration: "42 min",
    durationSec: 42 * 60,
    Icon: Megaphone,
  },
];

const NAV_ITEMS: { label: string; icon: LucideIcon; badge: string; active?: boolean }[] = [
  { label: "Hotline", icon: PhoneCall, badge: "2 to 3 days" },
  { label: "Resource library", icon: Play, badge: "Weekly", active: true },
  { label: "Network", icon: Users, badge: "New" },
  { label: "Partner deals", icon: TrendingUp, badge: "Growing" },
  { label: "Live sessions & CE", icon: Megaphone, badge: "Monthly" },
  { label: "Account", icon: Calendar, badge: "" },
];

export default function MemberLibraryPreview() {
  const reduced = useReducedMotion();
  // 12-second trailer: progress fills 0 → 100, then we flip to LOCKED state
  // so visitors hit the membership wall. No login during playback.
  const TRAILER_DURATION_SEC = 12;
  const TRAILER_DURATION_MS = TRAILER_DURATION_SEC * 1000;
  const TRAILER_STEP_MS = 100;
  const STEP_PCT = 100 / (TRAILER_DURATION_MS / TRAILER_STEP_MS);

  const [progress, setProgress] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (reduced) {
      // Reduced motion: show the locked state immediately.
      setProgress(100);
      setLocked(true);
      return;
    }
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + STEP_PCT;
        if (next >= 100) {
          setLocked(true);
          return 100;
        }
        return next;
      });
    }, TRAILER_STEP_MS);
    return () => clearInterval(id);
  }, [reduced, STEP_PCT, TRAILER_DURATION_MS]);

  // Trailer time display (0:00 → 0:12). Total stays as the real lesson length.
  const trailerCurrentSec = Math.floor((TRAILER_DURATION_SEC * progress) / 100);
  const totalSec = NOW_PLAYING.durationSec;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 7, md: 10 },
        bgcolor: "#F8F5EE",
        borderTop: "1px solid #E7E2D6",
        overflow: "hidden",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={1.25} sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 5, md: 6 } }}>
          <Typography
            sx={{
              color: "#9B7B3A",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {libraryPreviewSection.eyebrow}
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: "#1A1A1A",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.7rem", md: "2.1rem" },
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {libraryPreviewSection.title}
          </Typography>
          <Typography sx={{ color: "#52525B", fontSize: { xs: "0.95rem", md: "1.02rem" } }}>
            {libraryPreviewSection.subtitle}
          </Typography>
        </Stack>

        {/* PORTAL MOCK — bigger, less congested */}
        <MotionBox
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          sx={{
            bgcolor: "#FFFFFF",
            borderRadius: 3,
            border: "1px solid #E7E2D6",
            overflow: "hidden",
            boxShadow:
              "0 1px 2px rgba(20,20,20,0.04), 0 30px 80px -40px rgba(20,20,20,0.2)",
          }}
        >
          {/* Window chrome */}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.5,
              bgcolor: "#0A2236",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Box sx={{ display: "flex", gap: 0.75 }}>
              <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#E07A5F" }} />
              <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#F0C16E" }} />
              <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: "#81B29A" }} />
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", fontWeight: 500 }}>
                portal.aestheticsuccessnetwork.com / library
              </Typography>
            </Box>
            <Box sx={{ width: 80 }} />
          </Stack>

          {/* Body — sidebar + main content */}
          <Grid container sx={{ minHeight: { xs: 540, md: 640 } }}>
            {/* SIDEBAR — dark navy, makes the cream player pop */}
            <Grid
              size={{ xs: 12, md: 2.5 }}
              sx={{
                bgcolor: "#0E2A3D",
                backgroundImage:
                  "linear-gradient(180deg, #0E2A3D 0%, #06182A 100%)",
                borderRight: { md: "1px solid rgba(255,255,255,0.06)" },
                p: 2,
                color: "#FFFFFF",
              }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #F0C16E 0%, #A07823 100%)",
                      color: "#0A1320",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.74rem",
                      boxShadow: "0 4px 12px -4px rgba(217,168,75,0.5)",
                    }}
                  >
                    Dr
                  </Box>
                  <Box>
                    <Typography sx={{ color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 600, lineHeight: 1.2 }}>
                      You
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.66rem" }}>
                      Founding · #007
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={0.4}>
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.active;
                    return (
                      <Box
                        key={item.label}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                          px: 1,
                          py: 0.85,
                          borderRadius: 1.25,
                          bgcolor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                          border: isActive ? "1px solid rgba(217,168,75,0.35)" : "1px solid transparent",
                          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                          fontWeight: isActive ? 600 : 500,
                          boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.18)" : "none",
                        }}
                      >
                        <Icon size={14} color={isActive ? "#F0C16E" : "rgba(255,255,255,0.55)"} />
                        <Typography sx={{ fontSize: "0.82rem", flex: 1, color: "inherit", fontWeight: "inherit" }}>
                          {item.label}
                        </Typography>
                        {item.badge && (
                          <Box
                            sx={{
                              px: 0.65,
                              py: 0.1,
                              borderRadius: 0.85,
                              bgcolor: isActive ? "rgba(217,168,75,0.18)" : "transparent",
                              color: isActive ? "#F0C16E" : "rgba(255,255,255,0.5)",
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              border: isActive ? "1px solid rgba(217,168,75,0.35)" : "none",
                            }}
                          >
                            {item.badge}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                <Box sx={{ pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <Typography
                    sx={{
                      color: "#F0C16E",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      mb: 0.65,
                    }}
                  >
                    Savings ledger
                  </Typography>
                  <Typography sx={{ color: "#FFFFFF", fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, lineHeight: 1 }}>
                    $4,820
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.7rem", mt: 0.4 }}>
                    via vendor network YTD
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* MAIN — featured player + library grid */}
            <Grid size={{ xs: 12, md: 9.5 }} sx={{ p: { xs: 2.5, md: 3.5 } }}>
              {/* TRAILER — plays 12s then locks. No login during playback. */}
              <FeaturedCard
                entry={NOW_PLAYING}
                progress={progress}
                locked={locked}
                currentTime={formatTime(trailerCurrentSec)}
                totalTime={formatTime(totalSec)}
                trailerLength={TRAILER_DURATION_SEC}
              />

              {/* Library section header */}
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  mt: 3.5,
                  mb: 2,
                }}
              >
                <Typography
                  sx={{
                    color: "#1A1A1A",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.05rem",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Next in your library
                </Typography>
                <Typography sx={{ color: "#71717A", fontSize: "0.78rem" }}>
                  6 of a growing library
                </Typography>
              </Stack>

              {/* Library grid — 3 columns, 2 rows = 6 cards. Breathable. */}
              <Grid container spacing={2}>
                {LIBRARY.map((entry, i) => (
                  <Grid key={entry.title} size={{ xs: 12, sm: 6, md: 4 }}>
                    <ThumbnailCard entry={entry} index={i} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </MotionBox>

        <Typography
          variant="body2"
          sx={{
            color: "#71717A",
            fontSize: "0.82rem",
            textAlign: "center",
            mt: 3,
            fontStyle: "italic",
          }}
        >
          A preview of the member portal. Resources update in real time when admins publish.
        </Typography>
      </Container>
    </Box>
  );
}

/**
 * Featured trailer card. Plays a 12-second trailer (no login wall),
 * then flips to a locked state with a membership CTA.
 */
function FeaturedCard({
  entry,
  progress,
  locked,
  currentTime,
  totalTime,
  trailerLength,
}: {
  entry: LibraryEntry;
  progress: number;
  locked: boolean;
  currentTime: string;
  totalTime: string;
  trailerLength: number;
}) {
  const { Icon } = entry;
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2.5,
        bgcolor: "#FBF6EA",
        overflow: "hidden",
        border: "1px solid #E7DBBA",
        // Soft pulsing ring around the whole card to indicate live playback
        boxShadow:
          "0 0 0 1px rgba(160,120,35,0.18), 0 20px 40px -16px rgba(160,120,35,0.25)",
        animation: "featuredPulse 3s ease-in-out infinite",
        "@keyframes featuredPulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px rgba(160,120,35,0.18), 0 20px 40px -16px rgba(160,120,35,0.18)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgba(160,120,35,0.4), 0 24px 48px -16px rgba(160,120,35,0.32)",
          },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {/* Top: visual still + play state */}
      <Box
        sx={{
          position: "relative",
          aspectRatio: "16 / 6.5",
          background:
            "linear-gradient(135deg, #FFFBED 0%, #F2E5C5 100%)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "auto 1fr auto" },
          alignItems: "center",
          gap: { xs: 2, sm: 3 },
          px: { xs: 2.5, md: 3.5 },
          py: { xs: 2.5, md: 3 },
        }}
      >
        {/* Soft gold glow blob */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,168,75,0.32) 0%, transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        {/* Large icon as visual still */}
        <Box
          sx={{
            width: { xs: 56, sm: 72 },
            height: { xs: 56, sm: 72 },
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(160,120,35,0.12)",
            border: "1px solid rgba(160,120,35,0.32)",
            color: "#7A5B17",
            flexShrink: 0,
          }}
        >
          <Icon size={32} strokeWidth={1.8} />
        </Box>

        {/* Text + status */}
        <Box sx={{ position: "relative", minWidth: 0 }}>
          <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", mb: 0.85 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "#E07A5F",
                boxShadow: "0 0 8px rgba(224,122,95,0.7)",
                animation: "liveDot 1.4s ease-in-out infinite",
                "@keyframes liveDot": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.3 },
                },
              }}
            />
            <Typography
              sx={{
                color: "#C24B30",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {locked ? "Trailer complete" : `Free trailer · ${trailerLength}s`}
            </Typography>
            <Typography
              sx={{
                color: "#7A5B17",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                ml: 1,
              }}
            >
              · {entry.track}
            </Typography>
          </Stack>
          <Typography
            sx={{
              color: "#0A1320",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.05rem", sm: "1.25rem" },
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {entry.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1, color: "#5C6770" }}>
            {/* Presenter bug: initials tile, no single named host */}
            <Box
              aria-label={libraryPresenter.name}
              sx={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1px solid rgba(160,120,35,0.45)",
                bgcolor: "#0A1A2F",
                color: "#F0C16E",
                fontSize: "0.42rem",
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                letterSpacing: "0.02em",
              }}
            >
              {libraryPresenter.initials}
            </Box>
            <Typography sx={{ color: "#5C6770", fontSize: "0.75rem", fontWeight: 500 }}>
              {libraryPresenter.name}
            </Typography>
            <Box sx={{ width: 2, height: 2, borderRadius: "50%", bgcolor: "#C5BDAB" }} />
            <Typography sx={{ color: "#5C6770", fontSize: "0.75rem" }}>
              {entry.duration}
            </Typography>
          </Stack>
        </Box>

        {/* Play/Pause/Lock control */}
        <Box
          sx={{
            display: { xs: "none", sm: "grid" },
            placeItems: "center",
            width: 50,
            height: 50,
            borderRadius: "50%",
            bgcolor: locked ? "rgba(160,120,35,0.12)" : "#A07823",
            color: locked ? "#7A5B17" : "#FFFBED",
            border: locked ? "1px solid rgba(160,120,35,0.45)" : "none",
            cursor: locked ? "default" : "pointer",
            transition: "transform 200ms ease, background 200ms ease",
            "&:hover": locked
              ? undefined
              : { transform: "scale(1.05)", bgcolor: "#7A5B17" },
          }}
        >
          {locked ? (
            <Lock size={18} strokeWidth={2.4} />
          ) : (
            <Pause size={20} strokeWidth={2.5} fill="#FFFBED" />
          )}
        </Box>
      </Box>

      {/* LOCKED OVERLAY — appears after the trailer completes */}
      {locked && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(251,246,234,0.55) 0%, rgba(251,246,234,0.92) 60%, rgba(251,246,234,0.97) 100%)",
            backdropFilter: "blur(2px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.25,
            px: { xs: 2.5, md: 4 },
            py: { xs: 3, md: 4 },
            zIndex: 5,
            animation: "lockFade 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
            "@keyframes lockFade": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(160,120,35,0.14)",
              border: "1px solid rgba(160,120,35,0.45)",
              color: "#7A5B17",
              boxShadow: "0 0 30px rgba(160,120,35,0.28)",
              mb: 0.5,
            }}
          >
            <Lock size={18} strokeWidth={2.4} />
          </Box>
          <Typography
            sx={{
              color: "#7A5B17",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Members only beyond this point
          </Typography>
          <Typography
            sx={{
              color: "#0A1320",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.05rem", sm: "1.25rem" },
              fontWeight: 600,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              textAlign: "center",
              maxWidth: 460,
            }}
          >
            Unlock the full 47-minute lesson + the entire library
          </Typography>
          <Typography
            sx={{
              color: "#3B4A55",
              fontSize: "0.86rem",
              lineHeight: 1.5,
              textAlign: "center",
              maxWidth: 480,
              mb: 1,
            }}
          >
            A growing library of expert kits, the Expert Hotline with written replies in 2 to 3 business days, member-only partner deals, and monthly live AMAs and CE, all in one founding membership at $49/mo.
          </Typography>
          <Button
            component={Link}
            href="/join"
            endIcon={<ArrowRight size={15} />}
            sx={{
              py: 1.1,
              px: 2.5,
              fontSize: "0.88rem",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
              bgcolor: "#0E2A3D !important",
              backgroundImage: "none !important",
              color: "#FFFBED !important",
              boxShadow: "0 8px 22px -10px rgba(14,42,61,0.45)",
              "&:hover": {
                bgcolor: "#06182A !important",
                backgroundImage: "none !important",
                color: "#FFFBED !important",
              },
            }}
          >
            Claim founding spot
          </Button>
        </Box>
      )}

      {/* Progress bar with time stamps */}
      <Box sx={{ position: "relative", px: { xs: 2.5, md: 3.5 }, pb: 2, pt: 1 }}>
        <Box
          sx={{
            position: "relative",
            height: 4,
            borderRadius: 999,
            bgcolor: "rgba(160,120,35,0.18)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #A07823 0%, #C9A876 50%, #E8D5A8 100%)",
              borderRadius: 999,
              boxShadow: "0 0 6px rgba(160,120,35,0.55)",
              transition: "width 0.1s linear",
            }}
          />
          {/* Playhead dot */}
          <Box
            sx={{
              position: "absolute",
              left: `${progress}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 11,
              height: 11,
              borderRadius: "50%",
              bgcolor: "#FFFBED",
              border: "2px solid #A07823",
              boxShadow: "0 0 8px rgba(160,120,35,0.6)",
              transition: "left 0.1s linear",
            }}
          />
        </Box>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mt: 1.25,
            color: "#7A8590",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Typography sx={{ color: "#7A5B17", fontSize: "0.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {currentTime}
            </Typography>
            <Typography sx={{ color: "#7A8590", fontSize: "0.75rem" }}>
              / {totalTime}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", color: "#7A8590" }}>
            <Volume2 size={14} />
            <MessageSquare size={14} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

/**
 * Standard library thumbnail card — clean rectangle with topic icon and meta.
 * Hover lifts slightly with gold border.
 */
function ThumbnailCard({ entry, index }: { entry: LibraryEntry; index: number }) {
  const reduced = useReducedMotion();
  const { Icon } = entry;

  return (
    <MotionBox
      initial={reduced ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.3),
        ease: [0.16, 1, 0.3, 1],
      }}
      sx={{
        position: "relative",
        cursor: "pointer",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid #E7E2D6",
        bgcolor: "#FFFFFF",
        transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: "#C9A876",
          boxShadow: "0 16px 32px -16px rgba(201,168,118,0.35)",
        },
      }}
    >
      {/* 16:9 thumbnail */}
      <Box
        sx={{
          position: "relative",
          aspectRatio: "16 / 9",
          background:
            "linear-gradient(135deg, #FFFBED 0%, #F2E5C5 100%)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          borderBottom: "1px solid #E7DBBA",
        }}
      >
        {/* Soft warm glow */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217,168,75,0.28) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Big topic icon */}
        <Box
          sx={{
            position: "relative",
            width: 56,
            height: 56,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(160,120,35,0.12)",
            border: "1px solid rgba(160,120,35,0.32)",
            color: "#7A5B17",
          }}
        >
          <Icon size={26} strokeWidth={1.8} />
        </Box>

        {/* Track label top-left */}
        <Typography
          sx={{
            position: "absolute",
            top: 10,
            left: 12,
            color: "#7A5B17",
            fontSize: "0.58rem",
            letterSpacing: "0.16em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {entry.track}
        </Typography>

        {/* Duration badge bottom-right */}
        <Box
          sx={{
            position: "absolute",
            bottom: 10,
            right: 10,
            px: 0.85,
            py: 0.25,
            borderRadius: 0.85,
            bgcolor: "rgba(10,19,32,0.85)",
            color: "#FFFBED",
            fontSize: "0.62rem",
            fontWeight: 700,
          }}
        >
          {entry.duration}
        </Box>

        {/* Play indicator on hover */}
        <Box
          className="play-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(10,19,32,0.18)",
            opacity: 0,
            transition: "opacity 200ms ease",
            ".MuiBox-root:hover > &": { opacity: 1 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              bgcolor: "#0E2A3D",
              color: "#FFFBED",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 6px 16px -6px rgba(14,42,61,0.5)",
            }}
          >
            <Play size={16} strokeWidth={2.5} fill="#FFFBED" />
          </Box>
        </Box>
      </Box>

      {/* Card body */}
      <Box sx={{ p: 1.75 }}>
        <Typography
          sx={{
            color: "#1A1A1A",
            fontSize: "0.88rem",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.005em",
            mb: 0.85,
          }}
        >
          {entry.title}
        </Typography>
        <Stack direction="row" spacing={0.85} sx={{ alignItems: "center" }}>
          <Box
            aria-label={libraryPresenter.name}
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              flexShrink: 0,
              bgcolor: "#0A1A2F",
              color: "#F0C16E",
              fontSize: "0.42rem",
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
              letterSpacing: "0.02em",
            }}
          >
            {libraryPresenter.initials}
          </Box>
          <Typography sx={{ color: "#52525B", fontSize: "0.74rem", fontWeight: 500 }}>
            {libraryPresenter.name}
          </Typography>
        </Stack>
      </Box>
    </MotionBox>
  );
}
