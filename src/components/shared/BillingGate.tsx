"use client";

import { useState } from "react";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import type { BillingAccess } from "@/lib/stripe";

/**
 * Pure UI paywall. Shows children unchanged when billing access is
 * allowed; otherwise shows a paywall card instead of the page content.
 *
 * This is UX only — the real enforcement is the `requirePaid*()` API
 * guards. A determined user could still hit an API route directly;
 * that's what those guards are for.
 */
export function BillingGate({
  access,
  portalEndpoint,
  billingHref,
  children,
}: {
  access: BillingAccess;
  portalEndpoint: string;
  billingHref: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (access.allowed) return <>{children}</>;

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(portalEndpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 4, borderRadius: "20px", textAlign: "center" }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {access.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {access.message}
          </Typography>
          {error && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              {error}
            </Typography>
          )}
          <Box sx={{ pt: 1 }}>
            {access.reason === "subscription_required" ? (
              <Button variant="contained" size="large" href={billingHref}>
                {access.cta}
              </Button>
            ) : (
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                <Button variant="contained" size="large" onClick={openPortal} disabled={busy}>
                  Open Stripe portal
                </Button>
                <Button variant="outlined" size="large" href={billingHref}>
                  Go to billing page
                </Button>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
