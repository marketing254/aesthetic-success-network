"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  Button,
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
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useAlsoHasRole } from "@/lib/auth/useRoles";
import type { ExpertsRow } from "@/lib/supabase/types";
import { checkBillingAccess } from "@/lib/stripe";
import BillingGate from "@/components/shared/BillingGate";
import NotificationsBell from "@/components/shared/NotificationsBell";
import { CommunityAvatarButton, type CommunityNavItem } from "@/components/shared/CommunityPortalShell";
import TopNavPortalShell, { EP, topNavPillButtonSx } from "@/components/shared/TopNavPortalShell";

type CurrentExpert = Pick<
  ExpertsRow,
  | "id"
  | "email"
  | "full_name"
  | "display_name"
  | "specialty"
  | "status"
  | "headshot_url"
  | "months_in_program"
  | "subscription_status"
  | "stripe_subscription_id"
  | "billing_exempt"
>;

function useCurrentExpert(): { expert: CurrentExpert | null; loading: boolean } {
  const [expert, setExpert] = useState<CurrentExpert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("experts")
        .select(
          "id, email, full_name, display_name, specialty, status, headshot_url, months_in_program, subscription_status, stripe_subscription_id, billing_exempt",
        )
        .eq("email", email)
        .maybeSingle();
      if (!active) return;
      setExpert(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { expert, loading };
}

function initials(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  if (!t) return "EX";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// The seven sections as horizontal tabs. Order follows the creator
// workflow: Dashboard, Resources, Feed, AI helper, Inquiries, Billing, Profile.
const navItems: CommunityNavItem[] = [
  { href: "/expert", label: "Dashboard", icon: DashboardOutlinedIcon },
  { href: "/expert/resources", label: "Resources", icon: UploadFileOutlinedIcon },
  { href: "/expert/posts", label: "Feed", icon: ChatBubbleOutlineOutlinedIcon },
  { href: "/expert/chatbot", label: "AI helper", icon: SmartToyOutlinedIcon },
  { href: "/expert/inquiries", label: "Inquiries", icon: InsightsOutlinedIcon },
  { href: "/expert/billing", label: "Billing", icon: ReceiptLongOutlinedIcon },
  { href: "/expert/profile", label: "Profile", icon: ManageAccountsOutlinedIcon },
];

export default function ExpertAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const { expert } = useCurrentExpert();
  const alsoVendor = useAlsoHasRole("vendor");

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    try {
      await fetch("/api/expert/login", { method: "DELETE" });
    } catch {
      // ignore, best effort
    }
    router.push("/expert/login");
  };

  const displayName = expert?.display_name ?? expert?.full_name ?? "Expert";
  const isFounding = !!expert?.billing_exempt;
  // Billing-exempt experts (manual admin override) have no billing; hide the tab entirely.
  const items = isFounding ? navItems.filter((i) => i.href !== "/expert/billing") : navItems;

  const statusLabel = expert?.status === "active" ? "Active expert" : expert?.status ?? "";

  const topRight = (
    <>
      {alsoVendor && (
        <Button
          onClick={() => router.push("/vendor")}
          size="small"
          variant="outlined"
          startIcon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...(topNavPillButtonSx as object), display: { xs: "none", sm: "inline-flex" } }}
        >
          View as company
        </Button>
      )}
      <NotificationsBell audience="expert" tone="community" />
      <CommunityAvatarButton
        anchorRef={userMenuAnchor}
        onClick={() => setUserMenuOpen(true)}
        open={userMenuOpen}
        src={expert?.headshot_url}
        initials={initials(displayName)}
        name={displayName}
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
      slotProps={{ paper: { sx: { mt: 1, minWidth: 272 } } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, color: EP.ink }} noWrap>
            {displayName}
          </Typography>
          {isFounding && <WorkspacePremiumRoundedIcon sx={{ fontSize: 16, color: EP.gold }} titleAccess="Founding expert" />}
        </Stack>
        <Typography sx={{ fontSize: "0.75rem", color: EP.muted, mt: 0.25 }} noWrap>
          {expert?.email ?? ""}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.25, flexWrap: "wrap", gap: 0.5 }}>
          {statusLabel && (
            <Chip label={statusLabel} size="small" color={expert?.status === "active" ? "success" : "warning"} />
          )}
          {isFounding && <Chip label="Founding expert" size="small" color="secondary" sx={{ bgcolor: EP.goldTint, color: EP.goldText }} />}
          {expert?.specialty && <Chip label={expert.specialty} size="small" />}
        </Stack>
      </Box>
      <Divider />
      {alsoVendor && (
        <MenuItem
          onClick={() => {
            setUserMenuOpen(false);
            router.push("/vendor");
          }}
        >
          <ListItemIcon>
            <StorefrontOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View as company" secondary="Switch to your company portal" />
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          setUserMenuOpen(false);
          router.push("/expert/profile");
        }}
      >
        <ListItemIcon>
          <ManageAccountsOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Edit profile" />
      </MenuItem>
      <MenuItem component="a" href="/experts" target="_blank" rel="noopener" onClick={() => setUserMenuOpen(false)}>
        <ListItemIcon>
          <OpenInNewRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="View public experts page" />
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleSignOut} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "error.main" }}>
          <LogoutOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Sign out" slotProps={{ primary: { sx: { color: "error.main" } } }} />
      </MenuItem>
    </Menu>
  );

  // Billing gate. No-op while the founding waiver is active or the expert
  // has a healthy subscription. The billing page is always reachable so
  // the expert can fix the underlying issue.
  const access = expert
    ? checkBillingAccess({
        monthsInProgram: expert.months_in_program ?? 0,
        subscriptionStatus: expert.subscription_status ?? null,
        hasSubscription: !!expert.stripe_subscription_id,
        billingExempt: !!expert.billing_exempt,
        audience: "expert",
      })
    : { allowed: true as const };
  const onBillingPage = pathname.startsWith("/expert/billing");
  const content =
    !access.allowed && !onBillingPage ? (
      <BillingGate access={access} portalEndpoint="/api/expert/billing/portal" billingHref="/expert/billing" accent="green">
        {children}
      </BillingGate>
    ) : (
      children
    );

  return (
    <TopNavPortalShell
      portalName="Expert portal"
      homeHref="/expert"
      items={items}
      pathname={pathname}
      topRight={topRight}
      overlays={menu}
      supportEmail="experts@aestheticsuccessnetwork.com"
      supportPhone="(855) 567-5323"
    >
      {content}
    </TopNavPortalShell>
  );
}
