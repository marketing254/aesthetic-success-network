"use client";

import Link from "next/link";
import Image from "next/image";
import { isSupabaseImage } from "@/lib/images";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import LockedTeaserList, { type LockedTeaserRow } from "@/components/directory/LockedTeaserList";
import { COLORS } from "@/theme";

// Public-safe profile only. Booking/scheduler links are deliberately NOT
// part of the public page — booking an expert is a member benefit, so the
// calendar lives inside the member portal only.
export type PublicExpertProfile = {
  name: string;
  specialty: string | null;
  company_name: string | null;
  bio: string | null;
  headshot_url: string | null;
  website: string | null;
};

/**
 * Client view for the public expert profile page. The server page fetches
 * + gates the data and passes plain props here (MUI + next/link can't be
 * composed from a server component — `component={Link}` is a function).
 */
export default function PublicExpertProfileView({
  expert,
  topics,
  kits,
  spotlights = [],
}: {
  expert: PublicExpertProfile;
  topics: string[];
  kits: string[];
  spotlights?: LockedTeaserRow[];
}) {
  const name = expert.name;
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.surface, display: "flex", flexDirection: "column" }}>
      <Header />
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Box
          component={Link}
          href="/experts"
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
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All experts
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2.5, sm: 4 }} sx={{ alignItems: { sm: "center" }, mb: 4 }}>
          <Box
            sx={{
              position: "relative",
              width: { xs: 110, sm: 140 },
              height: { xs: 110, sm: 140 },
              borderRadius: "50%",
              overflow: "hidden",
              bgcolor: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.line}`,
              flexShrink: 0,
            }}
          >
            {expert.headshot_url ? (
              <Image src={expert.headshot_url} alt={name} fill sizes="140px" unoptimized={!isSupabaseImage(expert.headshot_url)} style={{ objectFit: "cover", objectPosition: "center top" }} />
            ) : (
              <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: COLORS.accent, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2.2rem" }}>
                {name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </Box>
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.accent, mb: 0.75 }}>
              Founding Expert{expert.specialty ? ` · ${expert.specialty}` : ""}
            </Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "2rem", md: "2.6rem" }, fontWeight: 500, color: COLORS.ink, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
              {name}
            </Typography>
            {expert.company_name && (
              <Typography sx={{ color: COLORS.muted, fontSize: "1rem", mt: 0.75 }}>{expert.company_name}</Typography>
            )}
          </Box>
        </Stack>

        {/* No booking CTA here on purpose — booking an expert is a member
            benefit; the scheduler only appears inside the member portal. */}
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5, mb: 4 }}>
          {expert.website && (
            <Button
              component="a"
              href={expert.website}
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

        {expert.bio && (
          <Box sx={{ mb: 4 }}>
            <SectionLabel>About</SectionLabel>
            <Typography sx={{ color: COLORS.inkSoft, fontSize: "1.02rem", lineHeight: 1.75, whiteSpace: "pre-line", maxWidth: 680 }}>
              {expert.bio}
            </Typography>
          </Box>
        )}

        {topics.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <SectionLabel>Teaches on</SectionLabel>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {topics.map((t) => (
                <Chip key={t} label={t} sx={{ bgcolor: COLORS.surfaceAlt, border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft, fontWeight: 600, fontSize: "0.8rem" }} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Members-only spotlight teaser — blurred decoys + lock, real
            content never leaves the portal. */}
        <LockedTeaserList
          label="Spotlight: news and events"
          rows={spotlights}
          footnote={`${name.split(/\s+/)[0]} shares events, news, and member perks in the portal.`}
        />

        {kits.length > 0 && (
          <Box sx={{ borderRadius: 2.5, border: `1px solid ${COLORS.line}`, bgcolor: "#FFFFFF", p: { xs: 2.5, md: 3 } }}>
            <SectionLabel>Inside the member portal</SectionLabel>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {kits.map((title) => (
                <Stack key={title} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <LockRoundedIcon sx={{ fontSize: 15, color: COLORS.accent }} />
                  <Typography sx={{ color: COLORS.ink, fontWeight: 600, fontSize: "0.95rem" }}>{title}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ color: COLORS.muted, fontSize: "0.88rem", mb: 2 }}>
              {name.split(/\s+/)[0]}&apos;s full kit{kits.length === 1 ? " is" : "s are"} available to Aesthetic Success Network members.
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.muted, mb: 1.5 }}>
      {children}
    </Typography>
  );
}
