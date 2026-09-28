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
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { PageHeader, SectionCard, StatCard, TagPill, portalText } from "@/components/vendor/PortalUI";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor } from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";
import TrialStartCard from "@/components/shared/TrialStartCard";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const HOVER = "#F9FAFB";

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

const PLAN_LABELS: Record<string, { name: string; cadenceLabel: string }> = {
  founding: { name: "Founding Company", cadenceLabel: "Growth rate $49/month, waived months 1 to 6" },
  growth: { name: "Growth Company", cadenceLabel: "$49/month, months 7 to 12" },
  standard: { name: "Standard Company", cadenceLabel: "$199/month from month 13 ($1,990/year)" },
};

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
      // No Stripe customer yet (waiver phase) — render the empty state.
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
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading account…</Typography>
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

  const plan = PLAN_LABELS[vendor.plan_id ?? "founding"] ?? PLAN_LABELS.founding;
  const monthsLeftInWaiver = Math.max(0, 6 - vendor.months_in_program);
  const waiverProgress = Math.min(100, (vendor.months_in_program / 6) * 100);
  const nextBill = monthsLeftInWaiver > 0 ? "$0.00" : "$49.00";

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Account and billing"
        subtitle="Your founding rate is locked through month 12. Manage payment method and download past invoices."
      />

      {/* Stat tiles */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Current plan" value={plan.name} footer={<Box>{plan.cadenceLabel}</Box>} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Next billing"
            value={nextBill}
            footer={`On ${monthsLeftInWaiver > 0 ? "1st next month" : "next renewal"}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Months in program" value={`${vendor.months_in_program}/12`} footer="Founding term" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Lifetime billed" value="$0.00" footer="Waiver covers months 1-6" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Subscription detail */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Subscription"
            subtitle="The founding cohort schedule applies for your full first year."
            padding="default"
            action={
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <TagPill label="FOUNDING" tone="gold" size="sm" />
                <TagPill label="MONTH-TO-MONTH" tone="neutral" size="sm" />
              </Stack>
            }
          >
            <Stack spacing={2}>
              {/* Waiver progress */}
              <Box>
                <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>
                    Founding waiver
                  </Typography>
                  <Typography sx={portalText.meta}>
                    {monthsLeftInWaiver} month{monthsLeftInWaiver === 1 ? "" : "s"} left at $0
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={waiverProgress} />
              </Box>

              <Divider />

              {/* Pricing ladder */}
              <Stack spacing={1.25}>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>
                  Pricing ladder
                </Typography>
                <LadderRow
                  period="Months 1-6"
                  price="$0/mo"
                  note="Founding waiver, applies automatically"
                  current={vendor.months_in_program <= 6}
                />
                <LadderRow
                  period="Month 7 onward"
                  price="$49/mo"
                  note="Locked launch rate"
                  current={vendor.months_in_program > 6}
                />
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
                  <TagPill label="ON FILE" tone="neutral" size="sm" />
                ) : (
                  <TagPill label="WAIVED" tone="neutral" size="sm" />
                )
              }
            >
              {vendor.card_brand && vendor.card_last4 ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <ReceiptLongOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
                    <Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>
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
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, mb: 0.5 }}>
                    No payment method required yet
                  </Typography>
                  <Typography sx={portalText.body}>
                    Your first {monthsLeftInWaiver === 6 ? "6 months" : `${monthsLeftInWaiver} month${monthsLeftInWaiver === 1 ? "" : "s"}`} are <Box component="strong" sx={{ color: INK, fontWeight: 600 }}>completely free</Box> as a founding company. We&apos;ll ask you to add a card a few weeks before month 7. Billing email is {vendor.billing_email ?? vendor.contact_email}.
                  </Typography>
                </Box>
              )}
              {portalError && (
                <Typography sx={{ fontSize: "0.8125rem", color: "#991B1B", mt: 1 }}>
                  {portalError}
                </Typography>
              )}
            </SectionCard>

            <SectionCard title="Cancellation" padding="default">
              <Typography sx={portalText.body}>
                Cancel anytime with <Box component="strong" sx={{ color: INK, fontWeight: 600 }}>30 days&apos; written notice</Box>{" "}
                through this portal. You remain responsible for fees accrued through the effective date of
                termination.
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

      {/* Trial-start card — shown on first login after approval. Captures
          the card via SetupIntent + <PaymentElement>, then creates a
          Stripe subscription with 180-day trial. Once trialing/active,
          this card hides and normal billing UI takes over. */}
      {!vendor.stripe_subscription_id && (
        <TrialStartCard
          prepareEndpoint="/api/vendor/billing/trial/prepare"
          startEndpoint="/api/vendor/billing/trial/start"
          audience="gold"
        />
      )}

      {/* Invoices — live from Stripe via /api/vendor/billing/invoices */}
      <SectionCard
        title="Invoices"
        subtitle="Pulled live from Stripe. PDF receipts available for every charge."
        padding="none"
      >
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1fr 120px 1.5fr 120px 120px",
            px: 3,
            py: 1.25,
            borderBottom: `1px solid ${LINE}`,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: MUTED,
            letterSpacing: 0,
            textTransform: "none",
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
            No invoices yet. Your first invoice ships once the waiver period ends.
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
            {invoices.map((inv) => (
              <Box
                key={inv.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr auto", md: "1fr 120px 1.5fr 120px 120px" },
                  alignItems: "center",
                  px: 3,
                  py: 1.5,
                  gap: 1,
                  "&:hover": { bgcolor: HOVER },
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <ReceiptLongOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />
                  <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.8125rem", color: INK }}>
                    {inv.number ?? inv.id.slice(0, 10)}
                  </Typography>
                </Stack>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.875rem", color: "#374151" }}>
                  {formatInvoiceDate(inv.createdAt)}
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: MUTED }}>
                  {inv.description ?? ""}
                </Box>
                <Box
                  sx={{
                    display: { xs: "none", md: "block" },
                    fontSize: "0.875rem",
                    fontWeight: 600,
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
        px: 1.5,
        py: 1.25,
        borderRadius: "6px",
        bgcolor: current ? HOVER : "transparent",
        border: `1px solid ${current ? LINE : "transparent"}`,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>{period}</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>{note}</Typography>
        </Stack>
      </Box>
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
        {price}
      </Typography>
      {current && <TagPill label="CURRENT" tone="navy" size="sm" />}
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
