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
 * it renders a plain paywall card explaining why the portal is locked and
 * gives the user the two escape routes:
 *
 *   1. Open the Stripe Customer Portal — update card / reactivate.
 *      Wired per-role: `portalEndpoint` is /api/expert/billing/portal
 *      or /api/vendor/billing/portal.
 *
 *   2. Click through to the in-app billing page so they can re-sync
 *      from Stripe if the webhook missed them.
 *
 * Children render normally when `access.allowed === true`, so this is
 * cheap to wrap every page with.
 *
 * The gate is UI-only — the auth guards on each API route are the real
 * enforcement layer. Even if a client bypasses this wall, every write
 * still 402s on the server.
 *
 * `accent` only decides which support inbox is shown ("gold" = companies,
 * "green" = experts); the card itself is neutral.
 */

const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

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
    borderRadius: "6px",
    minHeight: 36,
    bgcolor: NAVY,
    color: "#FFFFFF",
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.875rem",
    boxShadow: "none",
    backgroundImage: "none",
    "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "none", transform: "none" },
  } as const;

  const secondarySx = {
    borderRadius: "6px",
    minHeight: 36,
    borderColor: "#D1D5DB",
    color: INK,
    bgcolor: "#FFFFFF",
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.875rem",
    "&:hover": { bgcolor: "#F9FAFB", borderColor: "#D1D5DB", transform: "none" },
  } as const;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Box
        sx={{
          borderRadius: "8px",
          bgcolor: "#FFFFFF",
          border: `1px solid ${LINE}`,
          p: 3,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "6px",
              bgcolor: "#F3F4F6",
              color: BODY,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>Portal locked</Typography>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}>
              {access.title}
            </Typography>
          </Box>
        </Stack>

        <Typography sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6, mb: 2.5 }}>{access.message}</Typography>
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
        <Typography sx={{ mt: 2, fontSize: "0.8125rem", color: MUTED, lineHeight: 1.55 }}>
          Need help? Email {accent === "gold" ? "partners@aestheticsuccessnetwork.com" : "experts@aestheticsuccessnetwork.com"} and we can
          re-sync your subscription manually if the webhook missed your last payment.
        </Typography>
      </Box>
    </Container>
  );
}
