"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSignOut } from "@/lib/auth/identity";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import { jobBoardEnabled } from "@/lib/jobs/flag";
import NotificationsBell from "@/components/shared/NotificationsBell";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Admin console shell (redesigned 15 Oct 2026): a fixed left sidebar with
 * grouped navigation, a page search (Ctrl/Cmd + K), queue badges and the
 * signed-in admin at the bottom; a slim top bar with the current page,
 * the review-queue shortcut and notifications; full-width content.
 * The sidebar collapses to icons on desktop and becomes a drawer on phones.
 *
 * Inside the content area the display serif is swapped for the body sans
 * and page titles are sized for a work tool, so every admin page reads as
 * one consistent, compact UI without editing each page.
 */

const C = {
  side: "#0B1422",
  sideHover: "rgba(255,255,255,0.06)",
  sideActive: "rgba(217,168,75,0.14)",
  sideText: "rgba(255,255,255,0.72)",
  sideMuted: "rgba(255,255,255,0.42)",
  sideLine: "rgba(255,255,255,0.08)",
  gold: "#D9A84B",
  goldBright: "#F0C16E",
  ink: "#0A1320",
  muted: "#5C6770",
  line: "#E7E2D8",
  canvas: "#F7F5F0",
  white: "#FFFFFF",
};

const SIDE_W = 256;
const SIDE_W_MINI = 72;
const TOP_H = 60;

type CurrentAdmin = { email: string; full_name: string; role: string };

type QueueCounts = {
  pendingMembers: number;
  vendorsPending: number;
  offersPending: number;
  catalogPending: number;
  resourcesPending: number;
  expertsPending: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType<{ sx?: object; fontSize?: "small" | "inherit" }>;
  badgeKey?: keyof QueueCounts;
  keywords?: string;
};

type NavGroup = { label: string; items: NavItem[] };

function useCurrentAdmin(): CurrentAdmin | null {
  const [me, setMe] = useState<CurrentAdmin | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) return;
      const { data } = await supabase.from("admin_users").select("email, full_name, role").eq("email", email).maybeSingle();
      if (!active) return;
      setMe(data ?? { email, full_name: email.split("@")[0] ?? "Admin", role: "admin" });
    })();
    return () => {
      active = false;
    };
  }, []);
  return me;
}

function initials(full: string): string {
  return (
    full
      .replace(/\(.*?\)/g, "")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD"
  );
}

// Grouped by how the team works through a day.
function buildNav(): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", icon: DashboardOutlinedIcon, keywords: "home overview metrics" }],
    },
    {
      label: "Providers",
      items: [
        { href: "/admin/experts", label: "Experts", icon: SchoolOutlinedIcon, badgeKey: "expertsPending", keywords: "applications bench" },
        // URL stays /admin/vendors (routes, API and DB keep "vendors").
        { href: "/admin/vendors", label: "Companies", icon: StoreOutlinedIcon, badgeKey: "vendorsPending", keywords: "partners vendors" },
        { href: "/admin/founding", label: "Founding invites", icon: WorkspacePremiumOutlinedIcon, keywords: "agreement invite" },
        { href: "/admin/invites", label: "Invite links", icon: LinkOutlinedIcon, keywords: "referral link" },
      ],
    },
    {
      label: "Members",
      items: [
        { href: "/admin/members", label: "Members", icon: PeopleAltOutlinedIcon, keywords: "subscribers" },
        { href: "/admin/pending-members", label: "Pending members", icon: HourglassEmptyOutlinedIcon, badgeKey: "pendingMembers", keywords: "abandoned" },
        { href: "/admin/waitlist", label: "Launch waitlist", icon: MarkEmailReadOutlinedIcon, keywords: "launch email" },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/resources", label: "Resources", icon: LibraryBooksOutlinedIcon, badgeKey: "resourcesPending", keywords: "kits protocols library" },
        { href: "/admin/content", label: "Catalog", icon: Inventory2OutlinedIcon, badgeKey: "catalogPending", keywords: "products services" },
        { href: "/admin/offers", label: "Company offers", icon: LocalOfferOutlinedIcon, badgeKey: "offersPending", keywords: "deals" },
        { href: "/admin/spotlights", label: "Spotlights", icon: AutoAwesomeOutlinedIcon, keywords: "news events" },
        { href: "/admin/broadcast", label: "Broadcast", icon: CampaignOutlinedIcon, keywords: "post announcement feed" },
      ],
    },
    {
      label: "Support",
      items: [
        { href: "/admin/inquiries", label: "Inquiries", icon: ChatBubbleOutlineOutlinedIcon, keywords: "questions" },
        { href: "/admin/hotline", label: "Hotline triage", icon: SupportAgentOutlinedIcon, keywords: "pearl" },
        { href: "/admin/feedback", label: "Kit feedback", icon: StarOutlineRoundedIcon, keywords: "ratings" },
        ...(jobBoardEnabled()
          ? [
              { href: "/admin/jobs", label: "Job board", icon: WorkOutlineRoundedIcon },
              { href: "/admin/job-seekers", label: "Job seekers", icon: PersonSearchOutlinedIcon },
            ]
          : []),
      ],
    },
    {
      label: "Growth",
      items: [
        { href: "/admin/referrals", label: "Referrals", icon: LinkRoundedIcon },
        { href: "/admin/promo-codes", label: "Promo codes", icon: ConfirmationNumberOutlinedIcon, keywords: "discount" },
        { href: "/admin/lead-magnets", label: "Lead magnets", icon: DownloadOutlinedIcon },
        { href: "/admin/summit", label: "Summit registrations", icon: EventAvailableOutlinedIcon },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/admin/admins", label: "Admin team", icon: AdminPanelSettingsOutlinedIcon, keywords: "users roles" },
        { href: "/admin/stripe-status", label: "Stripe status", icon: CreditCardOutlinedIcon, keywords: "billing webhook prices" },
        { href: "/admin/email-previews", label: "Email drafts", icon: MarkEmailUnreadOutlinedIcon, keywords: "templates preview" },
        { href: "/admin/audit-log", label: "Audit log", icon: HistoryOutlinedIcon, keywords: "history actions" },
      ],
    },
  ];
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ n, mini = false }: { n: number; mini?: boolean }) {
  if (!n) return null;
  return (
    <Box
      component="span"
      sx={{
        ...(mini
          ? { position: "absolute", top: 4, right: 6, minWidth: 16, height: 16, fontSize: "0.62rem" }
          : { ml: "auto", minWidth: 20, height: 20, fontSize: "0.7rem" }),
        px: 0.75,
        borderRadius: 999,
        bgcolor: C.gold,
        color: C.ink,
        fontWeight: 700,
        display: "inline-grid",
        placeItems: "center",
        lineHeight: 1,
      }}
    >
      {n > 99 ? "99+" : n}
    </Box>
  );
}

function Sidebar({
  groups,
  counts,
  pathname,
  mini,
  onToggleMini,
  onNavigate,
  me,
  onOpenUserMenu,
  searchRef,
}: {
  groups: NavGroup[];
  counts: QueueCounts;
  pathname: string;
  mini: boolean;
  onToggleMini?: () => void;
  onNavigate?: () => void;
  me: CurrentAdmin | null;
  onOpenUserMenu: (el: HTMLElement) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      query
        ? groups
            .map((g) => ({
              ...g,
              items: g.items.filter((it) => `${it.label} ${g.label} ${it.keywords ?? ""}`.toLowerCase().includes(query)),
            }))
            .filter((g) => g.items.length > 0)
        : groups,
    [groups, query],
  );
  const firstHit = shown[0]?.items[0];
  const displayName = me?.full_name ?? "Admin";

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: C.side, color: C.sideText }}>
      {/* Brand */}
      <Box sx={{ height: TOP_H, flex: "none", display: "flex", alignItems: "center", gap: 1.25, px: mini ? 0 : 2.25, justifyContent: mini ? "center" : "flex-start", borderBottom: `1px solid ${C.sideLine}` }}>
        <Box component={Link} href="/admin" onClick={onNavigate} sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", color: "inherit", minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asn-nav-icon.png" alt="" width={32} height={32} style={{ borderRadius: 8, flex: "none" }} />
          {!mini && (
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: C.white, lineHeight: 1.15, whiteSpace: "nowrap" }}>ASN Admin</Typography>
              <Typography sx={{ fontSize: "0.68rem", color: C.sideMuted, lineHeight: 1.2, whiteSpace: "nowrap" }}>Aesthetic Success Network</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Page search */}
      {!mini && (
        <Box sx={{ px: 1.75, pt: 1.75, pb: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              height: 38,
              px: 1.25,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.06)",
              border: `1px solid ${C.sideLine}`,
              "&:focus-within": { borderColor: "rgba(217,168,75,0.6)", bgcolor: "rgba(255,255,255,0.09)" },
            }}
          >
            <SearchRoundedIcon sx={{ fontSize: 18, color: C.sideMuted }} />
            <InputBase
              inputRef={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstHit) {
                  router.push(firstHit.href);
                  setQ("");
                  onNavigate?.();
                }
                if (e.key === "Escape") setQ("");
              }}
              placeholder="Jump to page"
              inputProps={{ "aria-label": "Jump to an admin page" }}
              sx={{ flex: 1, fontSize: "0.85rem", color: C.white, "& input::placeholder": { color: C.sideMuted, opacity: 1 } }}
            />
            <Box component="kbd" sx={{ fontSize: "0.62rem", color: C.sideMuted, border: `1px solid ${C.sideLine}`, borderRadius: 1, px: 0.6, py: 0.1, fontFamily: "inherit" }}>
              Ctrl K
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <Box component="nav" aria-label="Admin" sx={{ flex: 1, overflowY: "auto", px: mini ? 1 : 1.25, pb: 2, pt: mini ? 1.5 : 0.5, "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.14)", borderRadius: 3 } }}>
        {shown.map((g) => (
          <Box key={g.label} sx={{ mt: mini ? 0.5 : 1.5 }}>
            {mini ? (
              <Box sx={{ mx: 1.5, my: 1, borderTop: `1px solid ${C.sideLine}` }} />
            ) : (
              <Typography sx={{ px: 1.25, mb: 0.5, fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sideMuted }}>
                {g.label}
              </Typography>
            )}
            {g.items.map((it) => {
              const active = isActive(it.href, pathname);
              const n = it.badgeKey ? counts[it.badgeKey] : 0;
              const Icon = it.icon;
              const row = (
                <Box
                  component={Link}
                  href={it.href}
                  onClick={() => {
                    setQ("");
                    onNavigate?.();
                  }}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    height: 38,
                    px: mini ? 0 : 1.25,
                    justifyContent: mini ? "center" : "flex-start",
                    my: 0.25,
                    borderRadius: 2,
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? C.white : C.sideText,
                    bgcolor: active ? C.sideActive : "transparent",
                    transition: "background-color 120ms ease, color 120ms ease",
                    "&:hover": { bgcolor: active ? C.sideActive : C.sideHover, color: C.white },
                    "&::before": active
                      ? { content: '""', position: "absolute", left: mini ? 2 : -10, top: 9, bottom: 9, width: 3, borderRadius: 3, bgcolor: C.gold }
                      : undefined,
                  }}
                >
                  <Icon sx={{ fontSize: 19, color: active ? C.goldBright : "inherit", flex: "none" }} />
                  {!mini && <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</Box>}
                  <Badge n={n} mini={mini} />
                </Box>
              );
              return mini ? (
                <Tooltip key={it.href} title={n ? `${it.label} (${n})` : it.label} placement="right">
                  {row}
                </Tooltip>
              ) : (
                <Box key={it.href}>{row}</Box>
              );
            })}
          </Box>
        ))}
        {shown.length === 0 && (
          <Typography sx={{ px: 1.25, py: 2, fontSize: "0.82rem", color: C.sideMuted }}>No page matches &ldquo;{q}&rdquo;.</Typography>
        )}
      </Box>

      {/* Collapse + user */}
      <Box sx={{ flex: "none", borderTop: `1px solid ${C.sideLine}`, p: 1.25 }}>
        {onToggleMini && (
          <Box
            component="button"
            type="button"
            onClick={onToggleMini}
            aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: mini ? "center" : "flex-start",
              gap: 1.25,
              height: 34,
              px: mini ? 0 : 1.25,
              mb: 0.75,
              borderRadius: 2,
              cursor: "pointer",
              fontSize: "0.8rem",
              color: C.sideMuted,
              "&:hover": { bgcolor: C.sideHover, color: C.white },
            }}
          >
            {mini ? <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 18 }} /> : <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 18 }} />}
            {!mini && "Collapse"}
          </Box>
        )}
        <Box
          component="button"
          type="button"
          onClick={(e: React.MouseEvent<HTMLElement>) => onOpenUserMenu(e.currentTarget)}
          sx={{
            all: "unset",
            boxSizing: "border-box",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: mini ? "center" : "flex-start",
            gap: 1.25,
            p: mini ? 0.5 : 1,
            borderRadius: 2,
            cursor: "pointer",
            "&:hover": { bgcolor: C.sideHover },
          }}
        >
          <Box sx={{ width: 34, height: 34, flex: "none", borderRadius: "50%", bgcolor: C.gold, color: C.ink, display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: 700 }}>
            {initials(displayName)}
          </Box>
          {!mini && (
            <>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: C.white, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: C.sideMuted, textTransform: "capitalize", lineHeight: 1.3 }}>{me?.role ?? "admin"}</Typography>
              </Box>
              <UnfoldMoreRoundedIcon sx={{ fontSize: 18, color: C.sideMuted }} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const signOut = useSignOut("admin");
  const me = useCurrentAdmin();
  const groups = useMemo(() => buildNav(), []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [userAnchorEl, setUserAnchorEl] = useState<HTMLElement | null>(null);
  const userMenuOpen = userAnchorEl !== null;
  const setUserMenuOpen = (open: boolean) => {
    if (!open) setUserAnchorEl(null);
  };
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Remember the collapsed sidebar per browser (a convenience only).
  useEffect(() => {
    try {
      if (window.localStorage.getItem("asn-admin-sidebar") === "mini") {
        const id = requestAnimationFrame(() => setMini(true));
        return () => cancelAnimationFrame(id);
      }
    } catch {
      /* storage blocked: default to expanded */
    }
  }, []);
  const toggleMini = () =>
    setMini((m) => {
      try {
        window.localStorage.setItem("asn-admin-sidebar", m ? "full" : "mini");
      } catch {
        /* ignore */
      }
      return !m;
    });

  // Ctrl/Cmd + K jumps to the page search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(max-width: 899px)").matches) setMobileOpen(true);
        else setMini(false);
        setTimeout(() => searchRef.current?.focus(), 60);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [counts, setCounts] = useState<QueueCounts>({
    pendingMembers: 0,
    vendorsPending: 0,
    offersPending: 0,
    catalogPending: 0,
    resourcesPending: 0,
    expertsPending: 0,
  });

  const loadCounts = useCallback(async () => {
    try {
      const [overviewRes, resourcesRes] = await Promise.all([
        fetch("/api/admin/overview", { cache: "no-store" }),
        fetch("/api/admin/resources", { cache: "no-store" }),
      ]);
      const overview = overviewRes.ok
        ? ((await overviewRes.json()) as {
            vendors?: { pending?: number };
            members?: { pending?: number };
            offers?: { pending?: number };
            catalog?: { pending?: number };
            experts?: { pending?: number };
          })
        : {};
      const resources = resourcesRes.ok ? ((await resourcesRes.json()) as { kits?: { submissionStatus: string }[] }) : {};
      setCounts({
        pendingMembers: overview.members?.pending ?? 0,
        vendorsPending: overview.vendors?.pending ?? 0,
        offersPending: overview.offers?.pending ?? 0,
        catalogPending: overview.catalog?.pending ?? 0,
        resourcesPending: (resources.kits ?? []).filter((k) => k.submissionStatus === "pending_review").length,
        expertsPending: overview.experts?.pending ?? 0,
      });
    } catch {
      /* counts are decorative */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void loadCounts(), 0);
    const t = setInterval(() => void loadCounts(), 90_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [loadCounts]);

  // Current page for the top bar.
  let current: { group: string; item: NavItem } | null = null;
  for (const g of groups) for (const it of g.items) if (!current && isActive(it.href, pathname)) current = { group: g.label, item: it };

  // The first non-empty review queue, for the top-bar shortcut.
  const queue = (() => {
    const order: { key: keyof QueueCounts; href: string }[] = [
      { key: "expertsPending", href: "/admin/experts" },
      { key: "vendorsPending", href: "/admin/vendors" },
      { key: "offersPending", href: "/admin/offers" },
      { key: "catalogPending", href: "/admin/content" },
      { key: "resourcesPending", href: "/admin/resources" },
      { key: "pendingMembers", href: "/admin/pending-members" },
    ];
    const total = order.reduce((n, o) => n + counts[o.key], 0);
    const first = order.find((o) => counts[o.key] > 0);
    return { total, href: first?.href ?? "/admin" };
  })();

  const displayName = me?.full_name ?? "Admin";
  const sideW = mini ? SIDE_W_MINI : SIDE_W;

  const sidebarProps = {
    groups,
    counts,
    pathname,
    me,
    onOpenUserMenu: (el: HTMLElement) => setUserAnchorEl(el),
    searchRef,
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: C.canvas, "--font-display": "var(--font-body)" } as object}>
      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          position: "fixed",
          inset: "0 auto 0 0",
          width: sideW,
          zIndex: 1200,
          transition: "width 180ms ease",
          boxShadow: "1px 0 0 rgba(0,0,0,0.04)",
        }}
      >
        <Sidebar {...sidebarProps} mini={mini} onToggleMini={toggleMini} />
      </Box>

      {/* Mobile drawer */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { md: "none" } }}
        slotProps={{ paper: { sx: { width: 280, border: 0 } } }}
      >
        <Sidebar {...sidebarProps} mini={false} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      {/* Main column */}
      <Box sx={{ ml: { xs: 0, md: `${sideW}px` }, transition: "margin-left 180ms ease", minWidth: 0 }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            height: TOP_H,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: { xs: 1.5, md: 3 },
            bgcolor: "rgba(255,255,255,0.92)",
            backdropFilter: "saturate(180%) blur(10px)",
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" }, color: C.ink }} aria-label="Open menu">
            <MenuRoundedIcon />
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
            {current && current.group !== "Overview" && (
              <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.85rem", color: C.muted, whiteSpace: "nowrap" }}>
                {current.group}
                <Box component="span" sx={{ mx: 1, color: "#B8B2A6" }}>
                  /
                </Box>
              </Typography>
            )}
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current?.item.label ?? "Admin"}
            </Typography>
          </Box>

          {queue.total > 0 && (
            <Box
              component={Link}
              href={queue.href}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                alignItems: "center",
                gap: 0.75,
                height: 32,
                px: 1.5,
                borderRadius: 999,
                bgcolor: "rgba(217,168,75,0.16)",
                color: "#7A5A14",
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { bgcolor: "rgba(217,168,75,0.26)" },
              }}
            >
              <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: C.gold }} />
              {queue.total} to review
            </Box>
          )}
          <NotificationsBell audience="admin" tone="light" />
          <Tooltip title="Open the public site">
            <IconButton component="a" href="/" target="_blank" rel="noopener noreferrer" sx={{ color: C.muted }} aria-label="Open the public site">
              <OpenInNewRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Page content. Page titles (each page's single h1/h2) are sized
            here for a work tool; the display serif becomes the body sans. */}
        <Box
          component="main"
          sx={{
            maxWidth: 1440,
            mx: "auto",
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2.5, md: 3.5 },
            "& h1, & h2": {
              fontFamily: "var(--font-body)",
              fontSize: { xs: "1.45rem", md: "1.75rem" },
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            },
            "& h1 em, & h2 em": { fontStyle: "normal", color: "inherit" },
            // Compact, consistent controls across every admin page.
            "& .MuiButton-root": { fontSize: "0.85rem", fontWeight: 600, borderRadius: "10px", minHeight: 38, py: 0.75, px: 2, boxShadow: "none", textTransform: "none" },
            "& .MuiButton-sizeSmall": { minHeight: 32, fontSize: "0.8rem", px: 1.5 },
            "& .MuiTabs-root": { minHeight: 44 },
            "& .MuiTab-root": { minHeight: 44, fontSize: "0.88rem", textTransform: "none", px: 1.75 },
            "& .MuiTableCell-root": { fontSize: "0.875rem" },
            "& .MuiTableCell-head": { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted },
          }}
        >
          {children}
        </Box>
        <Box sx={{ px: { xs: 2, md: 4 }, pb: 3, fontSize: "0.75rem", color: "#9AA1A8", maxWidth: 1440, mx: "auto" }}>
          © 2026 Aesthetic Success Network · Admin console
        </Box>
      </Box>

      {/* Account menu */}
      <Menu
        open={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
        anchorEl={userAnchorEl}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { ml: 1, minWidth: 260, borderRadius: 2 } } }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1.25 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.2, color: C.ink }}>{displayName}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: C.muted }}>{me?.email ?? ""}</Typography>
          <Typography sx={{ mt: 0.5, fontSize: "0.72rem", color: C.muted, textTransform: "capitalize" }}>Role: {me?.role ?? "admin"}</Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserMenuOpen(false);
            router.push("/dashboard");
          }}
        >
          <ListItemIcon>
            <PeopleAltOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View as member" slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 500 } } }} />
        </MenuItem>
        <MenuItem component="a" href="/" target="_blank" rel="noopener noreferrer" onClick={() => setUserMenuOpen(false)}>
          <ListItemIcon>
            <OpenInNewRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Open public site" slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 500 } } }} />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserMenuOpen(false);
            signOut();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sign out" slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }} />
        </MenuItem>
      </Menu>
    </Box>
  );
}
