"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Logo from "@/components/brand/Logo";

/**
 * The job seeker's own, small portal chrome.
 *
 * Deliberately NOT the member AppShell: a candidate is not a member, has
 * no access to member resources, and should never see a sidebar full of
 * things that lead to a $29 paywall. Three links, their email, sign out.
 */

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";
const CREAM = "#F7F5F0";

const NAV = [
  { href: "/seeker", label: "Overview", icon: DashboardOutlinedIcon },
  { href: "/seeker/applications", label: "My applications", icon: DescriptionOutlinedIcon },
  { href: "/jobs", label: "Browse jobs", icon: WorkOutlineRoundedIcon },
];

export default function SeekerShell({ email, children }: { email?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/seeker/login", { method: "DELETE" });
    router.push("/jobs");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: CREAM }}>
      <Box component="header" sx={{ bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between", py: 1.25 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Logo variant="sigil" height={40} href="/jobs" ariaLabel="ASN job board" />
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.18em", color: GOLD, textTransform: "uppercase", lineHeight: 1 }}>
                  Job seeker
                </Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}>ASN job board</Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              {NAV.map((item) => {
                const active = item.href === "/seeker" ? pathname === "/seeker" : pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    size="small"
                    startIcon={<Icon sx={{ fontSize: 18 }} />}
                    sx={{
                      color: active ? INK : INK_MUTED,
                      fontWeight: active ? 700 : 500,
                      bgcolor: active ? "#F3EFE6" : "transparent",
                      textTransform: "none",
                      px: 1.25,
                      "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } },
                      "&:hover": { bgcolor: "#F3EFE6" },
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{item.label}</Box>
                  </Button>
                );
              })}
              <Button
                size="small"
                onClick={signOut}
                startIcon={<LogoutRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{ color: INK_MUTED, textTransform: "none", px: 1.25, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Sign out</Box>
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        {email ? (
          <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED, mb: 2 }}>Signed in as {email}</Typography>
        ) : null}
        {children}
      </Container>

      <Box component="footer" sx={{ py: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED }}>
          Aesthetic Success Network job board · Applying is free · Practices reply to you directly
        </Typography>
      </Box>
    </Box>
  );
}
