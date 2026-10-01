"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import type { BillingAccess } from "@/lib/stripe";

/**
 * BillingGate
 *
 * Drops in at the top of a portal layout. If `access.allowed === false`,
 * it renders a paywall card explaining why the portal is locked and gives
 * the user the two escape routes:
 *
 *   1. Open the Stripe Customer Portal (update card / reactivate).
 *      Wired per-role: `portalEndpoint` is /api/expert/billing/portal
 *      or /api/vendor/billing/portal.
 *
 *   2. Click through to the in-app billing page so they can re-sync
 *      from Stripe if the webhook missed them.
 *
 * Children render normally when `access.allowed === true`, so this is
 * cheap to wrap every page with.
 *
 * The gate is UI-only. The auth guards on each API route are the real
 * enforcement layer. Even if a client bypasses this wall, every write
 * still 402s on the server.
 *
 * `accent` only decides which support inbox is shown ("gold" = companies,
 * "green" = experts); the card itself uses the community palette.
 */

const NAVY = "#0A1320";
const NAVY_HOVER = "#141F30";
const INK = "#0A1320";
const BODY = "#3B4451";
const MUTED = "#6B7280";
const LINE = "rgba(10,19,32,0.06)";
const LINE_STRONG = "rgba(10,19,32,0.14)";
const SAND = "#F3EBDD";
const SAND_SOFT = "#F8F4EC";
const GOLD_DEEP = "#B8862F";
const SHADOW = "0 1px 2px rgba(10,19,32,0.04), 0 8px 24px -16px rgba(10,19,32,0.12)";

export default function BillingGate({
  access,
  portalEndpoint,
  billingHref,
  accent,
  children,
}: {
  access: BillingAccess;
  portalEndpoint: string;
  billingHref: string;
  accent: "gold" | "green";
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (access.allowed) return <>{children}</>;

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(portalEndpoint, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not open the Stripe portal. Try the billing page instead.");
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the Stripe portal.");
    } finally {
      setBusy(false);
    }
  };

  const primarySx = {
    borderRadius: "10px",
    minHeight: 40,
    bgcolor: NAVY,
    color: "#FFFFFF",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.875rem",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
    backgroundImage: "none",
    "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)", transform: "translateY(-1px)" },
  } as const;

  const secondarySx = {
    borderRadius: "10px",
    minHeight: 40,
    borderColor: LINE_STRONG,
    color: INK,
    bgcolor: "#FFFFFF",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.875rem",
    "&:hover": { bgcolor: SAND_SOFT, borderColor: LINE_STRONG, transform: "translateY(-1px)" },
  } as const;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Box
        sx={{
          borderRadius: "16px",
          bgcolor: "#FFFFFF",
          border: `1px solid ${LINE}`,
          boxShadow: SHADOW,
          p: { xs: 3, sm: 4 },
        }}
      >
        <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", mb: 2.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              bgcolor: SAND,
              color: GOLD_DEEP,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: MUTED }}>Portal locked</Typography>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.3 }}>
              {access.title}
            </Typography>
          </Box>
        </Stack>

        <Typography sx={{ color: BODY, fontSize: "0.9375rem", lineHeight: 1.6, mb: 3 }}>{access.message}</Typography>
        <Stack spacing={1.25}>
          {/* New signups (reason=subscription_required) don't have a
              Stripe customer yet, so the "Open Stripe portal" button
              would just 404. In that case the primary CTA is an
              in-app link straight to the billing page where the
              TrialStartCard lives. */}
          {access.reason === "subscription_required" ? (
            <Button
              component={Link}
              href={billingHref}
              fullWidth
              variant="contained"
              disableElevation
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
              sx={primarySx}
            >
              {access.cta}
            </Button>
          ) : (
            <>
              <Button
                onClick={openPortal}
                disabled={busy}
                fullWidth
                variant="contained"
                disableElevation
                startIcon={
                  busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                }
                sx={primarySx}
              >
                {busy ? "Opening Stripe..." : access.cta}
              </Button>
              <Button component={Link} href={billingHref} fullWidth variant="outlined" sx={secondarySx}>
                Go to billing page
              </Button>
            </>
          )}
        </Stack>
        {error && (
          <Typography sx={{ mt: 1.5, fontSize: "0.8125rem", color: "#991B1B" }}>{error}</Typography>
        )}
        <Typography sx={{ mt: 2.5, fontSize: "0.8125rem", color: MUTED, lineHeight: 1.55 }}>
          Need help? Email {accent === "gold" ? "partners@aestheticsuccessnetwork.com" : "experts@aestheticsuccessnetwork.com"} and we can
          re-sync your subscription manually if the webhook missed your last payment.
        </Typography>
      </Box>
    </Container>
  );
}
