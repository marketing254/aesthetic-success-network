"use client";
import Link from "next/link";
import { type ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { motion } from "framer-motion";

const MotionBox = motion.create(Box);

export type LegalSection = {
  /** Numeric prefix shown to the left of the heading (e.g. "01"). */
  number: string;
  /** Section heading. */
  title: string;
  /** Optional intro paragraph. */
  body?: ReactNode;
  /** Optional bullet list. */
  items?: (string | ReactNode)[];
};

export type LegalKeyTerm = {
  label: string;
  value: string;
  sub?: string;
};

type Props = {
  /** "Member Agreement" badge text at the top. */
  badge: string;
  /** "Member Agreement" big title. */
  title: string;
  /** One-line italic descriptor below the title. */
  tagline?: string;
  /** Subtitle paragraph. */
  intro?: ReactNode;
  /** Optional 5-column key-terms band (vendor-agreement style). */
  keyTerms?: LegalKeyTerm[];
  /** Effective + last-updated dates rendered as small caption. */
  effectiveDate?: string;
  lastUpdated?: string;
  /** Numbered sections (the meat of the document). */
  sections: LegalSection[];
  /** Footer signoff sections (e.g. "Contact Information"). */
  footnote?: ReactNode;
};

export default function LegalShell({
  badge,
  title,
  tagline,
  intro,
  keyTerms,
  effectiveDate,
  lastUpdated,
  sections,
  footnote,
}: Props) {
  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        bgcolor: "#F7F5F0",
        minHeight: "100vh",
        pt: { xs: 4, md: 6 },
        pb: { xs: 8, md: 12 },
      }}
    >
      {/* Top warm wash */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 320,
          background:
            "radial-gradient(70% 100% at 50% 0%, rgba(217,168,75,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="md" sx={{ position: "relative" }}>
        <Stack direction="row" sx={{ mb: 3, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <Button
            component={Link}
            href="/"
            startIcon={<ArrowBackIcon />}
            sx={{ color: "text.secondary", "&:hover": { bgcolor: "rgba(14,42,61,0.04)" } }}
          >
            Back to home
          </Button>
          <Button
            startIcon={<PrintOutlinedIcon />}
            onClick={() => typeof window !== "undefined" && window.print()}
            sx={{ color: "text.secondary" }}
          >
            Print
          </Button>
        </Stack>

        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header */}
          <Stack spacing={2.5} sx={{ mb: 5 }}>
            <Chip
              icon={<ArticleOutlinedIcon sx={{ fontSize: 14, color: "#A07823 !important" }} />}
              label={badge}
              size="small"
              sx={{
                alignSelf: "flex-start",
                bgcolor: "rgba(217,168,75,0.1)",
                color: "#7A5B17",
                border: "1px solid rgba(217,168,75,0.3)",
                fontSize: "0.66rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
              }}
            />
            <Typography
              variant="h1"
              component="h1"
              sx={{ fontSize: { xs: "2.25rem", md: "3.25rem" }, lineHeight: 1.05 }}
            >
              {title}
            </Typography>
            {tagline && (
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  color: "#A07823",
                  fontSize: { xs: "1.15rem", md: "1.35rem" },
                }}
              >
                {tagline}
              </Typography>
            )}
            {intro && (
              <Typography
                variant="subtitle1"
                sx={{ color: "text.secondary", maxWidth: 640, lineHeight: 1.65 }}
              >
                {intro}
              </Typography>
            )}
            {(effectiveDate || lastUpdated) && (
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  pt: 1,
                  color: "text.disabled",
                  fontSize: "0.78rem",
                  letterSpacing: "0.04em",
                  flexWrap: "wrap",
                  rowGap: 0.5,
                }}
              >
                {effectiveDate && (
                  <Box>
                    <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#A07823" }}>
                      Effective
                    </Box>{" "}
                    {effectiveDate}
                  </Box>
                )}
                {lastUpdated && (
                  <Box>
                    <Box component="span" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#A07823" }}>
                      Last updated
                    </Box>{" "}
                    {lastUpdated}
                  </Box>
                )}
              </Stack>
            )}
          </Stack>

          {/* Optional key-terms band, same look as the vendor agreement */}
          {keyTerms && keyTerms.length > 0 && (
            <Box
              sx={{
                mb: 6,
                bgcolor: "#FFFFFF",
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "0 30px 80px -40px rgba(14,42,61,0.18)",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr 1fr",
                  sm: `repeat(${Math.min(keyTerms.length, 5)}, 1fr)`,
                },
              }}
            >
              {keyTerms.map((t) => (
                <Box key={t.label} sx={{ py: 3, px: 2, textAlign: "center", borderRight: "1px solid", borderRightColor: { sm: "divider", xs: "transparent" }, "&:last-of-type": { borderRight: "none" } }}>
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "text.disabled",
                      fontWeight: 600,
                    }}
                  >
                    {t.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.6rem",
                      color: "text.primary",
                      fontWeight: 600,
                      mt: 1,
                      lineHeight: 1.1,
                    }}
                  >
                    {t.value}
                  </Typography>
                  {t.sub && (
                    <Typography sx={{ fontSize: "0.72rem", color: "text.disabled", mt: 0.5 }}>
                      {t.sub}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Main card */}
          <Box
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 4,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 30px 80px -40px rgba(14,42,61,0.18)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: "linear-gradient(90deg, #F0C16E 0%, #D9A84B 50%, #A07823 100%)",
              }}
            />

            <Stack spacing={5}>
              {sections.map((s) => (
                <Box key={s.number} id={`s-${s.number}`} sx={{ scrollMarginTop: 100 }}>
                  <Stack direction="row" spacing={2.5} sx={{ alignItems: "flex-start", mb: 1.5 }}>
                    <Box
                      sx={{
                        flexShrink: 0,
                        minWidth: 44,
                        height: 44,
                        px: 1,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "rgba(217,168,75,0.10)",
                        color: "#A07823",
                        border: "1px solid rgba(217,168,75,0.28)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "1rem",
                        letterSpacing: 0,
                      }}
                    >
                      {s.number}
                    </Box>
                    <Typography
                      variant="h3"
                      component="h2"
                      sx={{
                        fontSize: { xs: "1.25rem", md: "1.45rem" },
                        color: "text.primary",
                        fontWeight: 600,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.25,
                        pt: 0.75,
                      }}
                    >
                      {s.title}
                    </Typography>
                  </Stack>

                  <Box sx={{ pl: { xs: 0, sm: 6.5 } }}>
                    {s.body && (
                      <Typography
                        component="div"
                        sx={{ color: "text.primary", fontSize: "0.98rem", lineHeight: 1.75, mb: s.items?.length ? 1.5 : 0 }}
                      >
                        {s.body}
                      </Typography>
                    )}
                    {s.items && s.items.length > 0 && (
                      <Stack spacing={1} component="ul" sx={{ pl: 0, listStyle: "none", m: 0 }}>
                        {s.items.map((item, i) => (
                          <Stack
                            key={i}
                            component="li"
                            direction="row"
                            spacing={1.5}
                            sx={{ alignItems: "flex-start" }}
                          >
                            <Box
                              sx={{
                                flexShrink: 0,
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: "#A07823",
                                mt: "10px",
                              }}
                            />
                            <Typography sx={{ color: "text.primary", fontSize: "0.95rem", lineHeight: 1.7 }}>
                              {item}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>

            {footnote && (
              <Box
                sx={{
                  mt: 6,
                  pt: 4,
                  borderTop: "1px solid",
                  borderTopColor: "divider",
                  color: "text.secondary",
                  fontSize: "0.92rem",
                  lineHeight: 1.7,
                  "& a": { color: "#A07823", textDecoration: "underline" },
                }}
              >
                {footnote}
              </Box>
            )}
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mt: 5, justifyContent: "space-between", alignItems: { sm: "center" } }}
          >
            <Typography variant="body2" sx={{ color: "text.disabled" }}>
              Aesthetic Success Network · Powered by Business of Aesthetics
            </Typography>
            <Button
              component={Link}
              href="/"
              variant="contained"
              color="secondary"
              size="medium"
            >
              Back to home
            </Button>
          </Stack>
        </MotionBox>
      </Container>
    </Box>
  );
}
