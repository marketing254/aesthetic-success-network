"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import Logo from "@/components/brand/Logo";
import ExitIntentOffer from "@/components/sections/ExitIntentOffer";
import { brand, navLinks as allNavLinks } from "@/lib/content";
import { jobBoardEnabled } from "@/lib/jobs/flag";

// The Jobs link would 404 behind the kill-switch, so it only appears once
// NEXT_PUBLIC_JOB_BOARD_ENABLED=true is set (build time, same as the routes).
const navLinks = allNavLinks.filter((l) => l.href !== "/jobs" || jobBoardEnabled());

const LOGIN_LINKS = [
  {
    label: "Members",
    href: "/member/login",
    icon: PersonOutlineRoundedIcon,
    sub: "Aesthetic practice owners and practitioners",
  },
  {
    label: "Experts",
    href: "/expert/login",
    icon: SchoolOutlinedIcon,
    sub: "Coaches, consultants and educators",
  },
  {
    label: "Partners",
    href: "/vendor/login",
    icon: StoreOutlinedIcon,
    sub: "Vendors and service providers",
  },
] as const;

/**
 * Premium pill-cluster nav inspired by modern SaaS landings.
 *
 * Layout: [Logo]          [pill with nav items]          [Join CTA]
 * No vertical divider, no rectangle "gap" artifact. The pill is one
 * continuous rounded container; on mobile it collapses into an animated
 * hamburger drawer.
 */
export default function Header() {
  const [drawer, setDrawer] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const signInAnchor = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setSignInOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Exit-intent offer, public marketing pages only
          (this Header never renders on /start or inside the portals). */}
      <ExitIntentOffer />
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          backgroundColor: "rgba(251, 248, 241, 0.85)",
          backdropFilter: "saturate(180%) blur(14px)",
          WebkitBackdropFilter: "saturate(180%) blur(14px)",
          borderBottom: "1px solid",
          borderColor: "rgba(14,42,61,0.06)",
          color: "#0A1A2F",
          zIndex: (t) => t.zIndex.appBar,
          overflow: "visible",
        }}
      >
        <Container maxWidth="xl" disableGutters sx={{ overflow: "visible" }}>
          <Toolbar
            disableGutters
            sx={{
              minHeight: { xs: 76, md: 92 },
              height: { xs: 76, md: 92 },
              px: { xs: 2.5, sm: 3, md: 4 },
              gap: { xs: 2, md: 3 },
              justifyContent: "space-between",
              overflow: "visible",
            }}
          >
            {/* Logo, oversized, overflows the toolbar intentionally */}
            <Box sx={{ position: "relative", zIndex: 1, mt: -2, mb: -6 }}>
              <Logo href="/#top" height={160} ariaLabel={`${brand.name} · home`} />
            </Box>

            {/* Pill cluster with nav items, single container, no artifacts */}
            <Box
              sx={{
                display: { xs: "none", lg: "flex" },
                alignItems: "center",
                gap: 0.25,
                bgcolor: "#FFFFFF",
                border: "1px solid rgba(14,42,61,0.08)",
                borderRadius: 999,
                px: 0.75,
                py: 0.75,
                boxShadow: "0 4px 20px -8px rgba(14,42,61,0.08)",
              }}
            >
              {navLinks.map((l) => (
                <Button
                  key={l.label}
                  href={l.href.startsWith("#") ? `/${l.href}` : l.href}
                  disableRipple
                  sx={{
                    color: "#3B4A55",
                    fontWeight: 500,
                    fontSize: "0.86rem",
                    px: 2.25,
                    py: 0.85,
                    borderRadius: 999,
                    minWidth: "auto",
                    textTransform: "none",
                    transition: "color 200ms ease, background-color 200ms ease",
                    "&:hover": {
                      color: "#0A1A2F",
                      bgcolor: "rgba(217,168,75,0.10)",
                    },
                  }}
                >
                  {l.label}
                </Button>
              ))}
            </Box>

            {/* Right side: single Sign-in button with a Members/Experts/
                Partners dropdown — cleaner than 3 buttons, scales better
                on mid-density widths. */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Button
                ref={signInAnchor}
                onClick={() => setSignInOpen((v) => !v)}
                disableElevation
                disableRipple
                // No leading icon — text + chevron only. Matches Stripe /
                // Linear / Vercel header buttons. The chevron is the
                // affordance that signals "menu opens here".
                endIcon={
                  <KeyboardArrowDownRoundedIcon
                    sx={{
                      fontSize: 18,
                      transition: "transform 180ms ease",
                      transform: signInOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                }
                sx={{
                  py: 1.1,
                  px: 2.5,
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 999,
                  letterSpacing: "-0.005em",
                  bgcolor: "#1A1A1A !important",
                  backgroundImage: "none !important",
                  color: "#FFFFFF !important",
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,0.06), 0 8px 22px -12px rgba(20,20,20,0.4)",
                  "&:hover": {
                    bgcolor: "#2A2A2A !important",
                    backgroundImage: "none !important",
                    color: "#FFFFFF !important",
                  },
                }}
              >
                Sign in
              </Button>

              <Menu
                open={signInOpen}
                anchorEl={signInAnchor.current}
                onClose={() => setSignInOpen(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1.25,
                      minWidth: 280,
                      borderRadius: 3,
                      border: "1px solid rgba(14,42,61,0.08)",
                      boxShadow:
                        "0 24px 60px -28px rgba(14,42,61,0.25), 0 1px 2px rgba(14,42,61,0.04)",
                      overflow: "hidden",
                    },
                  },
                  list: { sx: { py: 0.5 } },
                }}
              >
                <Box sx={{ px: 2, pt: 1.25, pb: 1 }}>
                  <Typography
                    sx={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: "#A07823",
                      textTransform: "uppercase",
                    }}
                  >
                    Choose your portal
                  </Typography>
                </Box>
                <Divider />
                {LOGIN_LINKS.map((l) => {
                  const Icon = l.icon;
                  return (
                    <MenuItem
                      key={l.label}
                      component={Link}
                      href={l.href}
                      onClick={() => setSignInOpen(false)}
                      sx={{
                        py: 1.25,
                        px: 2,
                        gap: 1.25,
                        alignItems: "flex-start",
                        "&:hover": { bgcolor: "rgba(217,168,75,0.08)" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                        <Icon sx={{ fontSize: 20, color: "#0A1A2F" }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={l.label}
                        secondary={l.sub}
                        slotProps={{
                          primary: {
                            sx: {
                              fontSize: "0.92rem",
                              fontWeight: 600,
                              color: "#0A1A2F",
                              lineHeight: 1.2,
                            },
                          },
                          secondary: {
                            sx: {
                              fontSize: "0.74rem",
                              color: "#5C6770",
                              mt: 0.25,
                            },
                          },
                        }}
                      />
                    </MenuItem>
                  );
                })}
              </Menu>
            </Box>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <IconButton
                onClick={() => setDrawer((v) => !v)}
                sx={{
                  display: { xs: "inline-flex", lg: "none" },
                  width: 40,
                  height: 40,
                  bgcolor: drawer ? "#0A1A2F" : "rgba(14,42,61,0.05)",
                  color: drawer ? "#F6F1E7" : "#0A1A2F",
                  "&:hover": { bgcolor: drawer ? "#0A1A2F" : "rgba(14,42,61,0.1)" },
                  transition: "background-color 200ms ease, color 200ms ease",
                }}
                aria-label={drawer ? "Close menu" : "Open menu"}
              >
                {drawer ? <CloseIcon sx={{ fontSize: 20 }} /> : <MenuIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawer}
        onClose={() => setDrawer(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100%", sm: 360 },
              bgcolor: "#FBF8F1",
              color: "#0A1A2F",
            },
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" sx={{ mb: 3, justifyContent: "space-between", alignItems: "center" }}>
            <Logo href="/" height={48} />
            <IconButton onClick={() => setDrawer(false)} aria-label="Close menu" sx={{ color: "#0A1A2F" }}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box
            sx={{
              mb: 3.5,
              p: 2,
              borderRadius: 3,
              bgcolor: "rgba(217,168,75,0.10)",
              border: "1px solid rgba(217,168,75,0.28)",
            }}
          >
            <Typography variant="overline" sx={{ color: "#A07823", display: "block", mb: 0.5, fontSize: "0.66rem", letterSpacing: "0.16em" }}>
              FOUNDING MEMBERSHIP · FIRST 100
            </Typography>
            <Typography variant="body2" sx={{ color: "#3B4A55", fontSize: "0.86rem", lineHeight: 1.55 }}>
              The Expert Hotline, member-only partner deals, a curated resource library, and monthly live AMAs and CE. $49/mo founding rate, locked while your membership stays active.
            </Typography>
          </Box>

          <Stack spacing={0.5} sx={{ mb: 4 }}>
            {navLinks.map((l) => (
              <Button
                key={l.label}
                href={l.href.startsWith("#") ? `/${l.href}` : l.href}
                onClick={() => setDrawer(false)}
                disableRipple
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14, opacity: 0.4 }} />}
                sx={{
                  justifyContent: "space-between",
                  color: "#0A1A2F",
                  fontSize: "1.05rem",
                  fontWeight: 500,
                  py: 1.5,
                  px: 1.5,
                  textTransform: "none",
                  "&:hover": { bgcolor: "rgba(14,42,61,0.04)" },
                }}
              >
                {l.label}
              </Button>
            ))}
          </Stack>

          <Stack spacing={1}>
            {LOGIN_LINKS.map((l, idx) => {
              const isPrimary = idx === 0;
              return (
                <Button
                  key={l.label}
                  component={Link}
                  href={l.href}
                  onClick={() => setDrawer(false)}
                  fullWidth
                  size="large"
                  startIcon={<LoginOutlinedIcon />}
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    justifyContent: "space-between",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    py: 1.4,
                    borderRadius: 2,
                    ...(isPrimary
                      ? {
                          bgcolor: "#1A1A1A !important",
                          backgroundImage: "none !important",
                          color: "#FFFFFF !important",
                          "&:hover": {
                            bgcolor: "#2A2A2A !important",
                            backgroundImage: "none !important",
                            color: "#FFFFFF !important",
                          },
                        }
                      : {
                          bgcolor: "transparent",
                          color: "#0A1A2F",
                          border: "1px solid rgba(14,42,61,0.18)",
                          "&:hover": {
                            borderColor: "#A07823",
                            bgcolor: "rgba(217,168,75,0.06)",
                          },
                        }),
                  }}
                >
                  {l.label} sign in
                </Button>
              );
            })}
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
