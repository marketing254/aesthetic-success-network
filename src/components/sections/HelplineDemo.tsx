"use client";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { brand } from "@/lib/content";

const MotionBox = motion.create(Box);

// Steps and the worked example come from the approved ASN home page
// ("The Expert Hotline"). Honesty rules (ASN-SWAP-CANON §3): the Hotline is
// a voicemail line answered in writing within 2 to 3 business days,
// AI-assisted; never "live", never "24/7". The example is illustrative and
// is labelled as such on screen.
const STEPS = [
  {
    n: 1,
    title: "Call & describe the problem",
    body: `In plain English, on our toll-free line, ${brand.phoneDisplay}. No forms, no forums, no scrolling.`,
  },
  {
    n: 2,
    title: "We route it by fit",
    body: "Our team reviews your voicemail and matches it to the best solution and the right experts.",
  },
  {
    n: 3,
    title: "You get a written plan",
    body: "Text and email within 2 to 3 business days: a recommended solution plus 3 to 4 experts to contact.",
  },
];

const EXAMPLE_TAGS = ["Inventory audit steps", "Pricing worksheet", "3 to 4 vetted experts"];

export default function HelplineDemo() {
  const reduced = useReducedMotion();

  return (
    <Box
      id="helpline"
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#FFFFFF",
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
            The Expert Hotline
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
            Stuck? Put the network on it.
          </Typography>
          <Typography sx={{ color: "#52525B", fontSize: { xs: "0.98rem", md: "1.05rem" }, lineHeight: 1.55 }}>
            A pricing decision. An injector who just resigned. A marketing channel that stopped working. Every practice hits walls. The Hotline gets you a considered, written answer and the right experts to call.
          </Typography>
        </Stack>

        <Grid container spacing={{ xs: 3, md: 5 }} sx={{ alignItems: "center" }}>
          {/* Steps */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2}>
              {STEPS.map((s, i) => (
                <MotionBox
                  key={s.n}
                  initial={reduced ? false : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: "#FBF8F1",
                      color: "#7A5F2A",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                    }}
                  >
                    {s.n}
                  </Box>
                  <Box>
                    <Typography sx={{ color: "#1A1A1A", fontWeight: 700, fontSize: "1.05rem", mb: 0.5 }}>
                      {s.title}
                    </Typography>
                    <Typography sx={{ color: "#52525B", fontSize: "0.92rem", lineHeight: 1.55 }}>
                      {s.body}
                    </Typography>
                  </Box>
                </MotionBox>
              ))}

              <Typography sx={{ color: "#71717A", fontSize: "0.84rem", lineHeight: 1.55, pt: 0.5 }}>
                How it actually works: the Hotline is a voicemail line, not a live 24/7 helpline. You leave your question; our team (AI-assisted) replies in writing within 2 to 3 business days, routed by fit, never pay-to-play.
              </Typography>
            </Stack>
          </Grid>

          {/* Chat mock (illustrative) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                bgcolor: "#F8F5EE",
                border: "1px solid #E4E4E7",
                borderRadius: 2,
                p: 2.25,
              }}
            >
              <Typography
                sx={{
                  color: "#7A5F2A",
                  fontSize: "0.64rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  mb: 1.25,
                }}
              >
                Example · illustrative
              </Typography>

              {/* User bubble */}
              <Box
                sx={{
                  ml: "auto",
                  maxWidth: "88%",
                  bgcolor: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  borderRadius: "13px 13px 3px 13px",
                  px: 1.75,
                  py: 1.4,
                  mb: 1.25,
                }}
              >
                <Typography
                  sx={{
                    color: "#52525B",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    mb: 0.4,
                  }}
                >
                  You
                </Typography>
                <Typography sx={{ color: "#1A1A1A", fontSize: "0.93rem", lineHeight: 1.5 }}>
                  My filler margins are shrinking and I don&apos;t know where.
                </Typography>
              </Box>

              {/* Hotline bubble */}
              <Box
                sx={{
                  maxWidth: "88%",
                  bgcolor: "#1A1A1A",
                  color: "#eaf6f4",
                  borderRadius: "13px 13px 13px 3px",
                  px: 1.75,
                  py: 1.4,
                }}
              >
                <Typography
                  sx={{
                    color: "#C9A876",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    mb: 0.4,
                  }}
                >
                  {brand.shortName} Hotline · reply by text and email
                </Typography>
                <Typography sx={{ color: "#eaf6f4", fontSize: "0.93rem", lineHeight: 1.5 }}>
                  A reply like this arrives within 2 to 3 business days: a written action plan with inventory audit steps and a pricing worksheet, 3 to 4 vetted experts in aesthetics finance and operations to contact, and the kits from the library that match your problem.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 1 }}>
                  {EXAMPLE_TAGS.map((tag) => (
                    <Box
                      key={tag}
                      sx={{
                        px: 1.1,
                        py: 0.4,
                        borderRadius: 1,
                        bgcolor: "rgba(20,168,154,0.18)",
                        color: "#F8F5EE",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </MotionBox>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
