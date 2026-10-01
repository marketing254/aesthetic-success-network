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

const INTER = "var(--font-body), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const INK = "#0A1320";
const BODY = "#3B4451";
const FAINT = "#9AA3AF";
const LINE = "rgba(10,19,32,0.06)";
const LINE_STRONG = "rgba(10,19,32,0.14)";
const NAVY = "#0A1320";
const NAVY_HOVER = "#141F30";
const CANVAS = "#FAF8F4";
const SAND = "#F3EBDD";
const GOLD_DEEP = "#B8862F";
const SHADOW = "0 1px 2px rgba(10,19,32,0.04), 0 8px 24px -16px rgba(10,19,32,0.12)";

/**
 * Company "application received" thank-you page.
 * Reached after submitting the company WaitlistSection on /companies
 * (which posts to /api/vendor/signup). Tells the company exactly what
 * happens next and points them at /vendor/login so they can open the
 * portal as soon as the sign-in email arrives.
 */
export default function VendorAppliedPage() {
  const STEPS = [
    {
      icon: MailOutlineRoundedIcon,
      title: "Check your email for your sign-in code",
      body: "We sent a one-time sign-in to the contact email on your application. Use it to open your company portal. You can request a fresh 6-digit code from the sign-in page at any time.",
    },
    {
      icon: VerifiedUserOutlinedIcon,
      title: "Our team reviews your application",
      body: "We verify the category fit, your member-discount commitment, and your service responsiveness. Within 5 business days you'll get an approval (or a clarification request) by email.",
    },
    {
      icon: CalendarTodayOutlinedIcon,
      title: "Launch pricing locks in",
      body: "Your first 6 months are free, starting the day we open to members. After that it's $39 a month, and it stays $39 with no increase. Your portal lets you set up your catalog and offers right away; they go live to members the day your application is approved.",
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
          bgcolor: CANVAS,
          color: INK,
          fontFamily: INTER,
        }}
      >
        <Container maxWidth="md" sx={{ pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}>
          {/* Hero */}
          <Stack spacing={2.5} sx={{ textAlign: "center", mb: { xs: 5, md: 6 }, alignItems: "center" }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "#DCFCE7", color: "#166534", display: "grid", placeItems: "center" }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 36 }} />
            </Box>

            <Box>
              <Typography sx={{ fontFamily: INTER, fontSize: "0.875rem", fontWeight: 600, color: GOLD_DEEP, mb: 1 }}>
                Application received
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontFamily: INTER,
                  fontSize: { xs: "1.625rem", md: "2rem" },
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
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
                Your application is in. We sent a sign-in email so you can start setting
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
                fontWeight: 700,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
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
                      borderRadius: "16px",
                      boxShadow: SHADOW,
                    }}
                  >
                    <Box sx={{ position: "relative", flexShrink: 0 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: SAND, color: GOLD_DEEP, display: "grid", placeItems: "center" }}>
                        <Icon sx={{ fontSize: 20 }} />
                      </Box>
                      <Box
                        sx={{
                          position: "absolute",
                          top: -4,
                          left: -4,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          bgcolor: NAVY,
                          color: "#FFFFFF",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                          fontFamily: INTER,
                        }}
                      >
                        {i + 1}
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontFamily: INTER,
                          color: INK,
                          fontWeight: 700,
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
              Already got your sign-in email? Open the portal and start adding your catalog.
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
                  borderRadius: "10px",
                  bgcolor: NAVY,
                  color: "#fff",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
                  backgroundImage: "none",
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  minHeight: 40,
                  px: 2.25,
                  "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)" },
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
                  borderRadius: "10px",
                  borderColor: LINE_STRONG,
                  color: INK,
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  minHeight: 40,
                  px: 2.25,
                  bgcolor: "#FFFFFF",
                  "&:hover": { borderColor: LINE_STRONG, bgcolor: "#F8F4EC" },
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
                sx={{ color: NAVY, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                partners@aestheticsuccessnetwork.com
              </Box>
            </Typography>
          </Stack>
        </Container>
      </Box>
      <SitePage><SiteFooter /></SitePage>
    </>
  );
}
