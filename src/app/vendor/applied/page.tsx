"use client";

import Link from "next/link";
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
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";

const INTER = "var(--font-body), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";

/**
 * Vendor "application received" thank-you page.
 * Reached after submitting the partner WaitlistSection on /partners
 * (which posts to /api/vendor/signup). Tells the partner exactly what
 * happens next + points them at /vendor/login so they can hit the
 * portal as soon as the magic-link email arrives.
 */
export default function VendorAppliedPage() {
  const STEPS = [
    {
      icon: MailOutlineRoundedIcon,
      title: "Check your email for the sign-in link",
      body: "We sent a one-time link to the contact email on your application. It expires in 30 minutes. Click it to open your company portal.",
    },
    {
      icon: VerifiedUserOutlinedIcon,
      title: "Our team reviews your application",
      body: "We verify the category fit, your member-discount commitment, and your service responsiveness. Within 5 business days you'll get an approval (or a clarification request) by email.",
    },
    {
      icon: CalendarTodayOutlinedIcon,
      title: "Founding pricing locks in",
      body: "Six months free, then $29/month for months 7 to 12 and $99/month from month 13. Your portal lets you set up your catalog and offers right away; they go live to members the day your application is approved.",
    },
  ];

  return (
    <>
      <Header />
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
          <Stack spacing={2.5} sx={{ textAlign: "center", mb: { xs: 5, md: 6 }, alignItems: "center" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 44, color: "#166534" }} />

            <Box>
              <Typography sx={{ fontFamily: INTER, fontSize: "0.875rem", fontWeight: 500, color: MUTED, mb: 1 }}>
                Application received
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontFamily: INTER,
                  fontSize: { xs: "1.5rem", md: "1.75rem" },
                  fontWeight: 600,
                  color: INK,
                  lineHeight: 1.25,
                  letterSpacing: 0,
                  mb: 1.5,
                }}
              >
                Welcome to the company cohort.
              </Typography>
              <Typography
                sx={{
                  fontFamily: INTER,
                  color: BODY,
                  maxWidth: 540,
                  mx: "auto",
                  fontSize: "0.9375rem",
                  lineHeight: 1.65,
                }}
              >
                Your application is in. We sent a sign-in link to your email so you can start setting
                up your catalog while our team reviews your details.
              </Typography>
            </Box>
          </Stack>

          {/* Next steps */}
          <Box sx={{ mb: { xs: 5, md: 6 } }}>
            <Typography
              component="h2"
              sx={{
                fontFamily: INTER,
                color: INK,
                fontSize: "1rem",
                fontWeight: 600,
                lineHeight: 1.3,
                mb: 2,
              }}
            >
              What happens next
            </Typography>
            <Stack spacing={1.5}>
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
                      bgcolor: "#FFFFFF",
                      border: `1px solid ${LINE}`,
                      borderRadius: "8px",
                    }}
                  >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexShrink: 0, pt: 0.25 }}>
                      <Typography
                        sx={{ fontFamily: INTER, fontSize: "0.8125rem", fontWeight: 600, color: MUTED, minWidth: 14 }}
                      >
                        {i + 1}
                      </Typography>
                      <Icon sx={{ fontSize: 20, color: MUTED }} />
                    </Stack>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontFamily: INTER,
                          color: INK,
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                          mb: 0.5,
                        }}
                      >
                        {step.title}
                      </Typography>
                      <Typography sx={{ fontFamily: INTER, color: BODY, fontSize: "0.875rem", lineHeight: 1.65 }}>
                        {step.body}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          {/* CTAs */}
          <Stack
            spacing={1.5}
            sx={{ alignItems: "center", textAlign: "center" }}
          >
            <Typography
              sx={{
                fontFamily: INTER,
                color: BODY,
                fontSize: "0.875rem",
                lineHeight: 1.6,
                maxWidth: 480,
                mx: "auto",
              }}
            >
              Already got your sign-in link? Open the portal and start adding your catalog.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: "center", mt: 1 }}
            >
              <Button
                component={Link}
                href="/vendor/login"
                variant="contained"
                disableElevation
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: "6px",
                  bgcolor: NAVY,
                  color: "#fff",
                  boxShadow: "none",
                  backgroundImage: "none",
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  minHeight: 36,
                  px: 2,
                  "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "none" },
                }}
              >
                Sign in to portal
              </Button>
              <Button
                component={Link}
                href="/"
                variant="outlined"
                startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: "6px",
                  borderColor: "#D1D5DB",
                  color: INK,
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  minHeight: 36,
                  px: 2,
                  bgcolor: "#FFFFFF",
                  "&:hover": { borderColor: "#D1D5DB", bgcolor: "#F9FAFB" },
                }}
              >
                Back to landing
              </Button>
            </Stack>
            <Typography sx={{ fontFamily: INTER, color: FAINT, fontSize: "0.8125rem", mt: 2.5 }}>
              Questions? Email{" "}
              <Box
                component="a"
                href="mailto:partners@aestheticsuccessnetwork.com"
                sx={{ color: NAVY, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                partners@aestheticsuccessnetwork.com
              </Box>
            </Typography>
          </Stack>
        </Container>
      </Box>
      <Footer />
    </>
  );
}
