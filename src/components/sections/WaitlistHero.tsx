"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Check, Play, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import HeroFlowingCurves from "@/components/effects/HeroFlowingCurves";

const MotionBox = motion.create(Box);

export default function WaitlistHero() {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [email, setEmail] = useState("");

  // ONE ask: capture the email here, land on the 3-step member signup with
  // it prefilled. No validation gate — an empty email just means the first
  // step of the flow asks for it.
  const start = () => {
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    router.push(`/join/member${q}`);
  };

  return (
    <Box
      id="top"
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        pt: { xs: 5, md: 7 },
        pb: { xs: 6, md: 9 },
        bgcolor: "#FBF8F1",
        color: "#1A1A1A",
      }}
    >
      {/* Warm corner blooms — soft champagne glows in the upper-right and
          lower-left only. No center coverage. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(50% 55% at 90% 0%, rgba(217,168,75,0.22) 0%, transparent 65%), radial-gradient(45% 55% at 10% 100%, rgba(155,123,58,0.16) 0%, transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Flowing champagne curves — continuously redraw themselves from
          both corners, masked to fade through the center band so the
          headline stays crisp. No blue, no halos, no 3D canvas. */}
      <HeroFlowingCurves />

      <Container maxWidth="md" sx={{ position: "relative", zIndex: 2 }}>
        <Stack
          spacing={2.5}
          sx={{
            maxWidth: 760,
            mx: "auto",
            textAlign: "center",
            alignItems: "center",
          }}
        >
          <MotionBox
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            sx={{
              display: "inline-flex",
              alignSelf: "center",
              alignItems: "center",
              gap: 0.85,
              px: 1.4,
              py: 0.55,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(155,123,58,0.25)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Sparkles size={12} color="#9B7B3A" strokeWidth={2.4} />
            <Typography
              sx={{
                color: "#7A5F2A",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              For aesthetic practice owners · Curated by Business of Aesthetics, not an algorithm
            </Typography>
          </MotionBox>

          <MotionBox
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Typography
              variant="h1"
              component="h1"
              sx={{
                color: "#1A1A1A",
                fontFamily: "var(--font-display)",
                fontSize: { xs: "2.1rem", sm: "2.5rem", md: "3rem" },
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                fontWeight: 500,
              }}
            >
              Every practice problem gets a{" "}
              <Box
                component="span"
                sx={{
                  fontStyle: "italic",
                  backgroundImage:
                    "linear-gradient(120deg, #9B7B3A 0%, #C9A876 50%, #9B7B3A 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                written action plan
              </Box>{" "}
              in 2 to 3 business days.
            </Typography>
          </MotionBox>

          <MotionBox
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Typography
              sx={{
                color: "#52525B",
                fontSize: { xs: "1rem", md: "1.08rem" },
                lineHeight: 1.55,
                maxWidth: 620,
                mx: "auto",
              }}
            >
              The Expert Hotline routes your toughest questions to the right
              people. Vetted vendors give you member-only deals. New expert kits
              arrive weekly. That&apos;s the network. One membership.
            </Typography>
          </MotionBox>

          {/* ONE ask — email + Start your membership. Stacks full-width on
              phones (mobile is the primary layout for paid traffic). */}
          <MotionBox
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            sx={{ width: "100%", pt: 0.5 }}
          >
            <Stack
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ justifyContent: "center", maxWidth: 560, mx: "auto" }}
            >
              <TextField
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                fullWidth
                slotProps={{ htmlInput: { "aria-label": "Email address" } }}
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "#FFFFFF",
                    borderRadius: 2,
                    fontSize: "1rem",
                  },
                }}
              />
              <Button
                type="submit"
                sx={{
                  py: 1.5,
                  px: 3,
                  fontSize: "1rem",
                  fontWeight: 800,
                  textTransform: "none",
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  bgcolor: "#D9A84B !important",
                  backgroundImage: "none !important",
                  color: "#0A1A2F !important",
                  "&:hover": {
                    bgcolor: "#E5BA63 !important",
                    backgroundImage: "none !important",
                    transform: "translateY(-1px)",
                  },
                  transition: "transform 150ms ease, background 150ms ease",
                }}
              >
                Start your membership ›
              </Button>
            </Stack>
            <Typography sx={{ mt: 1.5, fontSize: "0.84rem", color: "#71717A" }}>
              Founding 100 · $49 a month, locked while your membership stays active · cancel anytime
            </Typography>
            <Box
              component="a"
              href="#tour"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                mt: 2,
                color: "#9B7B3A",
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                "&:hover": { color: "#7A5F2A" },
              }}
            >
              <Play size={14} fill="#9B7B3A" /> Watch the 2-minute tour
            </Box>
          </MotionBox>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              pt: 1,
              flexWrap: "wrap",
              rowGap: 1,
              color: "#71717A",
              fontSize: "0.82rem",
              justifyContent: "center",
            }}
          >
            {["30-day money-back guarantee", "Cancel anytime", "No spam"].map((line) => (
              <Stack
                key={line}
                direction="row"
                spacing={0.5}
                sx={{ alignItems: "center" }}
              >
                <Check size={13} color="#9B7B3A" strokeWidth={2.6} />
                <Typography sx={{ color: "#71717A", fontSize: "0.82rem" }}>
                  {line}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {/* "Now live" status chip — centered under the trust line.
              Green dot pulses on a 2s loop to signal active state. */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              alignSelf: "center",
              mt: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(231,226,214,0.7)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: 7,
                height: 7,
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  bgcolor: "#2C7A52",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  bgcolor: "#2C7A52",
                  animation: "liveStatusPulse 2s ease-out infinite",
                  "@keyframes liveStatusPulse": {
                    "0%": { transform: "scale(1)", opacity: 0.55 },
                    "80%, 100%": { transform: "scale(3.2)", opacity: 0 },
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                  },
                }}
              />
            </Box>
            <Typography
              sx={{ fontSize: "0.76rem", color: "#3B4A55", lineHeight: 1.3 }}
            >
              <Box component="span" sx={{ fontWeight: 700, color: "#1A1A1A" }}>
                Now live:
              </Box>{" "}
              founding membership, open to the first 100
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
