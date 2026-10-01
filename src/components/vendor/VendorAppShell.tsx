"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSignOut } from "@/lib/auth/identity";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import NotificationsBell from "@/components/shared/NotificationsBell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor } from "@/lib/supabase/vendorQueries";
import { useAlsoHasRole } from "@/lib/auth/useRoles";
import type { VendorsRow } from "@/lib/supabase/types";
import ProfileEditDialog from "@/components/shared/ProfileEditDialog";
import { checkBillingAccess } from "@/lib/stripe";
import BillingGate from "@/components/shared/BillingGate";
import CommunityPortalShell, {
  CP,
  CommunityAvatarButton,
  communityIconButtonSx,
  communityPillButtonSx,
  type CommunityNavGroup,
} from "@/components/shared/CommunityPortalShell";

function useCurrentVendorRow(): { vendor: VendorsRow | null; loading: boolean } {
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      setVendor(v);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { vendor, loading };
}

function initialsFromName(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "CO";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Routes stay /vendor/* (code identifiers unchanged); labels say "company".
// Grouped for the community sidebar: Workspace, Growth, Account.
const navGroups: CommunityNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/vendor", label: "Overview", icon: DashboardOutlinedIcon },
      { href: "/vendor/profile", label: "Company profile", icon: StoreOutlinedIcon },
      { href: "/vendor/catalog", label: "Catalog", icon: Inventory2OutlinedIcon },
      { href: "/vendor/offers", label: "Offers", icon: LocalOfferOutlinedIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/vendor/inquiries", label: "Inquiries", icon: ChatBubbleOutlineRoundedIcon },
      { href: "/vendor/analytics", label: "Analytics", icon: InsightsRoundedIcon },
      { href: "/vendor/redemptions", label: "Redemptions", icon: ReceiptLongOutlinedIcon },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/vendor/account", label: "Account & billing", icon: ManageAccountsOutlinedIcon },
      { href: "/vendor/agreement", label: "Agreement", icon: GavelOutlinedIcon },
    ],
  },
];

export default function VendorAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const signOut = useSignOut("vendor");
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Live vendor row. Used by the top bar and the user menu so they agree.
  const { vendor: currentVendor } = useCurrentVendorRow();
  const alsoExpert = useAlsoHasRole("expert");

  // Multi-company family for the "Your companies" switcher. Switching is a
  // fresh sign-in with THAT company's email (access = control of its inbox).
  const [companies, setCompanies] = useState<
    { id: string; name: string; contact_email: string; is_current: boolean; is_principal: boolean; status: string }[]
  >([]);
  const [companyMenuAnchor, setCompanyMenuAnchor] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!currentVendor) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/vendor/companies", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { companies?: typeof companies };
        if (active) setCompanies(body.companies ?? []);
      } catch {
        /* switcher simply stays hidden */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVendor?.id]);

  const displayName = currentVendor?.display_name ?? currentVendor?.company_name ?? "Company";
  const email = currentVendor?.contact_email ?? "";
  const initials = initialsFromName(displayName);
  const avatarUrl =
    avatarPreview ??
    ((currentVendor as { avatar_url?: string | null } | null)?.avatar_url ?? currentVendor?.logo_url ?? null);
  const isVerified = currentVendor?.verified === true;

  const handleSignOut = () => {
    setUserMenuOpen(false);
    signOut();
  };

  const goTo = (href: string) => {
    setUserMenuOpen(false);
    router.push(href);
  };

  const topRight = (
    <>
      {companies.length > 1 && (
        <>
          <Button
            onClick={(e) => setCompanyMenuAnchor(e.currentTarget)}
            size="small"
            variant="outlined"
            startIcon={<StoreOutlinedIcon sx={{ fontSize: 16 }} />}
            endIcon={<KeyboardArrowDownOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ ...communityPillButtonSx, display: { xs: "none", sm: "inline-flex" }, maxWidth: 220 }}
          >
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {companies.find((c) => c.is_current)?.name ?? "Your companies"}
            </Box>
          </Button>
          <Menu
            open={!!companyMenuAnchor}
            anchorEl={companyMenuAnchor}
            onClose={() => setCompanyMenuAnchor(null)}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 280 } } }}
          >
            <Box sx={{ px: 1.75, pt: 1, pb: 0.75 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: CP.muted }}>
                Your companies, one founding fee
              </Typography>
            </Box>
            {companies.map((c) => (
              <MenuItem
                key={c.id}
                selected={c.is_current}
                disabled={c.is_current}
                onClick={() => {
                  setCompanyMenuAnchor(null);
                  // Switching = fresh sign-in with that company's email. The
                  // OTP goes to that inbox, which is what authorizes access.
                  router.push(`/vendor/login?prefill=${encodeURIComponent(c.contact_email)}&switch=1`);
                }}
                sx={{ py: 0.9 }}
              >
                <ListItemText
                  primary={`${c.name}${c.is_principal ? " · billing" : ""}`}
                  secondary={c.is_current ? "Currently viewing" : `Sign in as ${c.contact_email}`}
                />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {alsoExpert && (
        <Button
          onClick={() => router.push("/expert")}
          size="small"
          variant="outlined"
          startIcon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...communityPillButtonSx, display: { xs: "none", sm: "inline-flex" } }}
        >
          View as expert
        </Button>
      )}
      <Tooltip title="Help: partners@aestheticsuccessnetwork.com">
        <IconButton
          component="a"
          href="mailto:partners@aestheticsuccessnetwork.com"
          aria-label="Help"
          sx={{ ...communityIconButtonSx, display: { xs: "none", sm: "inline-flex" } }}
        >
          <HelpOutlineOutlinedIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>
      <NotificationsBell audience="vendor" tone="community" />
      <CommunityAvatarButton
        anchorRef={userMenuAnchor}
        onClick={() => setUserMenuOpen(true)}
        open={userMenuOpen}
        src={avatarUrl}
        initials={initials}
        name={displayName}
      />
    </>
  );

  const userMenu = (
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
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, color: CP.ink }} noWrap>
            {displayName}
          </Typography>
          {isVerified && <VerifiedRoundedIcon sx={{ fontSize: 16, color: CP.gold }} titleAccess="Verified company" />}
        </Stack>
        <Typography sx={{ fontSize: "0.75rem", color: CP.muted, mt: 0.25 }} noWrap>
          {email}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.25, flexWrap: "wrap", gap: 0.5 }}>
          <Chip label={isVerified ? "Verified company" : "Pending review"} size="small" color={isVerified ? "success" : "warning"} />
          {currentVendor?.category && <Chip label={currentVendor.category} size="small" />}
        </Stack>
      </Box>
      <Divider />
      <MenuItem
        onClick={() => {
          setUserMenuOpen(false);
          setProfileOpen(true);
        }}
      >
        <ListItemIcon>
          <EditOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Edit name and avatar" />
      </MenuItem>
      {alsoExpert && (
        <MenuItem onClick={() => goTo("/expert")}>
          <ListItemIcon>
            <SchoolOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View as expert" secondary="Switch to your expert portal" />
        </MenuItem>
      )}
      <MenuItem onClick={() => goTo("/vendor/profile")}>
        <ListItemIcon>
          <StoreOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Company profile" />
      </MenuItem>
      <MenuItem onClick={() => goTo("/vendor/account")}>
        <ListItemIcon>
          <ManageAccountsOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Account & billing" />
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

  // Billing gate. Locks portal access while the company has no card on file
  // (companies pay from day 1) or no healthy subscription. /vendor/account stays reachable.
  // Covered companies (billing_parent_id set) inherit the principal's
  // subscription and never see the "add your card" wall.
  const access = currentVendor
    ? currentVendor.billing_parent_id
      ? { allowed: true as const }
      : checkBillingAccess({
          monthsInProgram: currentVendor.months_in_program ?? 0,
          subscriptionStatus: currentVendor.subscription_status ?? null,
          hasSubscription: !!currentVendor.stripe_subscription_id,
        })
    : { allowed: true as const };
  const onAccountPage = pathname.startsWith("/vendor/account");
  const content =
    !access.allowed && !onAccountPage ? (
      <BillingGate access={access} portalEndpoint="/api/vendor/billing/portal" billingHref="/vendor/account" accent="gold">
        {children}
      </BillingGate>
    ) : (
      children
    );

  return (
    <CommunityPortalShell
      portalName="Company portal"
      homeHref="/vendor"
      groups={navGroups}
      pathname={pathname}
      topRight={topRight}
      identity={{
        name: displayName,
        avatarUrl,
        initials,
        subline: email,
        status: isVerified
          ? { label: "Verified company", tone: "success" }
          : { label: "Pending review", tone: "warning" },
      }}
      onSignOut={handleSignOut}
      overlays={
        <>
          {userMenu}
          <ProfileEditDialog
            open={profileOpen}
            endpoint="/api/vendor/profile/avatar"
            nameField="displayName"
            initial={{
              avatarUrl,
              displayName: currentVendor?.display_name ?? currentVendor?.company_name ?? "",
            }}
            onClose={() => setProfileOpen(false)}
            onSaved={(next) => {
              if (next.avatarPreview) setAvatarPreview(next.avatarPreview);
            }}
          />
        </>
      }
      supportEmail="partners@aestheticsuccessnetwork.com"
      supportPhone="(855) 567-5323"
    >
      {content}
    </CommunityPortalShell>
  );
}
