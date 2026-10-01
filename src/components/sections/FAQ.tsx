"use client";
import { useState } from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { faqs, faqSection } from "@/lib/content";

const MotionBox = motion.create(Box);

export default function FAQ() {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <Box
      id="faq"
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#FFFFFF",
        borderTop: "1px solid #E4E4E7",
      }}
    >
      <Container maxWidth="md">
        <MotionBox
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          sx={{ textAlign: "center", mb: { xs: 4, md: 5 } }}
        >
          <Typography
            sx={{
              color: "#7A5F2A",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              mb: 1.25,
            }}
          >
            {faqSection.eyebrow}
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
            Everything else
          </Typography>
        </MotionBox>

        <Stack sx={{ borderTop: "1px solid #E4E4E7" }}>
          {faqs.map((f, i) => {
            const isOpen = expanded === i;
            return (
              <Box
                key={f.q}
                sx={{
                  borderBottom: "1px solid #E4E4E7",
                }}
              >
                <Box
                  component="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    py: 2.5,
                    px: 0,
                    bgcolor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    color: "#1A1A1A",
                    transition: "color 180ms ease",
                    "&:hover": { color: "#7A5F2A" },
                  }}
                >
                  <Typography
                    sx={{
                      color: "inherit",
                      fontSize: { xs: "0.98rem", md: "1.04rem" },
                      fontWeight: 600,
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    {f.q}
                  </Typography>
                  <Box
                    sx={{
                      flexShrink: 0,
                      color: "#7A5F2A",
                      fontWeight: 800,
                      fontSize: "1.2rem",
                      lineHeight: 1,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      transition: "transform 240ms ease",
                    }}
                  >
                    +
                  </Box>
                </Box>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <Box sx={{ pb: 2.5, pr: { md: 4 }, maxWidth: 720 }}>
                        <Typography
                          sx={{
                            color: "#52525B",
                            fontSize: { xs: "0.92rem", md: "0.96rem" },
                            lineHeight: 1.65,
                          }}
                        >
                          {f.a}
                        </Typography>
                        {"items" in f && Array.isArray(f.items) && f.items.length > 0 && (
                          <Stack
                            component="ul"
                            spacing={0.85}
                            sx={{
                              listStyle: "none",
                              pl: 0,
                              mt: 1.25,
                              mb: 0,
                            }}
                          >
                            {f.items.map((item: string, idx: number) => (
                              <Box
                                key={idx}
                                component="li"
                                sx={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 1.25,
                                  color: "#52525B",
                                  fontSize: { xs: "0.92rem", md: "0.96rem" },
                                  lineHeight: 1.6,
                                }}
                              >
                                <Box
                                  aria-hidden
                                  sx={{
                                    flexShrink: 0,
                                    mt: "0.55em",
                                    width: 4,
                                    height: 4,
                                    borderRadius: "50%",
                                    bgcolor: "#9B7B3A",
                                  }}
                                />
                                <Typography
                                  component="span"
                                  sx={{
                                    color: "#52525B",
                                    fontSize: { xs: "0.92rem", md: "0.96rem" },
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {item}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                        {"aClose" in f && typeof f.aClose === "string" && f.aClose && (
                          <Typography
                            sx={{
                              color: "#52525B",
                              fontSize: { xs: "0.92rem", md: "0.96rem" },
                              lineHeight: 1.65,
                              mt: 1.25,
                            }}
                          >
                            {f.aClose}
                          </Typography>
                        )}
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
