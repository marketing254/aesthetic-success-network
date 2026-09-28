"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ExpertsRow } from "@/lib/supabase/types";
import { phaseForMonth, priceLabelForPhase } from "@/lib/stripe";
import TrialStartCard from "@/components/shared/TrialStartCard";
import { PageHeader, SectionCard } from "@/components/vendor/PortalUI";

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const NAVY_TINT = "rgba(14,42,61,0.08)";
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

/**
 * Expert billing — mirrors the structure of the member BillingSection
 * but adapted to the ASN provider ramp ($0 months 1 to 6, $49 months 7
 * to 12, $199 from month 13). Adds a "phase ladder" card showing where
 * the expert is today and what's next.
 */
export default function ExpertBillingPage() {
  const [expert, setExpert] = useState<ExpertsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("experts")
        .select("*")
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

  useEffect(() => {
    if (!expert?.stripe_customer_id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/expert/billing/invoices", { cache: "no-store" });
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
  }, [expert?.stripe_customer_id]);

  const effectiveInvoices: Invoice[] | null = expert?.stripe_customer_id ? invoices : [];

  const openPortal = async () => {
    setPortalBusy(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/expert/billing/portal", { method: "POST" });
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

  const monthsInProgram = expert?.months_in_program ?? 0;
  const phase = phaseForMonth(monthsInProgram);
  const currentPrice = priceLabelForPhase(phase);
  const monthsLeftInWaiver = Math.max(0, 6 - monthsInProgram);
  const hasSubscription = !!expert?.stripe_subscription_id;
  // Founding cohort — lifetime free. No card, no subscription, no invoices.
  const billingExempt = !!expert?.billing_exempt;

  const planLabel = useMemo(() => {
    const phaseLabel = phase === "launch" ? "Launch" : phase === "growth" ? "Growth" : "Standard";
    return `Featured Expert · ${phaseLabel}`;
  }, [phase]);

  const status = useMemo(() => {
    const s = expert?.subscription_status;
    if (s === "trialing") return { label: "Trialing", tone: "leaf" as const };
    if (s === "active") return { label: "Active", tone: "leaf" as const };
    if (s === "past_due" || s === "unpaid") return { label: "Payment due", tone: "gold" as const };
    if (s === "canceled" || s === "incomplete_expired") return { label: "Canceled", tone: "red" as const };
    if (hasSubscription) return { label: "Active", tone: "leaf" as const };
    return { label: "Not started", tone: "grey" as const };
  }, [expert?.subscription_status, hasSubscription]);

  const renewalLabel = useMemo(() => {
    if (!expert?.current_period_end) return null;
    const d = formatDate(expert.current_period_end);
    return expert.cancel_at_period_end ? `Ends ${d}` : `Renews ${d}`;
  }, [expert?.current_period_end, expert?.cancel_at_period_end]);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 12 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (!expert) {
    return (
      <Box>
        <Typography sx={{ fontSize: "0.875rem", color: MUTED }}>
          No expert profile found for this account.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Plan and billing"
        subtitle={
          billingExempt
            ? "Your founding expert membership is free for life. There's nothing to manage here."
            : "Manage your subscription, payment method, and invoices. Everything is handled securely through Stripe."
        }
      />

      {/* ---- Lifetime-free founding expert ----
          Takes precedence over every other state: no card prompt, no
          plan card, no invoices. Their company (if they run one) bills
          separately through the partner portal. */}
      {billingExempt && (
        <SectionCard
          title="Founding expert: free for life"
          subtitle="You're part of the founding bench. We never charge you and we don't keep a card on file."
        >
          <Typography sx={{ fontSize: "0.875rem", color: BODY, lineHeight: 1.6 }}>
            Your expert membership costs nothing, now or later: no trial, no renewal, no
            payment method required. Everything in your portal stays unlocked.
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED, lineHeight: 1.6, mt: 1.5 }}>
            If you also list a company, that company is billed separately in the
            company portal. This page only covers your expert membership.
          </Typography>
        </SectionCard>
      )}

      {/* ---- Trial-start (no subscription yet) ---- */}
      {!billingExempt && !hasSubscription && (
        <TrialStartCard
          prepareEndpoint="/api/expert/billing/trial/prepare"
          startEndpoint="/api/expert/billing/trial/start"
          audience="green"
        />
      )}

      {/* ---- Current plan ---- */}
      {!billingExempt && hasSubscription && (
        <SectionCard title="Current plan" subtitle="Managed by Stripe. Changes take effect at the next renewal.">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                {planLabel}
              </Typography>
              <Typography sx={{ fontSize: "0.875rem", color: MUTED, mt: 0.25 }}>
                {currentPrice}
              </Typography>
            </Box>
            <Button
              onClick={openPortal}
              disabled={portalBusy}
              variant="contained"
              startIcon={
                portalBusy ? (
                  <CircularProgress size={14} sx={{ color: "inherit" }} />
                ) : (
                  <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}
            >
              Manage subscription
            </Button>
          </Stack>

          {/* Meta row: status + renewal, aligned key/value pairs */}
          <Stack direction="row" spacing={4} sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${LINE}`, flexWrap: "wrap", rowGap: 1.5 }}>
            <MetaItem label="Status">
              <StatusPill label={status.label} tone={status.tone} />
            </MetaItem>
            {renewalLabel && <MetaItem label="Billing">{renewalLabel}</MetaItem>}
            <MetaItem label="Course revenue">You keep 70%</MetaItem>
          </Stack>

          {portalError && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#991B1B", mt: 1.5 }}>
              {portalError}
            </Typography>
          )}
        </SectionCard>
      )}

      {/* ---- Payment method ---- */}
      {!billingExempt && hasSubscription && (
        <SectionCard title="Payment method" subtitle="Update or replace your card in the Stripe portal.">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CreditCardRoundedIcon sx={{ fontSize: 20, color: MUTED, flexShrink: 0 }} />
              {expert.card_brand && expert.card_last4 ? (
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>
                    {capitalise(expert.card_brand)} ending {expert.card_last4}
                  </Typography>
                  <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>
                    Default for future charges
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: "0.875rem", color: MUTED }}>
                  No card on file yet.
                </Typography>
              )}
            </Stack>
            <Button
              onClick={openPortal}
              disabled={portalBusy}
              variant="outlined"
              size="small"
              sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}
            >
              Update card
            </Button>
          </Stack>
        </SectionCard>
      )}

      {/* ---- Pricing ladder ---- (never shown to lifetime-free experts) */}
      {!billingExempt && (
      <SectionCard
        title="Pricing ladder"
        subtitle={
          monthsLeftInWaiver > 0
            ? `${monthsLeftInWaiver} month${monthsLeftInWaiver === 1 ? "" : "s"} left at $0`
            : "Founding waiver complete"
        }
        padding="none"
      >
        <Stack sx={{ p: 2 }} spacing={0.5}>
          <LadderRow period="Months 1 to 6" price="$0/mo" note="Founding waiver" current={phase === "launch"} />
          <LadderRow period="Months 7 to 12" price="$49/mo" note="Growth rate" current={phase === "growth"} />
          <LadderRow period="Month 13 onward" price="$199/mo" note="Standard rate ($1,990/yr)" current={phase === "standard"} />
        </Stack>
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED, lineHeight: 1.6 }}>
            <Box component="strong" sx={{ color: INK, fontWeight: 600 }}>Course revenue split</Box>: sell paid
            courses through ASN and keep 70% (ASN keeps 30%), paid out monthly via Stripe Connect.
          </Typography>
        </Box>
      </SectionCard>
      )}

      {/* ---- Invoices ---- (lifetime-free experts are never invoiced) */}
      {!billingExempt && (
      <SectionCard title="Invoices" subtitle="Receipts for every charge. Download for your records." padding="none">
        {effectiveInvoices === null ? (
          <Stack sx={{ alignItems: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : effectiveInvoices.length === 0 ? (
          <Box sx={{ px: 3, py: 5, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.875rem", color: MUTED }}>
              No invoices yet. They&apos;ll appear here after your first charge.
            </Typography>
          </Box>
        ) : (
          <Box>
            <Box
              sx={{
                display: { xs: "none", sm: "grid" },
                gridTemplateColumns: "1.3fr 2fr 1fr 0.9fr 0.6fr",
                gap: 1,
                px: 3,
                py: 1.25,
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              <HeaderCell>Date</HeaderCell>
              <HeaderCell>Description</HeaderCell>
              <HeaderCell align="right">Amount</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell align="right">PDF</HeaderCell>
            </Box>
            {effectiveInvoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </Box>
        )}
      </SectionCard>
      )}
    </Stack>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: MUTED, mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }}>{children}</Box>
    </Box>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "leaf" | "gold" | "red" | "grey" }) {
  const p =
    tone === "leaf"
      ? { bg: "#DCFCE7", fg: "#166534" }
      : tone === "gold"
        ? { bg: "#FEF3C7", fg: "#92400E" }
        : tone === "red"
          ? { bg: "#FEE2E2", fg: "#991B1B" }
          : { bg: "#F3F4F6", fg: BODY };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        height: 24,
        borderRadius: "6px",
        bgcolor: p.bg,
        color: p.fg,
        fontSize: "0.75rem",
        fontWeight: 500,
      }}
    >
      {label}
    </Box>
  );
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
        bgcolor: current ? NAVY_TINT : "transparent",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>
            {period}
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>{note}</Typography>
        </Stack>
      </Box>
      {current && <Chip label="Current" size="small" color="primary" />}
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: current ? NAVY : INK,
          textAlign: "right",
          minWidth: 64,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {price}
      </Typography>
    </Stack>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const amount = `$${invoice.amountPaid.toFixed(2)}`;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1.3fr 2fr 1fr 0.9fr 0.6fr" },
        gap: { xs: 0.5, sm: 1 },
        px: 3,
        py: 1.5,
        borderBottom: `1px solid ${LINE}`,
        alignItems: { sm: "center" },
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": { bgcolor: HOVER },
      }}
    >
      <Box>
        <Typography sx={{ fontSize: "0.875rem", color: INK, fontWeight: 500 }}>
          {formatDate(invoice.createdAt)}
        </Typography>
        <Typography sx={{ display: { xs: "block", sm: "none" }, fontSize: "0.8125rem", color: MUTED }}>
          {invoice.description ?? ""}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.875rem", color: BODY }} noWrap>
          {invoice.description ?? ""}
        </Typography>
      </Box>
      <Box sx={{ textAlign: { sm: "right" }, display: { xs: "flex", sm: "block" }, justifyContent: "space-between" }}>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" }, fontSize: "0.75rem", color: MUTED }}>
          Amount
        </Box>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "flex", sm: "block" }, justifyContent: "space-between" }}>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" }, fontSize: "0.75rem", color: MUTED }}>
          Status
        </Box>
        <InvoiceStatus status={invoice.status} />
      </Box>
      <Box sx={{ textAlign: { sm: "right" } }}>
        {invoice.pdfUrl || invoice.hostedUrl ? (
          <Button
            component="a"
            href={invoice.pdfUrl ?? invoice.hostedUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            variant="text"
            startIcon={<DownloadRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ minWidth: "auto" }}
          >
            PDF
          </Button>
        ) : (
          <Typography sx={{ fontSize: "0.8125rem", color: FAINT }}>n/a</Typography>
        )}
      </Box>
    </Box>
  );
}

function InvoiceStatus({ status }: { status: string | null }) {
  const palette =
    status === "paid"
      ? { bg: "#DCFCE7", fg: "#166534" }
      : status === "open"
        ? { bg: "#FEF3C7", fg: "#92400E" }
        : status === "void" || status === "uncollectible"
          ? { bg: "#FEE2E2", fg: "#991B1B" }
          : { bg: "#F3F4F6", fg: BODY };
  const label = status ? capitalise(status) : "Unknown";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        px: 0.75,
        borderRadius: "6px",
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: "0.6875rem",
        fontWeight: 500,
      }}
    >
      {label}
    </Box>
  );
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <Typography
      sx={{
        fontSize: "0.75rem",
        fontWeight: 600,
        color: MUTED,
        textTransform: "none",
        textAlign: align,
      }}
    >
      {children}
    </Typography>
  );
}

function formatDate(iso: string): string {
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

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
