"use client";
import { useState } from "react";
import {
  Box,
  Container,
  Grid,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

// Model ported from the approved ASN home page ("Do the math"):
//   savings = monthly vendor spend x 12 x discount%  +  questions x $150
//   net     = savings - $588 (founding membership, $49 x 12)
//   mult    = savings / $588, shown to one decimal
// Defaults ($5,000 / 8% / 4 questions) must render $4,812 and 9.2x. Every
// assumption is disclosed in visible text below the result, and a negative
// result is shown as a negative number, never clamped.
const HOTLINE_VALUE = 150; // estimated consulting value per Hotline question (our assumption)
const MEMBERSHIP_COST = 588; // $49 x 12

function money(n: number) {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-US");
  return `${n < 0 ? "-" : ""}$${abs}`;
}

const sliderSx = {
  color: "#9B7B3A",
  "& .MuiSlider-thumb": {
    bgcolor: "#FFFFFF",
    border: "2px solid #9B7B3A",
    width: 18,
    height: 18,
  },
  "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.15)" },
} as const;

export default function ROICalculator() {
  const reduced = useReducedMotion();
  const [spend, setSpend] = useState(5000);
  const [discount, setDiscount] = useState(8);
  const [questions, setQuestions] = useState(4);

  const savings = spend * 12 * (discount / 100) + questions * HOTLINE_VALUE;
  const net = savings - MEMBERSHIP_COST;
  const mult = Math.round((savings / MEMBERSHIP_COST) * 10) / 10;

  return (
    <Box
      id="calc"
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#1A1A1A",
        color: "#FFFFFF",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.5}>
              <Typography
                sx={{
                  color: "#C9A876",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Do the math
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: "#FFFFFF",
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.65rem", md: "2.1rem" },
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Run it on your numbers.
              </Typography>
              <Typography sx={{ color: "#D4CDB8", fontSize: { xs: "0.95rem", md: "1.02rem" } }}>
                Set your own assumptions. If the deals alone don&apos;t clear the membership cost, don&apos;t join. That&apos;s the honest test.
              </Typography>
              <Typography sx={{ color: "#A8A29E", fontSize: "0.82rem", lineHeight: 1.6, pt: 0.5 }}>
                How this is calculated: your monthly vendor spend × 12 × your chosen discount, plus ${HOTLINE_VALUE} of estimated consulting value per Hotline question (our assumption, not a promise), minus the ${MEMBERSHIP_COST} annual founding fee ($49 × 12). Estimates only. Actual savings depend on the deals partners commit to and how much you use the network. Results can be negative, and no results are guaranteed.
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                bgcolor: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 3,
                p: { xs: 2.5, md: 3 },
              }}
            >
              <Stack spacing={2.5}>
                <Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ color: "#D4CDB8", fontSize: "0.84rem" }}>
                      Monthly spend with vendors a partner could replace
                    </Typography>
                    <Typography sx={{ color: "#C9A876", fontWeight: 700, fontSize: "0.9rem" }}>
                      {money(spend)}
                    </Typography>
                  </Stack>
                  <Slider
                    value={spend}
                    onChange={(_, v) => setSpend(v as number)}
                    min={0}
                    max={30000}
                    step={250}
                    aria-label="Monthly spend with vendors a partner could replace"
                    sx={sliderSx}
                  />
                </Box>
                <Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ color: "#D4CDB8", fontSize: "0.84rem" }}>
                      Member discount you&apos;d realistically use
                    </Typography>
                    <Typography sx={{ color: "#C9A876", fontWeight: 700, fontSize: "0.9rem" }}>
                      {discount}%
                    </Typography>
                  </Stack>
                  <Slider
                    value={discount}
                    onChange={(_, v) => setDiscount(v as number)}
                    min={0}
                    max={30}
                    step={1}
                    aria-label="Member discount you would realistically use"
                    sx={sliderSx}
                  />
                </Box>
                <Box>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ color: "#D4CDB8", fontSize: "0.84rem" }}>
                      Hotline questions you&apos;d actually ask per year
                    </Typography>
                    <Typography sx={{ color: "#C9A876", fontWeight: 700, fontSize: "0.9rem" }}>
                      {questions}
                    </Typography>
                  </Stack>
                  <Slider
                    value={questions}
                    onChange={(_, v) => setQuestions(v as number)}
                    min={0}
                    max={24}
                    step={1}
                    aria-label="Hotline questions you would actually ask per year"
                    sx={sliderSx}
                  />
                </Box>

                <Box
                  sx={{
                    bgcolor: "#0A0A0A",
                    borderRadius: 2,
                    p: 2.25,
                    textAlign: "center",
                  }}
                >
                  <Typography sx={{ color: "#A8A29E", fontSize: "0.78rem", mb: 0.5 }}>
                    Your estimated first-year net benefit
                  </Typography>
                  <Typography
                    aria-live="polite"
                    sx={{
                      color: net < 0 ? "#E5A29A" : "#C9A876",
                      fontFamily: "var(--font-display)",
                      fontSize: { xs: "2rem", md: "2.4rem" },
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {money(net)}
                  </Typography>
                  <Typography sx={{ color: "#A8A29E", fontSize: "0.78rem", mt: 0.75 }}>
                    vs ${MEMBERSHIP_COST}/yr founding membership ($49 × 12): {mult.toLocaleString("en-US")}× your cost
                  </Typography>
                  <Typography sx={{ color: "#71717A", fontSize: "0.72rem", mt: 0.75 }}>
                    Estimate only. Assumes {money(spend)} × 12 × {discount}% in partner savings plus {questions} × ${HOTLINE_VALUE} of Hotline value, minus ${MEMBERSHIP_COST}.
                  </Typography>
                </Box>
              </Stack>
            </MotionBox>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
