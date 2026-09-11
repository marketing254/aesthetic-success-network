"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { SectionCard, StatusChip, formatDate } from "@/components/portal/ui";

type Invoice = {
  id: string;
  createdAt: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export type BillingSectionProps = {
  role: "member" | "expert" | "partner";
  planLabel: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  hasCustomer: boolean;
  hasSubscription: boolean;
  portalEndpoint: string;
  syncEndpoint: string;
  invoicesEndpoint: string;
};

/** Current-plan / payment-method / invoices card for a member, expert, or partner who already has a subscription. */
export function BillingSection(props: BillingSectionProps) {
  const [busy, setBusy] = useState<"portal" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    if (!props.hasCustomer) return;
    fetch(props.invoicesEndpoint)
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices ?? []))
      .catch(() => setInvoices([]));
  }, [props.hasCustomer, props.invoicesEndpoint]);

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch(props.portalEndpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function resync() {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch(props.syncEndpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't sync from Stripe.");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  const needsManualSync = props.hasCustomer && (!props.hasSubscription || !props.cardBrand);

  return (
    <Stack spacing={2.5}>
      <SectionCard
        title="Current plan"
        action={
          <Button size="small" variant="outlined" onClick={openPortal} disabled={busy !== null}>
            Manage subscription
          </Button>
        }
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 700 }}>{props.planLabel}</Typography>
          {props.status && <StatusChip status={props.status} />}
          {props.cancelAtPeriodEnd && <StatusChip status="canceled" />}
        </Stack>
        {props.currentPeriodEnd && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {props.cancelAtPeriodEnd ? "Access ends" : "Renews"} {formatDate(props.currentPeriodEnd)}
          </Typography>
        )}
        {error && (
          <Typography variant="body2" sx={{ mt: 1.5, color: "error.main" }}>
            {error}
          </Typography>
        )}
      </SectionCard>

      {needsManualSync && (
        <SectionCard title="Sync from Stripe">
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            If you just paid and this page hasn&apos;t updated yet, re-sync your subscription from Stripe.
          </Typography>
          <Button size="small" variant="outlined" onClick={resync} disabled={busy !== null}>
            Re-sync from Stripe
          </Button>
        </SectionCard>
      )}

      <SectionCard title="Payment method">
        {props.cardBrand && props.cardLast4 ? (
          <Typography variant="body2">
            {props.cardBrand.toUpperCase()} ending in {props.cardLast4}
          </Typography>
        ) : (
          <Typography variant="body2">No card on file.</Typography>
        )}
        <Button size="small" variant="text" onClick={openPortal} disabled={busy !== null} sx={{ mt: 1, px: 0 }}>
          Update card
        </Button>
      </SectionCard>

      {props.hasCustomer && (
        <SectionCard title="Invoices">
          {invoices === null ? (
            <Typography variant="body2">Loading…</Typography>
          ) : invoices.length === 0 ? (
            <Typography variant="body2">No invoices yet.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{formatDate(inv.createdAt)}</TableCell>
                      <TableCell>
                        {(inv.amountPaid / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: inv.currency.toUpperCase(),
                        })}
                      </TableCell>
                      <TableCell>{inv.status ?? "—"}</TableCell>
                      <TableCell align="right">
                        {inv.pdfUrl && (
                          <Button size="small" component="a" href={inv.pdfUrl} target="_blank" rel="noreferrer">
                            PDF
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </SectionCard>
      )}
    </Stack>
  );
}
