"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Avatar,
  Box,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";

/**
 * PortalChrome
 *
 * The Aesthetic Success Network portal frame shared by the expert,
 * company, admin and member shells: a slim navy top bar (ASN logo tile +
 * wordmark, portal chip, right-side slot for bell / avatar), a horizontal
 * tab row on ivory (collapsing to a drawer on small screens), a centred
 * 1180px content column and the brand footer line.
 *
 * Purely presentational. Each shell keeps its own data hooks, nav items,
 * menus and billing gates and passes them in.
 */

export const PORTAL = {
  ivory: "#F6F1E7",
  cream: "#FBF8F1",
  ink: "#0A1320",
  inkSoft: "#3B4A55",
  muted: "#5C6770",
  faint: "#7A8590",
  gold: "#D9A84B",
  goldBright: "#F0C16E",
  goldDeep: "#A07823",
  clay: "#E0DACE",
  white: "#FFFFFF",
  expert: "#2C7A52",
  expertDark: "#1F5238",
  expertTint: "#E8F2EC",
  company: "#6E3346",
  companyDark: "#4A2030",
  companyTint: "#F4E7EB",
  admin: "#8C1D1D",
  adminTint: "rgba(140,29,29,0.10)",
  maxWidth: 1180,
} as const;

export type PortalAccent = "expert" | "company" | "admin" | "member";

export function accentFor(accent: PortalAccent): { main: string; dark: string; tint: string } {
  switch (accent) {
    case "expert":
      return { main: PORTAL.expert, dark: PORTAL.expertDark, tint: PORTAL.expertTint };
    case "company":
      return { main: PORTAL.company, dark: PORTAL.companyDark, tint: PORTAL.companyTint };
    case "admin":
      return { main: PORTAL.admin, dark: "#6B1414", tint: PORTAL.adminTint };
    default:
      return { main: PORTAL.goldDeep, dark: "#7A5B17", tint: "rgba(217,168,75,0.16)" };
  }
}

export type PortalNavItem = {
  href: string;
  label: string;
  icon?: React.ElementType<{ sx?: object }>;
  /** Small count shown after the label (admin queues). */
  badge?: number;
};

export type PortalNavGroup = {
  /** Optional group label shown in the drawer (admin uses these). */
  label?: string;
  items: PortalNavItem[];
};

export function isPortalPathActive(itemHref: string, pathname: string, rootHref: string): boolean {
  if (itemHref === rootHref) return pathname === rootHref;
  return pathname.startsWith(itemHref);
}

/* ------------------------------------------------------------------ */
/* Brand mark                                                          */
/* ------------------------------------------------------------------ */

export function PortalBrand({
  href,
  portalName,
  accent,
  compact,
}: {
  href: string;
  portalName: string;
  accent: PortalAccent;
  compact?: boolean;
}) {
  const a = accentFor(accent);
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
      <Box
        component={Link}
        href={href}
        aria-label="Aesthetic Success Network"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1.25,
          textDecoration: "none",
          color: "inherit",
          minWidth: 0,
          "&:focus-visible": { outline: `2px solid ${PORTAL.gold}`, outlineOffset: 3, borderRadius: 8 },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: 34,
            height: 34,
            borderRadius: "9px",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.14)",
          }}
        >
          <Image src="/asn-nav-icon.png" alt="" fill sizes="34px" style={{ objectFit: "cover" }} priority />
        </Box>
        {!compact && (
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "1.02rem",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              lineHeight: 1,
              display: { xs: "none", sm: "block" },
            }}
          >
            Aesthetic Success Network
          </Typography>
        )}
      </Box>
      <Chip
        label={portalName}
        size="small"
        sx={{
          height: 22,
          fontSize: "0.64rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          bgcolor: "rgba(255,255,255,0.10)",
          color: "#FFFFFF",
          border: "1px solid rgba(255,255,255,0.16)",
          "& .MuiChip-label": { px: 1 },
          "&::before": {
            content: '""',
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: accent === "member" ? PORTAL.gold : a.main === PORTAL.admin ? "#E05A5A" : a.main,
            ml: 1,
            mr: -0.5,
            boxShadow: `0 0 0 3px ${accent === "member" ? "rgba(217,168,75,0.25)" : "rgba(255,255,255,0.10)"}`,
          },
          display: { xs: "none", md: "inline-flex" },
        }}
      />
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar button used in the top bar                                   */
/* ------------------------------------------------------------------ */

export function PortalAvatarButton({
  anchorRef,
  onClick,
  open,
  src,
  initials,
  name,
  subline,
  accent,
}: {
  anchorRef: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  open?: boolean;
  src?: string | null;
  initials: string;
  name: string;
  subline?: string;
  accent: PortalAccent;
}) {
  const a = accentFor(accent);
  return (
    <Box
      ref={anchorRef}
      component="button"
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open ? "true" : "false"}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 0.5,
        pr: { xs: 0.5, sm: 1 },
        py: 0.5,
        bgcolor: "transparent",
        border: "1px solid transparent",
        borderRadius: 999,
        cursor: "pointer",
        color: "#FFFFFF",
        fontFamily: "inherit",
        transition: "background-color 160ms ease, border-color 160ms ease",
        "&:hover": { bgcolor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" },
        "&:focus-visible": { outline: `2px solid ${PORTAL.gold}`, outlineOffset: 2 },
      }}
    >
      <Avatar
        src={src ?? undefined}
        sx={{
          width: 32,
          height: 32,
          bgcolor: accent === "member" ? PORTAL.gold : a.main,
          color: accent === "member" ? PORTAL.ink : "#FFFFFF",
          fontSize: "0.74rem",
          fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        {initials}
      </Avatar>
      <Box sx={{ display: { xs: "none", lg: "block" }, textAlign: "left", minWidth: 0, maxWidth: 180 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.15, color: "#FFFFFF" }} noWrap>
          {name}
        </Typography>
        {subline && (
          <Typography sx={{ fontSize: "0.66rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.2 }} noWrap>
            {subline}
          </Typography>
        )}
      </Box>
      <KeyboardArrowDownOutlinedIcon
        sx={{
          fontSize: 16,
          color: "rgba(255,255,255,0.7)",
          display: { xs: "none", sm: "block" },
          transition: "transform 200ms ease",
          transform: open ? "rotate(180deg)" : "rotate(0)",
        }}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Tab row                                                             */
/* ------------------------------------------------------------------ */

function TabLink({
  item,
  active,
  accent,
  onNavigate,
}: {
  item: PortalNavItem;
  active: boolean;
  accent: PortalAccent;
  onNavigate?: () => void;
}) {
  const a = accentFor(accent);
  const Icon = item.icon;
  return (
    <Box
      component={Link}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 1.35,
        textDecoration: "none",
        whiteSpace: "nowrap",
        fontSize: "0.86rem",
        fontWeight: active ? 700 : 500,
        color: active ? PORTAL.ink : PORTAL.muted,
        flexShrink: 0,
        transition: "color 160ms ease",
        "&:hover": { color: PORTAL.ink },
        "&::after": {
          content: '""',
          position: "absolute",
          left: 10,
          right: 10,
          bottom: -1,
          height: 3,
          borderRadius: 3,
          bgcolor: active ? a.main : "transparent",
          transition: "background-color 160ms ease",
        },
        "&:hover::after": { bgcolor: active ? a.main : "rgba(10,19,32,0.12)" },
        "&:focus-visible": { outline: `2px solid ${PORTAL.gold}`, outlineOffset: -2, borderRadius: 8 },
      }}
    >
      {Icon && <Icon sx={{ fontSize: 17, color: active ? a.main : PORTAL.faint }} />}
      <span>{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <Box
          component="span"
          sx={{
            ml: 0.25,
            px: 0.7,
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            fontSize: "0.64rem",
            fontWeight: 700,
            display: "inline-grid",
            placeItems: "center",
            bgcolor: "rgba(217,168,75,0.22)",
            color: PORTAL.goldDeep,
          }}
        >
          {item.badge}
        </Box>
      ) : null}
    </Box>
  );
}

function DrawerLink({
  item,
  active,
  accent,
  onNavigate,
}: {
  item: PortalNavItem;
  active: boolean;
  accent: PortalAccent;
  onNavigate?: () => void;
}) {
  const a = accentFor(accent);
  const Icon = item.icon;
  return (
    <Box
      component={Link}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1.1,
        borderRadius: 12,
        textDecoration: "none",
        fontSize: "0.9rem",
        fontWeight: active ? 700 : 500,
        color: active ? PORTAL.ink : PORTAL.inkSoft,
        bgcolor: active ? a.tint : "transparent",
        border: "1px solid",
        borderColor: active ? `${a.main}33` : "transparent",
        transition: "background-color 160ms ease, color 160ms ease",
        "&:hover": { bgcolor: active ? a.tint : "rgba(10,19,32,0.05)", color: PORTAL.ink },
      }}
    >
      {Icon && <Icon sx={{ fontSize: 18, color: active ? a.main : PORTAL.faint }} />}
      <Box sx={{ flex: 1 }}>{item.label}</Box>
      {item.badge && item.badge > 0 ? (
        <Chip
          label={item.badge}
          size="small"
          sx={{ height: 18, fontSize: "0.64rem", bgcolor: "rgba(217,168,75,0.22)", color: PORTAL.goldDeep, "& .MuiChip-label": { px: 0.75 } }}
        />
      ) : null}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export type PortalChromeProps = {
  /** Portal accent: chips, active tab underline, avatar background. */
  accent: PortalAccent;
  /** Label in the top-bar chip, e.g. "Expert portal". */
  portalName: string;
  /** Where the logo links to. Also the exact-match root for active state. */
  homeHref: string;
  /** Nav groups. One group renders as a flat tab row; several show grouped in the drawer. */
  groups: PortalNavGroup[];
  pathname: string;
  /** Right side of the top bar: bell, switch buttons, avatar button. */
  topRight?: React.ReactNode;
  /** Extra content rendered under the nav links inside the mobile drawer. */
  drawerFooter?: React.ReactNode;
  /** Optional strip rendered between the tab row and the content (banners). */
  beforeContent?: React.ReactNode;
  /** Footer: right-hand links (hotline / email). */
  footerLinks?: { href: string; label: string }[];
  /** Footer brand line. */
  footerLine?: string;
  /** Extra nodes (menus, dialogs, floating assistant) rendered at the root. */
  overlays?: React.ReactNode;
  /** Widest content column, default 1180px. */
  maxWidth?: number;
  children: React.ReactNode;
};

export default function PortalChrome({
  accent,
  portalName,
  homeHref,
  groups,
  pathname,
  topRight,
  drawerFooter,
  beforeContent,
  footerLinks,
  footerLine = "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics",
  overlays,
  maxWidth = PORTAL.maxWidth,
  children,
}: PortalChromeProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const a = accentFor(accent);

  return (
    <Box className="asn-portal" sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navy top bar */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: theme.zIndex.appBar,
          bgcolor: PORTAL.ink,
          color: "#FFFFFF",
          backgroundImage: "linear-gradient(90deg, rgba(217,168,75,0.10) 0%, transparent 45%)",
          borderBottom: `1px solid rgba(217,168,75,0.35)`,
        }}
      >
        <Container maxWidth={false} sx={{ maxWidth, px: { xs: 2, md: 3 } }}>
          <Stack direction="row" sx={{ minHeight: 60, alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
              {!desktop && (
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  edge="start"
                  size="small"
                  aria-label="Open navigation"
                  sx={{ color: "#FFFFFF", "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}
                >
                  <MenuOutlinedIcon />
                </IconButton>
              )}
              <PortalBrand href={homeHref} portalName={portalName} accent={accent} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
              {topRight}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Ivory tab row (desktop) */}
      {desktop && (
        <Box
          component="nav"
          aria-label={`${portalName} sections`}
          sx={{
            position: "sticky",
            top: 60,
            zIndex: theme.zIndex.appBar - 1,
            bgcolor: "rgba(246,241,231,0.92)",
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${PORTAL.clay}`,
          }}
        >
          <Container maxWidth={false} sx={{ maxWidth, px: { xs: 2, md: 3 } }}>
            <Stack
              direction="row"
              spacing={0.25}
              sx={{
                alignItems: "center",
                overflowX: "auto",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
                mx: -1.25,
              }}
            >
              {groups.map((g, gi) => (
                <Stack key={g.label ?? gi} direction="row" spacing={0.25} sx={{ alignItems: "center", flexShrink: 0 }}>
                  {gi > 0 && (
                    <Box
                      aria-hidden
                      sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: PORTAL.clay, mx: 1, flexShrink: 0 }}
                    />
                  )}
                  {g.items.map((item) => (
                    <TabLink
                      key={item.href}
                      item={item}
                      active={isPortalPathActive(item.href, pathname, homeHref)}
                      accent={accent}
                    />
                  ))}
                </Stack>
              ))}
            </Stack>
          </Container>
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 300, bgcolor: PORTAL.cream, border: 0 } } }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 1.5, bgcolor: PORTAL.ink, color: "#FFFFFF" }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <PortalBrand href={homeHref} portalName={portalName} accent={accent} compact />
            <IconButton size="small" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" sx={{ color: "#FFFFFF" }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography sx={{ mt: 1.25, fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: PORTAL.goldBright }}>
            {portalName}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, flex: 1, overflowY: "auto" }}>
          <Stack spacing={1.5}>
            {groups.map((g, gi) => (
              <Box key={g.label ?? gi}>
                {g.label && (
                  <Typography
                    sx={{
                      px: 1.5,
                      mb: 0.5,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: PORTAL.goldDeep,
                    }}
                  >
                    {g.label}
                  </Typography>
                )}
                <Stack spacing={0.25}>
                  {g.items.map((item) => (
                    <DrawerLink
                      key={item.href}
                      item={item}
                      active={isPortalPathActive(item.href, pathname, homeHref)}
                      accent={accent}
                      onNavigate={() => setDrawerOpen(false)}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
          {drawerFooter && (
            <>
              <Divider sx={{ my: 2 }} />
              {drawerFooter}
            </>
          )}
        </Box>
      </Drawer>

      {beforeContent}

      {/* Content column */}
      <Box component="main" sx={{ flex: 1, py: { xs: 3, md: 5 } }}>
        <Container maxWidth={false} sx={{ maxWidth, px: { xs: 2, md: 3 } }}>
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ borderTop: `1px solid ${PORTAL.clay}`, py: 3, mt: 4 }}>
        <Container maxWidth={false} sx={{ maxWidth, px: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: a.main, boxShadow: `0 0 0 3px ${a.main}22` }} />
              <Typography sx={{ fontSize: "0.74rem", color: PORTAL.faint, letterSpacing: "0.02em" }}>
                {footerLine}
              </Typography>
            </Stack>
            {footerLinks && footerLinks.length > 0 && (
              <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                {footerLinks.map((l) => (
                  <Box
                    key={l.href}
                    component="a"
                    href={l.href}
                    sx={{
                      fontSize: "0.76rem",
                      color: PORTAL.goldDeep,
                      textDecoration: "none",
                      fontWeight: 600,
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {l.label}
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>

      {overlays}
    </Box>
  );
}
