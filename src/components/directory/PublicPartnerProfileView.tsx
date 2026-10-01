"use client";

import Link from "next/link";
import Image from "next/image";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import LockedTeaserList, { type LockedTeaserRow } from "@/components/directory/LockedTeaserList";
import { COLORS } from "@/theme";

// Public-safe profile only. Booking/contact schedulers are deliberately NOT
// part of the public page — direct booking is a member benefit, so the
// calendar lives inside the member portal only. Offers + spotlights render
// as blurred locked teasers (ids/kinds only — content never ships).
export type PublicPartnerProfile = {
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
};

/**
 * Client view for the public partner profile page. The server page fetches
 * + gates the data and passes plain props here (MUI + next/link can't be
 * composed from a server component — `component={Link}` is a function).
 */
export default function PublicPartnerProfileView({
  partner,
  offerTeasers = [],
  spotlights = [],
  offerCtaHref = null,
}: {
  partner: PublicPartnerProfile;
  offerTeasers?: LockedTeaserRow[];
  spotlights?: LockedTeaserRow[];
  /** House partners only — public scheduler the offers click through to. */
  offerCtaHref?: string | null;
}) {
  const name = partner.name;
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.surface, display: "flex", flexDirection: "column" }}>
      <Header />
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Box
          component={Link}
          href="/companies"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            textDecoration: "none",
            color: COLORS.muted,
            fontSize: "0.85rem",
            fontWeight: 600,
            mb: 3.5,
            "&:hover": { color: COLORS.accent },
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All partners
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2.5, sm: 4 }} sx={{ alignItems: { sm: "center" }, mb: 4 }}>
          <Box
            sx={{
              position: "relative",
              width: { xs: 100, sm: 130 },
              height: { xs: 100, sm: 130 },
              borderRadius: 2.5,
              overflow: "hidden",
              bgcolor: "#FFFFFF",
              border: `1px solid ${COLORS.line}`,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            {partner.logo_url ? (
              <Image src={partner.logo_url} alt={name} fill sizes="130px" unoptimized style={{ objectFit: "contain", padding: 12 }} />
            ) : (
              <StorefrontOutlinedIcon sx={{ color: COLORS.accent, fontSize: 48 }} />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.accent, mb: 0.75 }}>
              Founding Partner{partner.category ? ` · ${partner.category}` : ""}
            </Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "2rem", md: "2.6rem" }, fontWeight: 500, color: COLORS.ink, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
              {name}
            </Typography>
          </Box>
        </Stack>

        {/* No booking/contact CTA here on purpose — direct booking is a
            member benefit; the scheduler only appears inside the portal. */}
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5, mb: 4 }}>
          {partner.website && (
            <Button
              component="a"
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<LanguageRoundedIcon sx={{ fontSize: 17 }} />}
              sx={{ textTransform: "none", borderRadius: 999, borderColor: COLORS.line, color: COLORS.ink }}
            >
              Visit website
            </Button>
          )}
        </Stack>

        {partner.description && (
          <Box sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.muted, mb: 1.5 }}>
              About
            </Typography>
            <Typography sx={{ color: COLORS.inkSoft, fontSize: "1.02rem", lineHeight: 1.75, whiteSpace: "pre-line", maxWidth: 680 }}>
              {partner.description}
            </Typography>
          </Box>
        )}

        {/* Members-only spotlight teaser — blurred decoys + lock. */}
        <LockedTeaserList
          label="Spotlight: news and events"
          rows={spotlights}
          footnote={`${name} shares events, news, and member perks in the portal.`}
        />

        {offerTeasers.length > 0 && offerCtaHref ? (
          // House partner: offers are claimable publicly — the CTA clicks
          // through to their scheduler instead of the membership page.
          <LockedTeaserList
            label="Member-exclusive offers"
            rows={offerTeasers}
            footnote="Book a strategy meeting to claim these offers."
            ctaLabel="Book a strategy meeting"
            ctaHref={offerCtaHref}
          />
        ) : offerTeasers.length > 0 ? (
          <LockedTeaserList
            label="Member-exclusive offers"
            rows={offerTeasers}
            footnote="Offer details and promo codes unlock inside the member portal."
          />
        ) : (
          <Box sx={{ borderRadius: 2.5, border: `1px solid ${COLORS.line}`, bgcolor: "#FFFFFF", p: { xs: 2.5, md: 3 } }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.muted, mb: 1.5 }}>
              Member-exclusive offer
            </Typography>
            <Typography sx={{ color: COLORS.muted, fontSize: "0.92rem", mb: 2 }}>
              {name} gives Aesthetic Success Network members an exclusive offer. See it inside the portal.
            </Typography>
            <Button component={Link} href="/pricing" variant="contained" sx={{ textTransform: "none", borderRadius: 999, bgcolor: COLORS.accent, color: "#FFFFFF", "&:hover": { bgcolor: COLORS.accent } }}>
              Become a member
            </Button>
          </Box>
        )}
      </Container>
      <Footer />
    </Box>
  );
}
