"use client";
import { useEffect, useMemo, useState } from "react";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { motion, useReducedMotion } from "framer-motion";
import Countdown from "@/components/sections/Countdown";

const MotionBox = motion.create(Box);

const NEXT_STEPS = [
  {
    when: "Right now",
    title: "Open the sign-in email we just sent",
    body: "Single-use link from hello@aestheticsuccessnetwork.com. Check spam if you don't see it within a minute.",
  },
  {
    when: "Two clicks later",
    title: "Pick your tier and pay",
    body: "Stripe-secure checkout. Founding ($29/mo or $290/yr) for the first 100 members, then Standard ($99/mo or $990/yr).",
  },
  {
    when: "Portal unlocks instantly",
    title: "Hotline, library, partner deals",
    body: "The moment Stripe confirms the charge, /dashboard opens with the full member library and the hotline ready to take your first question.",
  },
];

export default function ThanksClient() {
  const params = useSearchParams();
  // Waitlist is members-only. Legacy ?role=vendor/expert links still land here
  // but the page renders the founding-member version.
  const role: "member" = "member";
  const again = params.get("again") === "1";
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <SitePage><SiteNav /></SitePage>
      <Box
        component="main"
        sx={{
          position: "relative",
          minHeight: "100vh",
          backgroundImage: "linear-gradient(180deg, #FBF8F1 0%, #F5F0E4 50%, #FFFFFF 100%)",
          color: "#0A1A2F",
        }}
      >
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}>
          {/* Hero */}
          <Stack spacing={3} sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              sx={{ display: "flex", justifyContent: "center" }}
            >
              <Box
                sx={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background:
                    "radial-gradient(circle at 30% 30%, #F0C16E 0%, #D9A84B 70%)",
                  boxShadow:
                    "0 20px 50px -20px rgba(217,168,75,0.65), 0 0 0 8px rgba(217,168,75,0.12)",
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 40, color: "#0A1A2F" }} />
              </Box>
            </MotionBox>

            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <Chip
                label="FOUNDING MEMBER · ON THE LIST"
                size="small"
                sx={{
                  bgcolor: "rgba(217,168,75,0.14)",
                  color: "#A07823",
                  border: "1px solid rgba(217,168,75,0.32)",
                  fontWeight: 700,
                  fontSize: "0.66rem",
                  letterSpacing: "0.14em",
                  mb: 2,
                }}
              />
              <Typography
                component="h1"
                sx={{
                  color: "#0A1A2F",
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "2.2rem", md: "3rem" },
                  fontWeight: 500,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  mb: 2,
                }}
              >
                {again ? "Welcome back." : "Check your email."}
              </Typography>
              <Typography
                sx={{
                  color: "#3B4A55",
                  maxWidth: 580,
                  mx: "auto",
                  fontSize: { xs: "1.05rem", md: "1.15rem" },
                  lineHeight: 1.65,
                }}
              >
                We just sent your sign-in link. Click it from your inbox, pick your
                membership plan, and finish payment. Your portal unlocks the moment
                Stripe confirms the charge. The founding rate stays at $29/month for the
                duration of your active membership.
              </Typography>
            </MotionBox>

            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              sx={{ display: "flex", justifyContent: "center" }}
            >
              {mounted && <Countdown variant="light" />}
            </MotionBox>
          </Stack>

          {/* What happens next */}
          <Box
            sx={{
              p: { xs: 3, md: 4.5 },
              borderRadius: 4,
              bgcolor: "#FFFFFF",
              border: "1px solid rgba(14,42,61,0.08)",
              boxShadow: "0 20px 60px -30px rgba(14,42,61,0.12)",
              mb: { xs: 5, md: 7 },
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "#A07823", letterSpacing: "0.16em", fontSize: "0.72rem" }}
            >
              WHAT HAPPENS NEXT
            </Typography>
            <Typography
              component="h2"
              sx={{
                color: "#0A1A2F",
                fontFamily: "var(--font-display)",
                fontSize: { xs: "1.5rem", md: "1.85rem" },
                fontWeight: 500,
                lineHeight: 1.2,
                mt: 0.5,
                mb: 3,
              }}
            >
              Three steps. That&apos;s it.
            </Typography>
            <Stack spacing={2.5}>
              {NEXT_STEPS.map((step, i) => (
                <Stack
                  key={step.title}
                  direction="row"
                  spacing={2.5}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "rgba(217,168,75,0.12)",
                      border: "1px solid rgba(217,168,75,0.3)",
                      color: "#A07823",
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                      fontSize: "0.95rem",
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: "#5C6770", display: "block", fontSize: "0.62rem" }}
                    >
                      {step.when}
                    </Typography>
                    <Typography
                      sx={{ color: "#0A1A2F", fontWeight: 600, fontSize: "1.05rem", mt: 0.25 }}
                    >
                      {step.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "#5C6770", mt: 0.5, lineHeight: 1.65 }}
                    >
                      {step.body}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* Footer CTA */}
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <Typography sx={{ color: "#5C6770", fontSize: "0.92rem" }}>
              Want to read more about what we&apos;re building?
            </Typography>
            <Button
              component={Link}
              href="/"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              sx={{
                borderColor: "rgba(14,42,61,0.18)",
                color: "#0A1A2F",
                textTransform: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                "&:hover": { borderColor: "#A07823", bgcolor: "rgba(217,168,75,0.06)" },
              }}
            >
              Back to landing
            </Button>
            <Typography sx={{ color: "#9CA3AB", fontSize: "0.78rem", mt: 2 }}>
              Reference: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {role}-{Math.floor(Date.now() / 1000).toString(36)}
              </Box>
            </Typography>
          </Stack>
        </Container>
      </Box>
      <SitePage><SiteFooter /></SitePage>
    </>
  );
}
