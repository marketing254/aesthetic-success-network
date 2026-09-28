"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

// Honesty pass (ASN-SWAP-CANON §3): the Hotline is written replies in 2 to 3
// business days, never "24/7" or "live". No podcasts; the only live benefit
// is "monthly live AMAs and CE". The value stack lists what a member gets
// with NO dollar figures (the DMN $/yr rows were unsourced). There is no
// $99 "early" tier: founding ($49) is followed directly by standard ($199).
const VALUE_STACK = [
  "The Expert Hotline: written action plans in 2 to 3 business days",
  "Full resource library, new expert kits weekly",
  "Every member-only partner deal",
  "Monthly live AMAs and CE",
  "Systems, SOPs, templates and checklists",
];

const FOUNDING_BULLETS = [
  "Everything in the list",
  "Locked at $49 for as long as your membership stays active",
  "Annual option: $490/yr for founding members, two months free",
  "30-day money-back guarantee",
];

const STANDARD_BULLETS = [
  "Everything in the list",
  "Annual option: $1,990/yr (two months free)",
  "Open enrollment, no waitlist",
  "30-day money-back guarantee",
];

type TierStat = { cap: number; taken: number; remaining: number; isOpen: boolean };

export default function Pricing() {
  const reduced = useReducedMotion();
  // Live availability for the founding (100) tier. We fall back to "open
  // with the full cap" if the API hiccups so the marketing page never goes
  // dark; the hard cap is still enforced server-side when the user reaches
  // /api/stripe/checkout. The API may also report an "early" tier for
  // plumbing reasons; ASN never opens it (EARLY_MEMBER_CAP = 0), so it is
  // ignored here.
  const [founding, setFounding] = useState<TierStat>({
    cap: 100,
    taken: 0,
    remaining: 100,
    isOpen: true,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/stripe/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { founding?: TierStat }) => {
        if (!active) return;
        if (d.founding) setFounding(d.founding);
      })
      .catch(() => {
        /* fall through to defaults */
      });
    return () => {
      active = false;
    };
  }, []);

  // Pick which tier to lead with. The home Pricing section is single-card
  // for visual focus; the multi-card grid lives at /pricing and /upgrade.
  const activeTier: "founding" | "standard" = founding.isOpen ? "founding" : "standard";

  const cardCopy =
    activeTier === "founding"
      ? {
          ribbon: `First 100 only · ${founding.remaining} of ${founding.cap} left`,
          eyebrow: "Founding member",
          price: "$49",
          strike: "$199/mo" as string | null,
          afterNote: "after the first 100 spots fill",
          bullets: FOUNDING_BULLETS,
          cta: "Claim a founding spot",
        }
      : {
          ribbon: "Open enrollment",
          eyebrow: "Standard member",
          price: "$199",
          strike: null as string | null,
          afterNote: "founding spots are filled. Same membership, standard rate",
          bullets: STANDARD_BULLETS,
          cta: "Become a member",
        };

  return (
    <Box
      id="pricing"
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#F8F5EE",
        borderTop: "1px solid #E4E4E7",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={1.25} sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 4, md: 5 } }}>
          <Typography
            sx={{
              color: "#7A5F2A",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Founding offer
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: "#1A1A1A",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.65rem", md: "2.1rem" },
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            $49 a month. Locked, for the first 100.
          </Typography>
          <Typography sx={{ color: "#52525B", fontSize: { xs: "0.95rem", md: "1.02rem" } }}>
            After the founding hundred, the rate is $199/mo. Founding members keep $49 for as long as their membership stays active.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {/* Value stack */}
          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                bgcolor: "#FFFFFF",
                border: "1px solid #E4E4E7",
                borderRadius: 2,
                p: { xs: 2.5, md: 3 },
                height: "100%",
              }}
            >
              <Typography
                sx={{
                  color: "#1A1A1A",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  mb: 0.5,
                }}
              >
                What you&apos;re actually getting
              </Typography>
              <Typography sx={{ color: "#52525B", fontSize: "0.85rem", mb: 2 }}>
                Everything a membership includes, from day one:
              </Typography>

              <Stack>
                {VALUE_STACK.map((label, i) => (
                  <Stack
                    key={label}
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "flex-start",
                      py: 1.25,
                      borderBottom: i < VALUE_STACK.length - 1 ? "1px dashed #E4E4E7" : "none",
                    }}
                  >
                    <Box component="span" sx={{ color: "#9B7B3A", fontWeight: 800, flexShrink: 0 }}>
                      ✓
                    </Box>
                    <Typography sx={{ color: "#1A1A1A", fontSize: "0.92rem", lineHeight: 1.5 }}>
                      {label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  mt: 2,
                  pt: 1.75,
                  borderTop: "2px solid #1A1A1A",
                }}
              >
                <Typography sx={{ color: "#1A1A1A", fontWeight: 800, fontSize: "1rem" }}>
                  One membership
                </Typography>
                <Typography sx={{ color: "#1A1A1A", fontWeight: 800, fontSize: "1rem" }}>
                  No upsell ladder
                </Typography>
              </Stack>
            </MotionBox>
          </Grid>

          {/* Plan card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                position: "relative",
                bgcolor: "#1A1A1A",
                color: "#FFFFFF !important",
                borderRadius: 2,
                p: { xs: 3, md: 3.5 },
                height: "100%",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%)",
                  bgcolor: "#1A1A1A",
                  color: "#FFFFFF !important",
                  px: 1.75,
                  py: 0.65,
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: "0.74rem",
                  whiteSpace: "nowrap",
                }}
              >
                {cardCopy.ribbon}
              </Box>

              <Typography
                sx={{
                  color: "#A8A29E",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "0.76rem",
                  mb: 0.65,
                  mt: 1,
                }}
              >
                {cardCopy.eyebrow}
              </Typography>

              <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.65 }}>
                <Typography
                  sx={{
                    color: "#FFFFFF",
                    fontFamily: "var(--font-display)",
                    fontSize: "3.2rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {cardCopy.price}
                </Typography>
                <Typography sx={{ color: "#A8A29E", fontSize: "1.05rem", fontWeight: 600 }}>
                  /mo
                </Typography>
              </Stack>

              <Typography sx={{ color: "#A8A29E", mt: 0.65, fontSize: "0.92rem" }}>
                {cardCopy.strike && (
                  <Box
                    component="span"
                    sx={{
                      textDecoration: "line-through",
                      mr: 0.5,
                    }}
                  >
                    {cardCopy.strike}
                  </Box>
                )}
                {cardCopy.afterNote}
              </Typography>

              <Stack spacing={1} sx={{ my: 2.5 }}>
                {cardCopy.bullets.map((b) => (
                  <Stack key={b} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Box
                      component="span"
                      sx={{
                        color: "#C9A876",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </Box>
                    <Typography sx={{ color: "#E7E2D6", fontSize: "0.95rem", lineHeight: 1.5 }}>
                      {b}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Button
                component={Link}
                href="/join/member"
                fullWidth
                endIcon={<ArrowRight size={16} />}
                sx={{
                  py: 1.35,
                  fontSize: "0.94rem",
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: 2,
                  bgcolor: "#1A1A1A !important",
                  backgroundImage: "none !important",
                  color: "#FFFFFF !important",
                  "&:hover": {
                    bgcolor: "#2A2A2A !important",
                    backgroundImage: "none !important",
                    color: "#FFFFFF !important",
                  },
                }}
              >
                {cardCopy.cta}
              </Button>

              <Typography
                sx={{
                  color: "#A8A29E",
                  fontSize: "0.78rem",
                  textAlign: "center",
                  mt: 1.5,
                }}
              >
                30-day money-back guarantee · cancel anytime
              </Typography>
            </MotionBox>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
