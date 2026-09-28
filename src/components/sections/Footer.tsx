"use client";
import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import Logo from "@/components/brand/Logo";
import { brand, footer as footerCopy, footerLinks } from "@/lib/content";

/**
 * Standard four-column SaaS footer.
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  [Logo]              Network        Agreements       Legal   │
 *   │  Brand description   - What is ASN? - Member Ag.    - Refund │
 *   │  📞 phone            - Experts      - Provider Ag.  - Privacy│
 *   │  ✉  email            - Partners                             │
 *   │                      - Pricing                              │
 *   │                      - FAQ / Tools                          │
 *   │                                                              │
 *   │  ───────────────────────────────────────────────────────────│
 *   │  © 2026 ASN · Powered by BOA            Data note            │
 *   └───────────────────────────────────────────────────────────────┘
 */
export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        position: "relative",
        bgcolor: "#0A1A2F",
        color: "#F6F1E7",
        pt: { xs: 6, md: 8 },
        pb: { xs: 3, md: 4 },
        overflow: "hidden",
        mt: { xs: 4, md: 6 },
      }}
    >
      {/* Subtle gold radial glow in the corner */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(45% 60% at 0% 0%, rgba(217,168,75,0.10) 0%, transparent 60%), radial-gradient(35% 50% at 100% 100%, rgba(217,168,75,0.06) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative" }}>
        {/* TOP — 4-column grid */}
        <Grid container spacing={{ xs: 4, md: 5 }}>
          {/* Column 1 — Brand */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2.5} sx={{ maxWidth: 320 }}>
              <Logo dark height={44} />
              <Typography
                sx={{
                  color: "rgba(246,241,231,0.65)",
                  fontSize: "0.86rem",
                  lineHeight: 1.6,
                }}
              >
                {footerCopy.brandDescription}
              </Typography>

              <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                <FooterContact
                  icon={<PhoneOutlinedIcon sx={{ fontSize: 14 }} />}
                  href={`tel:${brand.phoneTel}`}
                  label={brand.phoneDisplay}
                />
                <FooterContact
                  icon={<MailOutlineRoundedIcon sx={{ fontSize: 14 }} />}
                  href={`mailto:${brand.email}`}
                  label={brand.email}
                />
              </Stack>

              <Button
                component={Link}
                href="/join"
                variant="contained"
                color="secondary"
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                disableElevation
                sx={{
                  alignSelf: "flex-start",
                  mt: 1,
                  py: 1,
                  px: 2.25,
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  textTransform: "none",
                  boxShadow: "0 8px 22px -10px rgba(217,168,75,0.55)",
                }}
              >
                {footerCopy.primaryCta}
              </Button>
            </Stack>
          </Grid>

          {/* Column 2 — Network */}
          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <FooterColumn title="Network" links={footerLinks.Network} />
          </Grid>

          {/* Column 3 — Agreements */}
          <Grid size={{ xs: 6, sm: 4, md: 2.5 }}>
            <FooterColumn title="Agreements" links={footerLinks.Agreements} />
          </Grid>

          {/* Column 4 — Legal */}
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <FooterColumn title="Legal" links={footerLinks.Legal} />
          </Grid>
        </Grid>

        {/* BOTTOM STRIP — copyright + data note */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 1.25, md: 3 }}
          sx={{
            mt: { xs: 5, md: 7 },
            pt: { xs: 2.5, md: 3 },
            borderTop: "1px solid rgba(246,241,231,0.08)",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            color: "rgba(246,241,231,0.45)",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.74rem",
              lineHeight: 1.6,
              color: "rgba(246,241,231,0.5)",
            }}
          >
            {footerCopy.copyright}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.72rem",
              lineHeight: 1.6,
              color: "rgba(246,241,231,0.4)",
              fontStyle: "italic",
              maxWidth: 380,
            }}
          >
            {footerCopy.dataNote}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <Stack spacing={1.5}>
      <Typography
        sx={{
          fontSize: "0.66rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(246,241,231,0.55)",
        }}
      >
        {title}
      </Typography>
      <Stack spacing={1}>
        {links.map((l) => (
          <Box
            key={`${title}-${l.href}`}
            component={Link}
            href={l.href.startsWith("#") ? `/${l.href}` : l.href}
            sx={{
              color: "rgba(246,241,231,0.82)",
              textDecoration: "none",
              fontSize: "0.86rem",
              fontWeight: 500,
              transition: "color 180ms ease",
              "&:hover": { color: "#F0C16E" },
            }}
          >
            {l.label}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function FooterContact({
  icon,
  href,
  label,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        color: "rgba(246,241,231,0.78)",
        textDecoration: "none",
        fontSize: "0.84rem",
        fontWeight: 500,
        transition: "color 180ms ease",
        "&:hover": { color: "#F0C16E" },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 0.75,
          bgcolor: "rgba(246,241,231,0.06)",
          border: "1px solid rgba(246,241,231,0.1)",
          display: "grid",
          placeItems: "center",
          color: "rgba(246,241,231,0.7)",
        }}
      >
        {icon}
      </Box>
      <Box component="span" sx={{ wordBreak: "break-word" }}>
        {label}
      </Box>
    </Box>
  );
}
