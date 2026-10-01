"use client";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

// Lists from the approved ASN home page ("An honest fit check").
const FIT_YES = [
  "You own or run an aesthetic practice and make the decisions",
  "You want fast, specific answers, not forum scrolling",
  "You're tired of guessing on vendors, pricing and systems",
  "You'll actually call the Hotline and use the deals",
];

const FIT_NO = [
  "You're looking for free generic content",
  "You need $20k one-on-one coaching",
  "You won't use the Hotline or the partner deals",
  "You're not a decision-maker at a practice",
];

export default function WhoItsFor() {
  const reduced = useReducedMotion();

  return (
    <Box
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
            An honest fit check
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
            This is worth it only if you&apos;ll use it.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                bgcolor: "#FBF8F1",
                border: "1px solid #D4CDB8",
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
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Check size={18} color="#15803d" strokeWidth={2.6} />
                For you if
              </Typography>
              <Stack spacing={1.25}>
                {FIT_YES.map((line) => (
                  <Stack key={line} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                    <Check size={16} color="#15803d" strokeWidth={2.6} style={{ marginTop: 3, flexShrink: 0 }} />
                    <Typography sx={{ color: "#1A1A1A", fontSize: "0.94rem", lineHeight: 1.55 }}>
                      {line}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </MotionBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                bgcolor: "#FDF3F2",
                border: "1px solid #F3D4D1",
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
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <X size={18} color="#B3261E" strokeWidth={2.6} />
                Not for you if
              </Typography>
              <Stack spacing={1.25}>
                {FIT_NO.map((line) => (
                  <Stack key={line} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                    <X size={16} color="#B3261E" strokeWidth={2.6} style={{ marginTop: 3, flexShrink: 0 }} />
                    <Typography sx={{ color: "#1A1A1A", fontSize: "0.94rem", lineHeight: 1.55 }}>
                      {line}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </MotionBox>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
