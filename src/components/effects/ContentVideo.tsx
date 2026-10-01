"use client";
import { useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Hero content panel (legacy hero experiment, not on the current home
 * page): a tall rounded "video card" showing practice-related motion.
 * The source and poster are env-driven so no third-party stock clip ships
 * by default; with no NEXT_PUBLIC_HERO_VIDEO_URL the panel shows the
 * gradient plate and the chips only.
 *
 * Three small floating UI chips overlay the video to ground the visitor in
 * what the membership actually is: Hotline, partner deals, vetted experts.
 */
const VIDEO_SRC = process.env.NEXT_PUBLIC_HERO_VIDEO_URL ?? "";
const VIDEO_POSTER = process.env.NEXT_PUBLIC_HERO_POSTER_URL ?? "";

const MotionBox = motion.create(Box);

export default function ContentVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const reduced = useReducedMotion();

  return (
    <MotionBox
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: { xs: "4 / 5", md: "5 / 6" },
        borderRadius: 4,
        overflow: "hidden",
        bgcolor: "#0A1A2F",
        border: "1px solid rgba(14,42,61,0.12)",
        boxShadow: "0 60px 120px -40px rgba(14,42,61,0.45), 0 0 0 1px rgba(217,168,75,0.1)",
      }}
    >
      {/* Gold accent strip across the top */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 0,
          left: "8%",
          right: "8%",
          height: 2,
          zIndex: 4,
          background:
            "linear-gradient(90deg, transparent, rgba(240,193,110,0.95), transparent)",
        }}
      />

      {/* Background poster image fallback. Sits behind the <video> so even
          if the video URL fails or is slow, the panel shows a real frame
          immediately. Only rendered when a poster is configured, so there is
          never a broken image. */}
      {VIDEO_POSTER && (
        <Box
          component="img"
          src={VIDEO_POSTER}
          alt="An aesthetic practice owner welcoming a patient"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",
            zIndex: 1,
            filter: "saturate(105%) contrast(102%)",
          }}
        />
      )}

      {/* The motion clip (decorative, muted background loop). If the URL
          fails, the poster image above remains. Only mounted when a source
          is configured. */}
      {VIDEO_SRC && (
        <Box
          ref={ref}
          component="video"
          src={VIDEO_SRC}
          poster={VIDEO_POSTER || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: 2,
          }}
        />
      )}

      {/* Vignette so floating chips read against any frame */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          background:
            "linear-gradient(180deg, rgba(2,3,8,0.25) 0%, rgba(2,3,8,0.0) 35%, rgba(2,3,8,0.0) 60%, rgba(2,3,8,0.75) 100%)",
        }}
      />

      {/* Floating trust chips, connect the imagery to the product */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          p: { xs: 2, md: 2.5 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <MotionBox
          initial={reduced ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <FloatingChip
            icon={<HeadsetMicOutlinedIcon sx={{ fontSize: 14 }} />}
            title="Expert Hotline"
            subtitle="Written reply in 2 to 3 business days"
          />
        </MotionBox>

        <Stack direction="row" spacing={1} sx={{ alignSelf: "flex-end" }}>
          <MotionBox
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <FloatingChip
              icon={<HandshakeOutlinedIcon sx={{ fontSize: 14 }} />}
              title="Partner deals"
              subtitle="Member-only pricing"
              compact
            />
          </MotionBox>
          <MotionBox
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <FloatingChip
              icon={<VerifiedOutlinedIcon sx={{ fontSize: 14 }} />}
              title="Vetted experts"
              subtitle="Real specialists"
              compact
            />
          </MotionBox>
        </Stack>
      </Box>

      {/* Caption pinned at the bottom, sits over the dark vignette */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5,
          p: { xs: 2, md: 2.5 },
        }}
      >
        <Typography
          sx={{
            color: "rgba(246,241,231,0.65)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            mb: 0.5,
          }}
        >
          For aesthetic practice owners
        </Typography>
        <Typography
          sx={{
            color: "#F6F1E7",
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1rem", md: "1.15rem" },
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            maxWidth: 320,
          }}
        >
          One number to call. One network behind every decision.
        </Typography>
      </Box>
    </MotionBox>
  );
}

function FloatingChip({
  icon,
  title,
  subtitle,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "rgba(255,255,255,0.94)",
        border: "1px solid rgba(14,42,61,0.08)",
        borderRadius: 999,
        py: compact ? 0.5 : 0.75,
        pl: compact ? 0.85 : 1,
        pr: compact ? 1.25 : 1.5,
        backdropFilter: "blur(10px)",
        boxShadow: "0 14px 28px -14px rgba(2,3,8,0.5)",
      }}
    >
      <Box
        sx={{
          width: compact ? 22 : 24,
          height: compact ? 22 : 24,
          borderRadius: "50%",
          bgcolor: "rgba(217,168,75,0.16)",
          color: "#A07823",
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          sx={{
            color: "#0A1A2F",
            fontSize: compact ? "0.72rem" : "0.78rem",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            color: "#5C6770",
            fontSize: compact ? "0.62rem" : "0.66rem",
            lineHeight: 1.2,
          }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
