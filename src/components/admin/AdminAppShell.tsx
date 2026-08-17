"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const SIDEBAR_W = 264;

type CurrentAdmin = { email: string; full_name: string; role: string };

type QueueCounts = {
  expertsPending: number;
  partnersPending: number;
  hotlineNeedsRouting: number;
  dealsPending: number;
};

function initials(full: string): string {
  return full
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType<{ sx?: object }>;
  badgeKey?: keyof QueueCounts;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/admin", label: "Dashboard", icon: DashboardOutlinedIcon },
      { href: "/admin/waitlist", label: "Launch waitlist", icon: MarkEmailReadOutlinedIcon },
    ],
  },
  {
    label: "NETWORK",
    items: [
      {
        href: "/admin/hotline",
        label: "Expert Hotline",
        icon: SupportAgentOutlinedIcon,
        badgeKey: "hotlineNeedsRouting",
      },
      { href: "/admin/deals", label: "Vendor deals", icon: LocalOfferOutlinedIcon, badgeKey: "dealsPending" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { href: "/admin/members", label: "Members", icon: PeopleAltOutlinedIcon },
      { href: "/admin/experts", label: "Experts", icon: SchoolOutlinedIcon, badgeKey: "expertsPending" },
      { href: "/admin/partners", label: "Partners", icon: StoreOutlinedIcon, badgeKey: "partnersPending" },
      { href: "/admin/admins", label: "Admin team", icon: AdminPanelSettingsOutlinedIcon },
    ],
  },
  {
    label: "SYSTEM",
    items: [{ href: "/admin/audit-log", label: "Audit log", icon: HistoryOutlinedIcon }],
  },
];

function SidebarContent({
  pathname,
  onClose,
  me,
  counts,
}: {
  pathname: string;
  onClose?: () => void;
  me: CurrentAdmin | null;
  counts: QueueCounts;
}) {
  const displayName = me?.full_name ?? "—";
  const role = me?.role ?? "admin";
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
          href="/admin"
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
          variant="body2"
          sx={{
            mt: 1.5,
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.68rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Admin Console
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
              {initials(displayName)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{ color: "common.white", fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.2 }}
                noWrap
              >
                {displayName}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", textTransform: "capitalize" }}
                noWrap
              >
                {role}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ px: 2.25, py: 1.5, flex: 1 }}>
        <Stack spacing={2}>
          {navSections.map((sec) => (
            <Box key={sec.label}>
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  mb: 0.75,
                  px: 1,
                }}
              >
                {sec.label}
              </Typography>
              <Stack spacing={0.25}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  const badge = item.badgeKey ? counts[item.badgeKey] : 0;
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
                      {badge > 0 && (
                        <Chip
                          label={badge}
                          size="small"
                          sx={{
                            bgcolor: "rgba(217,168,75,0.2)",
                            color: "#F0C16E",
                            fontWeight: 700,
                            fontSize: "0.65rem",
                            height: 18,
                            minWidth: 22,
                            "& .MuiChip-label": { px: 0.75 },
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>

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
              mb: 0.75,
            }}
          >
            REVIEW QUEUES
          </Typography>
          <Stack direction="row" spacing={2}>
            <Stack>
              <Typography
                sx={{ fontFamily: "var(--font-display)", color: "common.white", fontSize: "1.4rem", lineHeight: 1 }}
              >
                {counts.expertsPending}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>
                experts
              </Typography>
            </Stack>
            <Stack>
              <Typography
                sx={{ fontFamily: "var(--font-display)", color: "common.white", fontSize: "1.4rem", lineHeight: 1 }}
              >
                {counts.partnersPending}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>
                partners
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const [me, setMe] = useState<CurrentAdmin | null>(null);
  const [counts, setCounts] = useState<QueueCounts>({
    expertsPending: 0,
    partnersPending: 0,
    hotlineNeedsRouting: 0,
    dealsPending: 0,
  });

  // One request for both the user chip and the queue badges. This used to
  // be three: a browser auth.getUser(), an admin_users select, and this
  // fetch — each a separate round trip on every admin page view.
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        me?: CurrentAdmin;
        experts?: { pending?: number };
        partners?: { pending?: number };
        hotline?: { needsRouting?: number };
        deals?: { pending?: number };
      };
      if (body.me) setMe(body.me);
      setCounts({
        expertsPending: body.experts?.pending ?? 0,
        partnersPending: body.partners?.pending ?? 0,
        hotlineNeedsRouting: body.hotline?.needsRouting ?? 0,
        dealsPending: body.deals?.pending ?? 0,
      });
    } catch {
      // ignore — counts are decorative
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const t = setInterval(() => void loadOverview(), 90_000);
    return () => clearInterval(t);
  }, [loadOverview]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    try {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/admin/login");
  };

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
          <SidebarContent pathname={pathname} me={me} counts={counts} />
        </Box>
      )}
      {!isMd && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{ paper: { sx: { width: SIDEBAR_W, border: "none" } } }}
        >
          <SidebarContent
            pathname={pathname}
            onClose={() => setDrawerOpen(false)}
            me={me}
            counts={counts}
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
              label="ADMIN MODE"
              size="small"
              sx={{
                bgcolor: "rgba(220, 60, 60, 0.12)",
                color: "#8C1D1D",
                border: "1px solid rgba(220,60,60,0.3)",
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
                ml: 0.5,
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
                {initials(me?.full_name ?? "")}
              </Avatar>
              <Box sx={{ display: { xs: "none", lg: "block" }, textAlign: "left" }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.15 }}>
                  {me?.full_name ?? "—"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontSize: "0.7rem", color: "text.secondary", textTransform: "capitalize" }}
                >
                  Admin · {me?.role ?? "—"}
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
                  {me?.full_name ?? "—"}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                  {me?.email ?? ""}
                </Typography>
              </Box>
              <Divider />
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
          © 2026 Aesthetic Success Network · Admin console · Launch phase
        </Box>
      </Box>
    </Box>
  );
}
