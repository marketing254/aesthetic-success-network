"use client";

import { Suspense } from "react";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { Box, Container, Stack, Typography } from "@mui/material";
import WaitlistSection from "@/components/sections/WaitlistSection";
import { COLORS } from "@/theme";

/**
 * /join — public member signup form.
 *
 * What it does:
 *   1. Visitor fills the form (name, email, practice, role, etc.).
 *   2. Form posts to /api/waitlist → writes a `waitlist_signups` row
 *      (NOT a `members` row — they don't get portal access yet).
 *   3. Visitor lands on /waitlist/thanks for the confirmation copy.
 *   4. Admin sees them in /admin/waitlist, reviews, and clicks Activate.
 *   5. Activate creates the `members` row + auth user + welcome email.
 *   6. Visitor receives the welcome email → /member/login → /upgrade →
 *      Stripe checkout → /dashboard.
 *
 * This page is the entry-point for everyone clicking "Join" / "Become a
 * member" / "Claim your founding seat" across the site. The form is
 * reused from WaitlistSection with lockedRole="member" so we don't
 * maintain two copies of the same fields + validation.
 *
 * Query params (optional, preserved by upstream CTAs):
 *   ?intent=founding|early|standard  — which plan they expressed interest in
 *   ?interval=monthly|annual         — billing cadence they picked on /pricing
 *
 * These are informational only at the signup stage — the actual price
 * choice is made at checkout, after admin activation. They're surfaced
 * here so the team can prioritise applicants by tier intent if needed.
 */
export default function JoinPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.surface }}>
      <SitePage><SiteNav /></SitePage>

      {/* HERO — dark navy band, mirrors the /experts + /partners hero
          treatment so visitors recognise this as a signup page, not a
          marketing teaser. */}
      <Box sx={{ bgcolor: COLORS.primary, color: "#FFFFFF", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md">
          <Stack spacing={2.25} sx={{ alignItems: "center", textAlign: "center", maxWidth: 720, mx: "auto" }}>
            <Typography
              sx={{
                fontSize: "0.72rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: COLORS.accentBright,
              }}
            >
              Join Aesthetic Success Network
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: { xs: "2rem", md: "2.7rem" },
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
              }}
            >
              Tell us about your practice and we&apos;ll set up your access.
            </Typography>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.82)",
                fontSize: "1.02rem",
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              Fill in a few details, pick your plan and pay securely. Your
              portal unlocks the moment Stripe confirms the payment, and your
              welcome email follows with your sign-in link.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* SIGNUP FORM — reuses the same form fields & validation as the
          legacy waitlist, locked to the member role. Suspense wrap is
          required because the form reads useSearchParams() internally. */}
      <Suspense fallback={null}>
        <WaitlistSection lockedRole="member" sectionId="join" />
      </Suspense>

      <SitePage><SiteFooter /></SitePage>
    </Box>
  );
}
