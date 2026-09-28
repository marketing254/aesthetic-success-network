"use client";
import Link from "next/link";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import { Star } from "lucide-react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

type Review = { quote: string; name: string; source: string };

// Real reviews only. ASN is pre-launch and has no verified member reviews
// yet, so this list is empty and the section renders nothing. Do NOT reuse
// reviews of other brands (Ekwa, Business of Aesthetics, podcasts) here and
// do NOT invent member quotes (ASN-SWAP-CANON §1). Add a review only once a
// member has given it and it has been verified; the full set lives on
// /reviews.
const REVIEWS: Review[] = [];

export default function SocialProof() {
  const reduced = useReducedMotion();

  if (REVIEWS.length === 0) return null;

  return (
    <Box
      id="proof"
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#F8F5EE",
        borderTop: "1px solid #E4E4E7",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={1.25} sx={{ textAlign: "center", maxWidth: 760, mx: "auto", mb: { xs: 4, md: 5 } }}>
          <Typography
            sx={{
              color: "#7A5F2A",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Member reviews
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
            What members say about the Aesthetic Success Network
          </Typography>
          <Typography sx={{ color: "#52525B", fontSize: { xs: "0.95rem", md: "1.02rem" } }}>
            Verified reviews from active members, in their own words.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          {REVIEWS.map((t, i) => (
            <Grid key={t.name + i} size={{ xs: 12, md: 4 }}>
              <MotionBox
                initial={reduced ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                sx={{
                  bgcolor: "#FFFFFF",
                  border: "1px solid #E4E4E7",
                  borderRadius: 2,
                  p: 2.5,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 200ms ease, transform 200ms ease",
                  "&:hover": {
                    borderColor: "#9B7B3A",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Stack direction="row" spacing={0.4} sx={{ mb: 1.25, color: "#1A1A1A" }}>
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} size={14} fill="#1A1A1A" strokeWidth={0} />
                  ))}
                </Stack>
                <Typography
                  sx={{
                    color: "#1A1A1A",
                    fontSize: "0.94rem",
                    lineHeight: 1.55,
                    mb: 2,
                    flex: 1,
                  }}
                >
                  &ldquo;{t.quote}&rdquo;
                </Typography>
                <Box sx={{ borderTop: "1px solid #E4E4E7", pt: 1.5 }}>
                  <Typography sx={{ color: "#1A1A1A", fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.2 }}>
                    {t.name}
                  </Typography>
                  <Typography sx={{ color: "#52525B", fontSize: "0.78rem", mt: 0.4 }}>
                    {t.source}
                  </Typography>
                </Box>
              </MotionBox>
            </Grid>
          ))}
        </Grid>

        <Stack direction="row" sx={{ justifyContent: "center", mt: { xs: 4, md: 5 } }}>
          <Button
            variant="outlined"
            color="primary"
            component={Link}
            href="/reviews"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            See all reviews
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
