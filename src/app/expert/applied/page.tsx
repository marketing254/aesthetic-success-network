"use client";

import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";

/**
 * Expert "application received" thank-you page. Mirror of
 * /vendor/applied but for the expert bench.
 */

const INTER = "var(--font-body), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";

export default function ExpertAppliedPage() {
  const STEPS = [
    {
      icon: MailOutlineRoundedIcon,
      title: "Check your email for your agreement copy",
      body: "We just emailed you a copy of the ASN Provider Agreement you accepted. Save it, you'll want it on file.",
    },
    {
      icon: VerifiedUserOutlinedIcon,
      title: "Our team reviews your application",
      body: "We check topic fit against what the member base is asking for. Within 2 business days you'll get an approval (or a clarification request) by email, along with a magic-link to sign into your expert workspace.",
    },
    {
      icon: CalendarTodayOutlinedIcon,
      title: "Add your card on first login, and your free period starts",
      body: "Once approved, sign in and add your card in the billing tab. That kicks off your 6 months free (Stripe trial). Nothing is charged until month 7, then it's $39/month, and it stays $39 with no increase. Cancel anytime. Questions? Email experts@aestheticsuccessnetwork.com.",
    },
  ];

  return (
    <>
      <SitePage><SiteNav /></SitePage>
      <Box
        component="main"
        sx={{
          position: "relative",
          minHeight: "100vh",
          bgcolor: "#FFFFFF",
          color: INK,
          fontFamily: INTER,
        }}
      >
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}>
          {/* Hero */}
          <Stack spacing={2} sx={{ textAlign: "center", mb: { xs: 5, md: 6 }, alignItems: "center" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 40, color: "#166534" }} />
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: MUTED, fontFamily: INTER }}>
              Application received
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontFamily: INTER,
                fontSize: { xs: "1.5rem", md: "1.75rem" },
                fontWeight: 600,
                color: INK,
                lineHeight: 1.3,
                letterSpacing: 0,
              }}
            >
              Thanks for applying. We&apos;ll be in touch.
            </Typography>
            <Typography sx={{ color: BODY, fontSize: "0.9375rem", maxWidth: 560, lineHeight: 1.6, fontFamily: INTER }}>
              A copy of your agreement is on its way to your inbox. Here&apos;s what
              happens next.
            </Typography>
          </Stack>

          {/* Steps */}
          <Stack spacing={2} sx={{ mb: { xs: 5, md: 6 } }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Stack
                  key={step.title}
                  direction="row"
                  spacing={2}
                  sx={{
                    alignItems: "flex-start",
                    p: 3,
                    borderRadius: "8px",
                    bgcolor: "#FFFFFF",
                    border: `1px solid ${LINE}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "6px",
                      bgcolor: "#F3F4F6",
                      color: MUTED,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      fontFamily: INTER,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                      <Icon sx={{ fontSize: 18, color: MUTED }} />
                      <Typography
                        sx={{
                          fontFamily: INTER,
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: INK,
                          lineHeight: 1.4,
                        }}
                      >
                        {step.title}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6, fontFamily: INTER }}>
                      {step.body}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>

          {/* Buttons */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "center" }}
          >
            <Button
              component={Link}
              href="/expert/login"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                borderRadius: "6px",
                bgcolor: NAVY,
                color: "#fff",
                boxShadow: "none",
                backgroundImage: "none",
                fontFamily: INTER,
                textTransform: "none",
                "&:hover": { bgcolor: "#0B2232", boxShadow: "none", backgroundImage: "none" },
              }}
            >
              Sign in when approved
            </Button>
            <Button
              component={Link}
              href="/experts"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              sx={{ borderRadius: "6px", borderColor: "#D1D5DB", color: INK, fontFamily: INTER, textTransform: "none" }}
            >
              Back to experts
            </Button>
          </Stack>
        </Container>
      </Box>
      <SitePage><SiteFooter /></SitePage>
    </>
  );
}
