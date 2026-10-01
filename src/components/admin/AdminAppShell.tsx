"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSignOut } from "@/lib/auth/identity";
import {
  Box,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
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
import { jobBoardEnabled } from "@/lib/jobs/flag";
import NotificationsBell from "@/components/shared/NotificationsBell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import PortalChrome, {
  PORTAL,
  PortalAvatarButton,
  type PortalNavGroup,
} from "@/components/shared/PortalChrome";

type CurrentAdmin = {
  email: string;
  full_name: string;
  role: string;
};

type QueueCounts = {
  pendingMembers: number;
  vendorsPending: number;
  offersPending: number;
  catalogPending: number;
  resourcesPending: number;
  expertsPending: number;
};

function useCurrentAdmin(): CurrentAdmin | null {
  const [me, setMe] = useState<CurrentAdmin | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) return;
      const { data } = await supabase
        .from("admin_users")
        .select("email, full_name, role")
        .eq("email", email)
        .maybeSingle();
      if (!active) return;
      setMe(
        data ?? {
          email,
          full_name: email.split("@")[0] ?? "Admin",
          role: "admin",
        },
      );
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
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD"
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType<{ sx?: object }>;
  badgeKey?: keyof QueueCounts;
};

// Console navigation in five groups. The desktop tab row flattens them;
// the mobile drawer shows the group labels.
const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "People",
    items: [
      { href: "/admin", label: "Dashboard", icon: DashboardOutlinedIcon },
      { href: "/admin/members", label: "Members", icon: PeopleAltOutlinedIcon },
      { href: "/admin/pending-members", label: "Pending members", icon: HourglassEmptyOutlinedIcon, badgeKey: "pendingMembers" },
      { href: "/admin/experts", label: "Experts", icon: SchoolOutlinedIcon, badgeKey: "expertsPending" },
      // URL stays /admin/vendors so routes, /api/admin/vendors and the
      // vendors DB table do not move. The label is "Companies".
      { href: "/admin/vendors", label: "Companies", icon: StoreOutlinedIcon, badgeKey: "vendorsPending" },
      { href: "/admin/founding", label: "Founding invites", icon: WorkspacePremiumOutlinedIcon },
      { href: "/admin/invites", label: "Invite links", icon: LinkOutlinedIcon },
      { href: "/admin/admins", label: "Admin team", icon: AdminPanelSettingsOutlinedIcon },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/resources", label: "Resources", icon: LibraryBooksOutlinedIcon, badgeKey: "resourcesPending" },
      { href: "/admin/content", label: "Catalog", icon: Inventory2OutlinedIcon, badgeKey: "catalogPending" },
      { href: "/admin/offers", label: "Company offers", icon: LocalOfferOutlinedIcon, badgeKey: "offersPending" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/admin/inquiries", label: "Inquiries", icon: ChatBubbleOutlineOutlinedIcon },
      { href: "/admin/feedback", label: "Kit feedback", icon: StarOutlineRoundedIcon },
      { href: "/admin/spotlights", label: "Spotlights", icon: AutoAwesomeOutlinedIcon },
      { href: "/admin/broadcast", label: "Broadcast", icon: CampaignOutlinedIcon },
      { href: "/admin/hotline", label: "Hotline triage", icon: SupportAgentOutlinedIcon },
      // Job board: hidden until NEXT_PUBLIC_JOB_BOARD_ENABLED=true (the
      // middleware 404s the pages too, so the link is only cosmetic).
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
      { href: "/admin/promo-codes", label: "Promo codes", icon: ConfirmationNumberOutlinedIcon },
      { href: "/admin/lead-magnets", label: "Lead magnets", icon: DownloadOutlinedIcon },
      { href: "/admin/summit", label: "Summit registrations", icon: EventAvailableOutlinedIcon },
      { href: "/admin/waitlist", label: "Launch waitlist", icon: MarkEmailReadOutlinedIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/stripe-status", label: "Stripe status", icon: CreditCardOutlinedIcon },
      { href: "/admin/email-previews", label: "Email drafts", icon: MarkEmailUnreadOutlinedIcon },
      { href: "/admin/audit-log", label: "Audit log", icon: HistoryOutlinedIcon },
    ],
  },
];

export default function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  // Admin sessions must land back on the admin login, not the member one.
  const signOut = useSignOut("admin");
  const me = useCurrentAdmin();

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
      const resources = resourcesRes.ok
        ? ((await resourcesRes.json()) as {
            kits?: { submissionStatus: string }[];
          })
        : {};
      setCounts({
        pendingMembers: overview.members?.pending ?? 0,
        vendorsPending: overview.vendors?.pending ?? 0,
        offersPending: overview.offers?.pending ?? 0,
        catalogPending: overview.catalog?.pending ?? 0,
        resourcesPending:
          (resources.kits ?? []).filter((k) => k.submissionStatus === "pending_review").length,
        expertsPending: overview.experts?.pending ?? 0,
      });
    } catch {
      // ignore, counts are decorative
    }
  }, []);

  useEffect(() => {
    void loadCounts();
    const t = setInterval(() => void loadCounts(), 90_000);
    return () => clearInterval(t);
  }, [loadCounts]);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    signOut();
  };

  const groups: PortalNavGroup[] = navSections.map((sec) => ({
    label: sec.label,
    items: sec.items.map((it) => ({
      href: it.href,
      label: it.label,
      icon: it.icon,
      badge: it.badgeKey ? counts[it.badgeKey] : undefined,
    })),
  }));

  const queuesOpen =
    counts.expertsPending + counts.vendorsPending + counts.offersPending + counts.catalogPending + counts.pendingMembers + counts.resourcesPending;

  const displayName = me?.full_name ?? "Admin";

  const topRight = (
    <>
      <Chip
        label="Admin mode"
        size="small"
        sx={{
          display: { xs: "none", sm: "inline-flex" },
          height: 22,
          fontSize: "0.64rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          bgcolor: "rgba(224,90,90,0.18)",
          color: "#FFD6D6",
          border: "1px solid rgba(224,90,90,0.4)",
        }}
      />
      {queuesOpen > 0 && (
        <Chip
          label={`${queuesOpen} in queue`}
          size="small"
          sx={{
            display: { xs: "none", md: "inline-flex" },
            height: 22,
            fontSize: "0.66rem",
            fontWeight: 700,
            bgcolor: "rgba(217,168,75,0.22)",
            color: PORTAL.goldBright,
            border: "1px solid rgba(217,168,75,0.4)",
          }}
        />
      )}
      <NotificationsBell audience="admin" tone="dark" />
      <PortalAvatarButton
        anchorRef={userMenuAnchor}
        onClick={() => setUserMenuOpen(true)}
        open={userMenuOpen}
        initials={initials(displayName)}
        name={displayName}
        subline={me?.role ? `Admin · ${me.role}` : "Admin"}
        accent="admin"
      />
    </>
  );

  const menu = (
    <Menu
      open={userMenuOpen}
      onClose={() => setUserMenuOpen(false)}
      anchorEl={userMenuAnchor.current}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { mt: 1, minWidth: 280 } } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.2, color: PORTAL.ink }}>
          {displayName}
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", color: PORTAL.faint }}>{me?.email ?? ""}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: "0.7rem", color: PORTAL.faint, textTransform: "capitalize" }}>
          Role: {me?.role ?? "admin"}
        </Typography>
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
        <ListItemText primary="View as member" slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }} />
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleSignOut} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "error.main" }}>
          <LogoutOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Sign out" slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }} />
      </MenuItem>
    </Menu>
  );

  return (
    <PortalChrome
      accent="admin"
      portalName="Admin console"
      homeHref="/admin"
      groups={groups}
      pathname={pathname}
      topRight={topRight}
      overlays={menu}
      footerLine="© 2026 Aesthetic Success Network · Powered by Business of Aesthetics · Admin console"
      drawerFooter={
        <Stack spacing={0.75}>
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: PORTAL.goldDeep }}>
            Queues open
          </Typography>
          <Stack direction="row" spacing={2}>
            {[
              { value: counts.expertsPending, label: "Experts" },
              { value: counts.vendorsPending, label: "Companies" },
              { value: counts.offersPending, label: "Offers" },
              { value: counts.catalogPending, label: "Catalog" },
            ].map((s) => (
              <Box key={s.label}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", lineHeight: 1, color: PORTAL.ink }}>
                  {s.value}
                </Typography>
                <Typography sx={{ fontSize: "0.62rem", color: PORTAL.faint, mt: 0.35 }}>{s.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      }
    >
      {children}
    </PortalChrome>
  );
}
