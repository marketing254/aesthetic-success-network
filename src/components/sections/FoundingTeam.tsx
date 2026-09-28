"use client";
import Image from "next/image";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { foundingTeam, foundingTeamSection } from "@/lib/content";

const MotionBox = motion.create(Box);

// ASN-SWAP-CANON §1: the founding team is Naren Arulrajah and Lester De
// Alwis only, with no bios beyond their titles. The roster and titles live
// in src/lib/content.ts (`foundingTeam`) so there is one source of truth.

export default function FoundingTeam() {
  const reduced = useReducedMotion();

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        py: { xs: 7, md: 10 },
        bgcolor: "#FFFFFF",
        borderTop: "1px solid #E7E2D6",
        overflow: "hidden",
      }}
    >
      {/* Soft warm halo top-right */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(201,168,118,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative" }}>
        {/* Section heading */}
        <MotionBox
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          sx={{ textAlign: "center", maxWidth: 720, mx: "auto", mb: { xs: 5, md: 6 } }}
        >
          {/* Eyebrow pill */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.85,
              px: 1.4,
              py: 0.55,
              borderRadius: 999,
              bgcolor: "#FBF8F1",
              border: "1px solid rgba(155,123,58,0.25)",
              mb: 2,
            }}
          >
            <Sparkles size={12} color="#9B7B3A" strokeWidth={2.4} />
            <Typography
              sx={{
                color: "#7A5F2A",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Founding team
            </Typography>
          </Box>

          <Typography
            variant="h2"
            sx={{
              color: "#1A1A1A",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.7rem", md: "2.1rem" },
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              mb: 1.5,
            }}
          >
            Powered by{" "}
            <Box
              component="span"
              sx={{
                fontStyle: "italic",
                backgroundImage:
                  "linear-gradient(120deg, #9B7B3A 0%, #D4B07A 50%, #9B7B3A 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Business of Aesthetics
            </Box>
            .
          </Typography>
          <Typography
            sx={{
              color: "#52525B",
              fontSize: { xs: "0.95rem", md: "1.02rem" },
              maxWidth: 580,
              mx: "auto",
              lineHeight: 1.55,
            }}
          >
            {foundingTeamSection.subtitle}
          </Typography>
        </MotionBox>

        {/* Founder cards */}
        <Grid container spacing={2.5} sx={{ justifyContent: "center" }}>
          {foundingTeam.map((f, i) => (
            <Grid key={f.name} size={{ xs: 12, md: 6 }}>
              <MotionBox
                initial={reduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                sx={{
                  position: "relative",
                  height: "100%",
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  bgcolor: "#FBF8F1",
                  border: "1px solid #E7E2D6",
                  transition:
                    "transform 280ms ease, border-color 280ms ease, box-shadow 280ms ease",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "#C9A876",
                    boxShadow:
                      "0 1px 2px rgba(20,20,20,0.04), 0 24px 50px -30px rgba(155,123,58,0.32)",
                  },
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" }, height: "100%" }}>
                  {/* Photo with gold ring */}
                  <Box
                    sx={{
                      position: "relative",
                      width: { xs: 100, sm: 120 },
                      height: { xs: 100, sm: 120 },
                      borderRadius: "50%",
                      flexShrink: 0,
                      overflow: "hidden",
                      background:
                        "linear-gradient(135deg, #C9A876 0%, #9B7B3A 100%)",
                      padding: "3px",
                      boxShadow:
                        "0 1px 2px rgba(20,20,20,0.06), 0 12px 28px -10px rgba(155,123,58,0.35)",
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        overflow: "hidden",
                        bgcolor: "#FBF8F1",
                      }}
                    >
                      <Image
                        src={f.photo}
                        alt={f.name}
                        fill
                        sizes="(max-width: 600px) 100px, 120px"
                        style={{
                          objectFit: "cover",
                          objectPosition: "center top",
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Text: name and title only */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: "#1A1A1A",
                        fontFamily: "var(--font-display)",
                        fontSize: "1.4rem",
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                        mb: 0.4,
                      }}
                    >
                      {f.name}
                    </Typography>
                    <Typography
                      sx={{
                        color: "#9B7B3A",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {f.role}
                    </Typography>
                  </Box>
                </Stack>
              </MotionBox>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
