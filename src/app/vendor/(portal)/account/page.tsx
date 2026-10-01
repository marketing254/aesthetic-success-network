"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import { ListDivider, PageHeader, SectionCard, StatCard, TagPill, listHeadSx, listRowSx, portalText } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor } from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";
import TrialStartCard from "@/components/shared/TrialStartCard";
import { currentRampRow, normalizeVendorPlan, vendorRamp } from "@/lib/vendorPricing";

const INK = CP.ink;
const MUTED = CP.muted;

type Invoice = {
  id: string;
  number: string | null;
  createdAt: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string | null;
  description: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

// Price terms live in src/lib/vendorPricing.ts, keyed by vendors.billing_plan:
// free founding months (6 from the member launch), then $39 (standard) or
// $149 (large) a month with no increase.

export default function VendorAccountPage() {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

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

  // Pull invoices from Stripe as soon as we know there's a customer.
  useEffect(() => {
    if (!vendor?.stripe_customer_id) {
      // No Stripe customer yet (card not added): render the empty state.
      setInvoices([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/vendor/billing/invoices", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          if (active) setInvoices([]);
          return;
        }
        const body = (await res.json()) as { invoices: Invoice[] };
        if (active) setInvoices(body.invoices ?? []);
      } catch {
        if (active) setInvoices([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [vendor?.stripe_customer_id]);

  const openPortal = async () => {
    setPortalBusy(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/vendor/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setPortalError(body.error ?? `Could not open portal (${res.status})`);
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Could not open portal.");
    } finally {
      setPortalBusy(false);
    }
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading account...</Typography>
      </Stack>
    );
  }

  if (!vendor) {
    return (
      <SectionCard padding="default">
        <Typography sx={portalText.sectionTitle}>No company profile found.</Typography>
      </SectionCard>
    );
  }

  const plan = normalizeVendorPlan(vendor.billing_plan);
  const hasTrial = vendor.subscription_status === "trialing";
  const freeUntil = hasTrial ? vendor.current_period_end : null;
  const ramp = vendorRamp(plan, freeUntil);
  const isWebsite = !vendor.founding_partner_locked;
  const months = vendor.months_in_program ?? 0;
  const currentRow = currentRampRow(plan, hasTrial, freeUntil);
  const nextBill = ramp.monthlyNow(hasTrial);
  const freeUntilLabel = freeUntil
    ? new Date(freeUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const lifetimeBilled = (invoices ?? []).reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Account and billing"
        subtitle={`${ramp.summary}. Manage your payment method and download past invoices.`}
      />

      {/* Stat tiles */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard icon={WorkspacePremiumOutlinedIcon} accent="gold" label="Current plan" value={ramp.label} footer={<Box>{ramp.summary}</Box>} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={EventOutlinedIcon}
            accent="navy"
            label="Next billing"
            value={nextBill}
            footer={`${currentRow.label} at ${currentRow.price} a month`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard icon={TimelineOutlinedIcon} accent="gold" label="Months in program" value={`${months}`} footer={hasTrial ? "Free founding months" : "Paying member"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={ReceiptLongOutlinedIcon}
            accent="green"
            label="Lifetime billed"
            value={`$${lifetimeBilled.toFixed(2)}`}
            footer={`${ramp.rate} a month after your free months, no increase`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Subscription detail */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Subscription"
            subtitle="Free founding months, then your flat rate for as long as you stay."
            padding="default"
            action={
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <TagPill label={isWebsite ? "WEBSITE" : "FOUNDING"} tone={isWebsite ? "neutral" : "gold"} size="sm" />
                <TagPill label="MONTH-TO-MONTH" tone="neutral" size="sm" />
              </Stack>
            }
          >
            <Stack spacing={2.5}>
              <Box sx={{ p: 2, borderRadius: "12px", bgcolor: CP.sand }}>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK }}>
                  {hasTrial
                    ? freeUntilLabel
                      ? `Free until ${freeUntilLabel}, then ${ramp.rate} a month with no increase`
                      : `Free founding months, then ${ramp.rate} a month with no increase`
                    : `${ramp.rate} a month, no increase`}
                </Typography>
                <Typography sx={{ ...portalText.meta, mt: 0.5 }}>
                  {hasTrial
                    ? "Nothing is charged until your free months end. We remind you 7 days before your first charge; cancel before then and you won't be charged."
                    : "Cancel with 30 days' written notice."}
                </Typography>
              </Box>

              <Divider />

              {/* Pricing ladder */}
              <Stack spacing={1}>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK }}>
                  Your terms
                </Typography>
                {ramp.rows.map((row) => (
                  <LadderRow
                    key={row.label}
                    period={row.label}
                    price={`${row.price}/mo`}
                    note={row.note}
                    current={row.label === currentRow.label}
                  />
                ))}
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        {/* Payment method */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            <SectionCard
              title="Payment method"
              padding="default"
              action={
                vendor.card_brand && vendor.card_last4 ? (
                  <TagPill label="ON FILE" tone="green" size="sm" />
                ) : (
                  <TagPill label="WAIVED" tone="neutral" size="sm" />
                )
              }
            >
              {vendor.card_brand && vendor.card_last4 ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: CP.sand, color: CP.goldDeep, display: "grid", placeItems: "center" }}>
                      <CreditCardOutlinedIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK }}>
                        {capitaliseFirst(vendor.card_brand)} ending {vendor.card_last4}
                      </Typography>
                      <Typography sx={portalText.meta}>Default for future charges</Typography>
                    </Box>
                  </Stack>
                  <Button
                    onClick={openPortal}
                    disabled={portalBusy}
                    size="small"
                    variant="outlined"
                    startIcon={
                      portalBusy ? (
                        <CircularProgress size={12} sx={{ color: "inherit" }} />
                      ) : (
                        <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                      )
                    }
                  >
                    Update
                  </Button>
                </Stack>
              ) : (
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK, mb: 0.5 }}>
                    No payment method required yet
                  </Typography>
                  <Typography sx={portalText.body}>
                    {!vendor.stripe_subscription_id ? (
                      <>
                        Save a card below to activate your listing. Nothing is charged until your free founding months end; after that it&apos;s{" "}
                        <Box component="strong" sx={{ color: INK, fontWeight: 700 }}>{ramp.rate} a month</Box> with no increase.
                      </>
                    ) : (
                      <>Your card is on file with Stripe. Open the Stripe portal to update it.</>
                    )}{" "}
                    Billing email is {vendor.billing_email ?? vendor.contact_email}.
                  </Typography>
                </Box>
              )}
              {portalError && (
                <Typography sx={{ fontSize: "0.8125rem", color: CP.errorFg, mt: 1 }}>
                  {portalError}
                </Typography>
              )}
            </SectionCard>

            <SectionCard title="Cancellation" padding="default">
              <Typography sx={portalText.body}>
                Cancel any time before your first charge and you won&apos;t be charged. After that, cancel with{" "}
                <Box component="strong" sx={{ color: INK, fontWeight: 700 }}>30 days&apos; written notice</Box> through this portal.
                You remain responsible for fees accrued through the effective date of termination.
              </Typography>
              <Button
                onClick={openPortal}
                disabled={portalBusy || !vendor.stripe_customer_id}
                size="small"
                variant="text"
                color="error"
                sx={{ mt: 1.5, px: 0, "&:hover": { bgcolor: "transparent", textDecoration: "underline" } }}
              >
                {vendor.stripe_customer_id ? "Open Stripe portal to cancel" : "Available once subscription is active"}
              </Button>
            </SectionCard>

          </Stack>
        </Grid>
      </Grid>

      {/* Sign-and-pay card: shown when a company has no subscription yet
          (approved before the agreement-by-email step). Captures the card
          via SetupIntent + <PaymentElement>, then creates the subscription:
          free until the launch-based date, then the rate. Nothing is
          charged today. Once active, this card hides. */}
      {!vendor.stripe_subscription_id && (
        <TrialStartCard
          prepareEndpoint="/api/vendor/billing/trial/prepare"
          startEndpoint="/api/vendor/billing/trial/start"
          audience="gold"
        />
      )}

      {/* Invoices: live from Stripe via /api/vendor/billing/invoices */}
      <SectionCard
        title="Invoices"
        subtitle="Pulled live from Stripe. PDF receipts available for every charge."
        padding="none"
      >
        <Box
          sx={{
            ...(listHeadSx as object),
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1fr 120px 1.5fr 120px 140px",
          }}
        >
          <Box>Invoice</Box>
          <Box>Date</Box>
          <Box>Description</Box>
          <Box sx={{ textAlign: "right" }}>Amount</Box>
          <Box>Status</Box>
        </Box>
        {invoices === null ? (
          <Stack sx={{ alignItems: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : invoices.length === 0 ? (
          <Box sx={{ px: 3, py: 3, color: MUTED, fontSize: "0.875rem" }}>
            No invoices yet. Your first invoice appears after your first monthly charge.
          </Box>
        ) : (
          <Stack divider={<ListDivider />}>
            {invoices.map((inv) => (
              <Box
                key={inv.id}
                sx={{
                  ...(listRowSx as object),
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr auto", md: "1fr 120px 1.5fr 120px 140px" },
                  gap: 1,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <ReceiptLongOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />
                  <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.8125rem", color: INK }}>
                    {inv.number ?? inv.id.slice(0, 10)}
                  </Typography>
                </Stack>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.875rem", color: CP.body }}>
                  {formatInvoiceDate(inv.createdAt)}
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: MUTED }}>
                  {inv.description ?? ""}
                </Box>
                <Box
                  sx={{
                    display: { xs: "none", md: "block" },
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: INK,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${inv.amountPaid.toFixed(2)}
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: { xs: "flex-end", md: "flex-start" } }}>
                  <InvoiceStatusPill status={mapStripeStatusToPill(inv.status)} />
                  {inv.pdfUrl || inv.hostedUrl ? (
                    <Tooltip title="Download PDF">
                      <IconButton
                        component="a"
                        href={inv.pdfUrl ?? inv.hostedUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                      >
                        <DownloadOutlinedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

type InvoiceStatus = "paid" | "open" | "due" | "failed";

// Map Stripe's invoice statuses to the 4 visual states the pill knows.
// Anything not in the canonical set becomes "open" so we never throw.
function mapStripeStatusToPill(status: string | null): InvoiceStatus {
  if (status === "paid") return "paid";
  if (status === "uncollectible" || status === "void") return "failed";
  if (status === "open") return "open";
  return "open";
}

function formatInvoiceDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function capitaliseFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function LadderRow({
  period,
  price,
  note,
  current,
}: {
  period: string;
  price: string;
  note: string;
  current: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        px: 1.75,
        py: 1.25,
        borderRadius: "10px",
        bgcolor: current ? CP.goldTint : "transparent",
        border: `1px solid ${current ? "rgba(217,168,75,0.4)" : "transparent"}`,
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: current ? CP.gold : CP.border, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK }}>{period}</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>{note}</Typography>
        </Stack>
      </Box>
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
        {price}
      </Typography>
      {current && <TagPill label="CURRENT" tone="gold" size="sm" />}
    </Stack>
  );
}

function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; color: "success" | "warning" | "error" }> = {
    paid: { label: "Paid", color: "success" },
    open: { label: "Open", color: "warning" },
    due: { label: "Due", color: "warning" },
    failed: { label: "Failed", color: "error" },
  };
  const p = map[status];
  return <Chip size="small" color={p.color} label={p.label} />;
}
