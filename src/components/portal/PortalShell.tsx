"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
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
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const SIDEBAR_W = 260;

export type PortalKind = "member" | "expert" | "partner";

type NavItem = { href: string; label: string; icon: React.ElementType<{ sx?: object }> };

type Identity = {
  email: string;
  member: { firstName: string; lastName: string; practiceName: string | null; tier: string } | null;
  expert: { fullName: string; company: string | null } | null;
  partner: { companyName: string; contactName: string } | null;
  roles: PortalKind[];
};

const PORTALS: Record<
  PortalKind,
  { home: string; label: string; eyebrow: string; nav: NavItem[] }
> = {
  member: {
    home: "/dashboard",
    label: "Member portal",
    eyebrow: "Founding member",
    nav: [
      { href: "/dashboard", label: "Overview", icon: DashboardOutlinedIcon },
      { href: "/dashboard/hotline", label: "Expert Hotline", icon: SupportAgentOutlinedIcon },
      { href: "/dashboard/deals", label: "Vendor deals", icon: LocalOfferOutlinedIcon },
      { href: "/dashboard/kits", label: "Expert kits", icon: AutoStoriesOutlinedIcon },
      { href: "/dashboard/account", label: "Account", icon: PersonOutlineOutlinedIcon },
    ],
  },
  expert: {
    home: "/expert",
    label: "Expert portal",
    eyebrow: "Network expert",
    nav: [
      { href: "/expert", label: "Overview", icon: DashboardOutlinedIcon },
      { href: "/expert/requests", label: "Hotline queue", icon: AssignmentOutlinedIcon },
      { href: "/expert/kits", label: "My kits", icon: AutoStoriesOutlinedIcon },
      { href: "/expert/profile", label: "Profile", icon: PersonOutlineOutlinedIcon },
    ],
  },
  partner: {
    home: "/vendor",
    label: "Partner portal",
    eyebrow: "Vetted partner",
    nav: [
      { href: "/vendor", label: "Overview", icon: DashboardOutlinedIcon },
      { href: "/vendor/deals", label: "My deals", icon: StorefrontOutlinedIcon },
      { href: "/vendor/profile", label: "Profile", icon: PersonOutlineOutlinedIcon },
    ],
  },
};

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—"
  );
}

function displayNameFor(portal: PortalKind, me: Identity | null): string {
  if (!me) return "—";
  if (portal === "member" && me.member) return `${me.member.firstName} ${me.member.lastName}`.trim();
  if (portal === "expert" && me.expert) return me.expert.fullName;
  if (portal === "partner" && me.partner) return me.partner.companyName;
  return me.email;
}

function subtitleFor(portal: PortalKind, me: Identity | null): string {
  if (!me) return "";
  if (portal === "member") return me.member?.practiceName ?? "Founding member";
  if (portal === "expert") return me.expert?.company ?? "Network expert";
  return me.partner?.contactName ?? "Vetted partner";
}

function SidebarContent({
  portal,
  pathname,
  me,
  onClose,
}: {
  portal: PortalKind;
  pathname: string;
  me: Identity | null;
  onClose?: () => void;
}) {
  const cfg = PORTALS[portal];
  const name = displayNameFor(portal, me);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#1A1A1A",
        color: "common.white",
        backgroundImage:
          "radial-gradient(120% 60% at 50% -20%, rgba(217,168,75,0.14) 0%, transparent 60%)",
      }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Box
          component={Link}
          href={cfg.home}
          sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 1.25 }}
        >
          <Box
            component="img"
            src="/asn-nav-icon.png"
            alt="Aesthetic Success Network"
            sx={{
              width: 38,
              height: 38,
              borderRadius: "9px",
              flexShrink: 0,
              border: "1px solid rgba(217,168,75,0.35)",
            }}
          />
          <Box>
            <Typography
              sx={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#F6F1E7", lineHeight: 1.15 }}
            >
              Aesthetic Success Network
            </Typography>
            <Typography
              sx={{
                fontSize: "0.52rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#D9A84B",
                fontWeight: 700,
                mt: 0.4,
              }}
            >
              Powered by Business of Aesthetics
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{
            mt: 1.5,
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.68rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {cfg.label}
        </Typography>
      </Box>

      <Box sx={{ px: 2.25, pb: 1 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.08)",
            bgcolor: "rgba(255,255,255,0.03)",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Avatar
              sx={{
                bgcolor: "rgba(217,168,75,0.18)",
                color: "#F0C16E",
                width: 38,
                height: 38,
                fontWeight: 700,
                fontSize: "0.9rem",
                border: "1px solid rgba(217,168,75,0.4)",
              }}
            >
              {initials(name)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{ color: "common.white", fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.2 }}
                noWrap
              >
                {name}
              </Typography>
              <Typography
                sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem" }}
                noWrap
              >
                {subtitleFor(portal, me)}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ px: 2.25, py: 1.5, flex: 1 }}>
        <Stack spacing={0.25}>
          {cfg.nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === cfg.home ? pathname === cfg.home : pathname.startsWith(item.href);
            return (
              <Box
                key={item.href}
                component={Link}
                href={item.href}
                onClick={onClose}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 1.5,
                  py: 1.05,
                  borderRadius: 2,
                  color: active ? "common.white" : "rgba(255,255,255,0.65)",
                  bgcolor: active ? "rgba(217,168,75,0.12)" : "transparent",
                  border: "1px solid",
                  borderColor: active ? "rgba(217,168,75,0.25)" : "transparent",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  fontWeight: active ? 600 : 500,
                  "&:hover": {
                    bgcolor: active ? "rgba(217,168,75,0.16)" : "rgba(255,255,255,0.05)",
                    color: "common.white",
                  },
                }}
              >
                <Icon sx={{ fontSize: 20, color: active ? "#F0C16E" : "inherit" }} />
                <Box sx={{ flex: 1 }}>{item.label}</Box>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Portal switcher — only when this email holds more than one role. */}
      {me && me.roles.length > 1 && (
        <Box sx={{ px: 2.25, pb: 2.5 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "rgba(255,255,255,0.03)",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                mb: 1,
              }}
            >
              SWITCH PORTAL
            </Typography>
            <Stack spacing={0.5}>
              {me.roles
                .filter((r) => r !== portal)
                .map((r) => (
                  <Box
                    key={r}
                    component={Link}
                    href={PORTALS[r].home}
                    onClick={onClose}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1.25,
                      py: 0.9,
                      borderRadius: 2,
                      color: "rgba(255,255,255,0.75)",
                      textDecoration: "none",
                      fontSize: "0.83rem",
                      fontWeight: 600,
                      "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "common.white" },
                    }}
                  >
                    <SwapHorizOutlinedIcon sx={{ fontSize: 17, color: "#F0C16E" }} />
                    {PORTALS[r].label}
                  </Box>
                ))}
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default function PortalShell({
  portal,
  children,
}: {
  portal: PortalKind;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const theme = useTheme();
  const router = useRouter();
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLDivElement | null>(null);
  const [me, setMe] = useState<Identity | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/portal/me", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as Identity;
        if (active) setMe(body);
      } catch {
        // The page itself is already guarded server-side; the chip is cosmetic.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    try {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const cfg = PORTALS[portal];
  const name = displayNameFor(portal, me);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F4F0E6", display: "flex" }}>
      {isMd && (
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_W,
            flexShrink: 0,
            position: "fixed",
            inset: 0,
            right: "auto",
            zIndex: theme.zIndex.appBar - 1,
          }}
        >
          <SidebarContent portal={portal} pathname={pathname} me={me} />
        </Box>
      )}
      {!isMd && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{ paper: { sx: { width: SIDEBAR_W, border: "none" } } }}
        >
          <SidebarContent
            portal={portal}
            pathname={pathname}
            me={me}
            onClose={() => setDrawerOpen(false)}
          />
        </Drawer>
      )}

      <Box sx={{ flex: 1, ml: { md: `${SIDEBAR_W}px` }, minWidth: 0 }}>
        <AppBar
          position="sticky"
          sx={{
            bgcolor: "rgba(244,240,230,0.85)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid",
            borderColor: "divider",
            color: "text.primary",
          }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: { xs: 60, md: 68 } }}>
            {!isMd && (
              <IconButton onClick={() => setDrawerOpen(true)} edge="start">
                <MenuOutlinedIcon />
              </IconButton>
            )}
            <Chip
              label={cfg.eyebrow.toUpperCase()}
              size="small"
              sx={{
                bgcolor: "rgba(217,168,75,0.16)",
                color: "#7A5C10",
                border: "1px solid rgba(217,168,75,0.4)",
                fontWeight: 700,
                fontSize: "0.65rem",
                letterSpacing: "0.12em",
                height: 24,
              }}
            />
            <Box sx={{ flex: 1 }} />
            <Box
              ref={userMenuAnchor}
              component="button"
              onClick={() => setUserMenuOpen(true)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                pl: { xs: 0, sm: 1.25 },
                pr: { xs: 0, sm: 1 },
                py: 0.5,
                bgcolor: "transparent",
                border: 0,
                borderRadius: "999px",
                cursor: "pointer",
                color: "text.primary",
                fontFamily: "inherit",
                "&:hover": { bgcolor: "rgba(10,19,32,0.05)" },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: "primary.main",
                  color: "common.white",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                {initials(name)}
              </Avatar>
              <Box sx={{ display: { xs: "none", lg: "block" }, textAlign: "left" }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.15 }}>
                  {name}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                  {cfg.eyebrow}
                </Typography>
              </Box>
              <KeyboardArrowDownOutlinedIcon sx={{ fontSize: 18, color: "text.secondary", ml: 0.25 }} />
            </Box>
            <Menu
              open={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              anchorEl={userMenuAnchor.current}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1,
                    minWidth: 280,
                    borderRadius: "16px",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 24px 48px -20px rgba(10,19,32,0.25)",
                    overflow: "hidden",
                  },
                },
                list: { sx: { py: 0.5 } },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1.25 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.2 }}>
                  {name}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                  {me?.email ?? ""}
                </Typography>
              </Box>
              <Divider />
              {(me?.roles ?? [])
                .filter((r) => r !== portal)
                .map((r) => (
                  <MenuItem
                    key={r}
                    component={Link}
                    href={PORTALS[r].home}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <ListItemIcon>
                      <SwapHorizOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Go to ${PORTALS[r].label.toLowerCase()}`}
                      slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }}
                    />
                  </MenuItem>
                ))}
              <MenuItem onClick={handleSignOut} sx={{ color: "error.main" }}>
                <ListItemIcon sx={{ color: "error.main" }}>
                  <LogoutOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Sign out"
                  slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }}
                />
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
          <Container maxWidth="xl">{children}</Container>
        </Box>

        <Divider />
        <Box sx={{ px: 3, py: 2.5, color: "text.secondary", fontSize: "0.8rem" }}>
          © 2026 Aesthetic Success Network · {cfg.label}
        </Box>
      </Box>
    </Box>
  );
}
