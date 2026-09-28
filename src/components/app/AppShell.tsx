"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { jobBoardEnabled } from "@/lib/jobs/flag";
import { useSignOut } from "@/lib/auth/identity";
import { useCurrentMember } from "@/lib/hooks/useCurrentMember";
import { MemberAssistant } from "@/components/member/MemberAssistant";
import ProfileEditDialog from "@/components/shared/ProfileEditDialog";
import NotificationsBell from "@/components/shared/NotificationsBell";
import PortalChrome, {
  PORTAL,
  PortalAvatarButton,
  type PortalNavItem,
} from "@/components/shared/PortalChrome";

// The kit library and the Systems (SOP) section stay hidden until the ASN
// content exists. Flip NEXT_PUBLIC_LIBRARY_ENABLED=true to show both.
const libraryEnabled = process.env.NEXT_PUBLIC_LIBRARY_ENABLED === "true";

const navItems: PortalNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: DashboardOutlinedIcon },
  ...(libraryEnabled
    ? [
        { href: "/dashboard/resources", label: "Resource library", icon: LibraryBooksOutlinedIcon },
        { href: "/dashboard/systems", label: "Systems", icon: FactCheckOutlinedIcon },
      ]
    : []),
  { href: "/dashboard/experts", label: "Experts", icon: SchoolOutlinedIcon },
  { href: "/dashboard/partners", label: "Partners", icon: StorefrontOutlinedIcon },
  { href: "/dashboard/tools", label: "Tools", icon: CalculateOutlinedIcon },
  { href: "/dashboard/network", label: "Network", icon: HubOutlinedIcon },
  // Hidden until NEXT_PUBLIC_JOB_BOARD_ENABLED=true; the middleware 404s
  // the page as well, so members see nothing before launch.
  ...(jobBoardEnabled()
    ? [{ href: "/dashboard/jobs", label: "Jobs", icon: WorkOutlineRoundedIcon }]
    : []),
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxOutlinedIcon },
  { href: "/dashboard/account", label: "Profile", icon: PersonOutlineOutlinedIcon },
];

function initialsFromName(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "M";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const signOut = useSignOut("member");
  const { member } = useCurrentMember();
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const displayName = member
    ? `${member.first_name}${member.last_name ? " " + member.last_name : ""}`
    : "Member";
  const email = member?.email ?? "";
  const initials = initialsFromName(member?.first_name, member?.last_name);
  const effectiveAvatar = avatarPreview ?? (member as { avatar_url?: string | null } | null)?.avatar_url ?? null;

  const goTo = (href: string) => {
    setUserMenuOpen(false);
    router.push(href);
  };

  const handleSignOut = () => {
    setUserMenuOpen(false);
    signOut();
  };

  const topRight = (
    <>
      <NotificationsBell audience="member" tone="dark" />
      <PortalAvatarButton
        anchorRef={userMenuAnchor}
        onClick={() => setUserMenuOpen(true)}
        open={userMenuOpen}
        src={effectiveAvatar}
        initials={initials}
        name={displayName}
        subline={member?.tier === "founding" ? "Founding member" : "Member"}
        accent="member"
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
      slotProps={{ paper: { sx: { mt: 1, minWidth: 240 } } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25 }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.2, color: PORTAL.ink }} noWrap>
          {displayName}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: PORTAL.faint }} noWrap>
          {email}
        </Typography>
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
        <ListItemText primary="Edit name and photo" slotProps={{ primary: { sx: { fontSize: "0.88rem", fontWeight: 600 } } }} />
      </MenuItem>
      <MenuItem onClick={() => goTo("/dashboard/account")}>
        <ListItemIcon>
          <PersonOutlineOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Profile" slotProps={{ primary: { sx: { fontSize: "0.88rem", fontWeight: 600 } } }} />
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleSignOut} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "error.main" }}>
          <LogoutOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Sign out" slotProps={{ primary: { sx: { fontSize: "0.88rem", fontWeight: 600 } } }} />
      </MenuItem>
    </Menu>
  );

  return (
    <PortalChrome
      accent="member"
      portalName="Member portal"
      homeHref="/dashboard"
      groups={[{ items: navItems }]}
      pathname={pathname}
      topRight={topRight}
      overlays={
        <>
          {menu}
          {/* Profile edit dialog mounted at the shell root so it overlays
              all content cleanly. */}
          <ProfileEditDialog
            open={profileOpen}
            endpoint="/api/member/profile"
            nameField="memberName"
            initial={{
              avatarUrl: effectiveAvatar,
              firstName: member?.first_name ?? "",
              lastName: member?.last_name ?? "",
            }}
            onClose={() => setProfileOpen(false)}
            onSaved={(next) => {
              if (next.avatarPreview) setAvatarPreview(next.avatarPreview);
            }}
          />
          {/* Concierge bot, floats bottom-right on every member portal page */}
          <MemberAssistant />
        </>
      }
      drawerFooter={
        <Stack spacing={1.25}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 12,
              bgcolor: "rgba(217,168,75,0.10)",
              border: "1px solid rgba(217,168,75,0.3)",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EventAvailableOutlinedIcon sx={{ fontSize: 16, color: PORTAL.goldDeep }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: PORTAL.ink, lineHeight: 1.2 }}>
                  Live AMAs & CE
                </Typography>
                <Typography sx={{ fontSize: "0.66rem", color: PORTAL.faint }}>Monthly sessions</Typography>
              </Box>
              <Chip label="Soon" size="small" color="secondary" sx={{ height: 18, fontSize: "0.6rem" }} />
            </Stack>
          </Box>
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: PORTAL.goldDeep }}>
            Support
          </Typography>
          <Box component="a" href="tel:+18555675323" sx={{ fontSize: "0.82rem", fontWeight: 600, color: PORTAL.ink, textDecoration: "none" }}>
            Hotline (855) 567-5323
          </Box>
          <Box
            component="a"
            href="mailto:members@aestheticsuccessnetwork.com"
            sx={{ fontSize: "0.82rem", fontWeight: 600, color: PORTAL.ink, textDecoration: "none", wordBreak: "break-all" }}
          >
            members@aestheticsuccessnetwork.com
          </Box>
        </Stack>
      }
      footerLinks={[
        { href: "tel:+18555675323", label: "Hotline: (855) 567-5323" },
        { href: "mailto:members@aestheticsuccessnetwork.com", label: "members@aestheticsuccessnetwork.com" },
      ]}
    >
      {children}
    </PortalChrome>
  );
}
