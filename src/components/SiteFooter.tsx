"use client";
import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { brand, footer as footerCopy, footerLinks } from "@/content";
import { C } from "@/theme";

const cream = (a: number) => `rgba(244,236,240,${a})`;
const FOOTER_LEGAL = [...footerLinks.Agreements, ...footerLinks.Legal];

function FooterLogo() {
  return (
    <Box component={Link} href="/" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, textDecoration: "none" }}>
      <Box
        sx={{
          width: 40, height: 40, borderRadius: "11px", flexShrink: 0,
          display: "grid", placeItems: "center",
          bgcolor: C.accent, color: "#fff",
          fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.03em",
        }}
      >
        ASN
      </Box>
      <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: "1.15rem", color: "#F4ECF0" }}>
        Aesthetics Success Network
      </Typography>
    </Box>
  );
}

export default function SiteFooter() {
  return (
    <Box
      component="footer"
      sx={{ position: "relative", bgcolor: C.inkDark, color: "#F4ECF0", pt: { xs: 6, md: 8 }, pb: { xs: 4, md: 4 }, overflow: "hidden" }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(45% 60% at 0% 0%, rgba(194,78,114,0.13) 0%, transparent 62%)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative" }}>
        {/* Top: brand + tagline on the left, one CTA on the right */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 4, md: 6 }}
          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "flex-end" } }}
        >
          <Stack spacing={2.25} sx={{ maxWidth: 420 }}>
            <FooterLogo />
            <Typography sx={{ color: cream(0.62), fontSize: "0.95rem", lineHeight: 1.6 }}>
              A human expert on the line for every practice problem — for US aesthetic practice owners.
            </Typography>
            <Box
              component="a"
              href={`mailto:${brand.email}`}
              sx={{ color: cream(0.8), textDecoration: "none", fontWeight: 600, fontSize: "0.9rem", width: "fit-content", "&:hover": { color: C.accentBright } }}
            >
              {brand.email}
            </Box>
          </Stack>

          <Stack spacing={1.5} sx={{ alignItems: { xs: "flex-start", md: "flex-end" } }}>
            <Typography variant="overline" sx={{ color: C.accentBright, letterSpacing: "0.16em", fontWeight: 700, fontSize: "0.68rem" }}>
              Founding access
            </Typography>
            <Button
              component={Link}
              href="/#waitlist"
              variant="contained"
              color="secondary"
              size="large"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{ px: 3 }}
            >
              {footerCopy.primaryCta}
            </Button>
            <Typography sx={{ color: cream(0.45), fontSize: "0.78rem" }}>{footerCopy.responseValue}</Typography>
          </Stack>
        </Stack>

        {/* Divider + minimal bottom bar */}
        <Stack
          direction={{ xs: "column-reverse", sm: "row" }}
          spacing={{ xs: 2, sm: 3 }}
          sx={{
            mt: { xs: 5, md: 7 },
            pt: 3,
            borderTop: `1px solid ${cream(0.1)}`,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
          }}
        >
          <Typography sx={{ color: cream(0.45), fontSize: "0.76rem", lineHeight: 1.5 }}>{footerCopy.copyright}</Typography>

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: { xs: 1.5, md: 2.5 }, rowGap: 1 }}>
            {FOOTER_LEGAL.map((l) => (
              <Box
                key={l.href}
                component={Link}
                href={l.href}
                sx={{ color: cream(0.62), textDecoration: "none", fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap", "&:hover": { color: C.accentBright } }}
              >
                {l.label}
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
