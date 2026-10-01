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
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ExpertsRow } from "@/lib/supabase/types";
import { phaseForMonth } from "@/lib/stripe";
import TrialStartCard from "@/components/shared/TrialStartCard";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EP } from "@/components/shared/TopNavPortalShell";
import { PageHeader, SectionCard } from "@/components/vendor/PortalUI";

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const FAINT = CP.faint;
const LINE = CP.border;
const BRONZE_TINT = EP.bronzeTint;
const HOVER = EP.bronzeTint;

/**
 * Expert terms: free founding months (6 from the member launch), then
 * $39 a month with no increase. The "Until" date comes from the Stripe
 * trial end on the row.
 */
const RAMP = {
  launch: { months: "Free founding months", price: "$0", note: "From the member launch" },
  growth: { months: "After that", price: "$39", note: "Flat rate, no increase" },
} as const;

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
 * but adapted to the expert ramp (a free period, then $39 a month with
 * no increase). The header band shows the ramp and where the expert is
 * today; billing-exempt experts (manual admin override) see an
 * exemption line instead.
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
  const trialing = expert?.subscription_status === "trialing";
  // Experts only ever move launch -> growth. While Stripe says "trialing"
  // they are in the free founding months regardless of months_in_program.
  const phase: "launch" | "growth" = trialing ? "launch" : phaseForMonth(monthsInProgram, "expert") === "launch" ? "launch" : "growth";
  const currentPrice = `${RAMP[phase].price} / mo`;
  const freePeriodEnds = trialing && expert?.current_period_end ? formatDate(expert.current_period_end) : null;
  const hasSubscription = !!expert?.stripe_subscription_id;
  // Billing exemption (manual admin override). No card, no subscription, no invoices.
  const billingExempt = !!expert?.billing_exempt;
  const rampSentence = freePeriodEnds
    ? `Free until ${freePeriodEnds}, then $39 a month. It stays $39, with no increase. Cancel before your first charge and you won't be charged.`
    : "Your first 6 months are free, starting the day we open to members. After that it's $39 a month, and it stays $39 with no increase.";

  const planLabel = useMemo(() => {
    const phaseLabel = phase === "launch" ? "Launch" : "Growth";
    return `Featured Expert · ${phaseLabel}`;
  }, [phase]);

  const status = useMemo(() => {
    const s = expert?.subscription_status;
    if (s === "trialing") return { label: "Free months", tone: "leaf" as const };
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
            ? "Your expert membership is billing-exempt. There's nothing to manage here."
            : "Manage your subscription, payment method, and invoices. Everything is handled securely through Stripe."
        }
      />

      {/* ---- Header band: forest gradient with the ramp cells, or the
          exemption line for billing-exempt experts ---- */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "16px",
          bgcolor: EP.espresso,
          backgroundImage: `linear-gradient(135deg, ${EP.espresso} 0%, ${EP.espressoDeep} 100%)`,
          color: CP.ivory,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 3.5 },
          boxShadow: "0 18px 40px -24px rgba(43,30,20,0.55)",
          "&::before": {
            content: '""',
            position: "absolute",
            top: -140,
            right: -100,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(176,122,44,0.42) 0%, rgba(176,122,44,0.12) 40%, transparent 70%)",
            pointerEvents: "none",
          },
        }}
      >
        {billingExempt ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ position: "relative", alignItems: { md: "center" } }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                bgcolor: CP.gold,
                color: CP.ink,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <WorkspacePremiumRoundedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: CP.gold, mb: 0.5 }}>Founding bench</Typography>
              <Typography sx={{ fontSize: { xs: "1.375rem", md: "1.625rem" }, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", lineHeight: 1.2 }}>
                Expert membership: billing-exempt
              </Typography>
              <Typography sx={{ fontSize: "0.875rem", color: CP.ivory80, lineHeight: 1.6, mt: 0.75, maxWidth: 640 }}>
                Your expert membership costs nothing, now or later: no trial, no renewal, no payment method required.
                Everything in your portal stays unlocked.
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: CP.ivory55, lineHeight: 1.6, mt: 1 }}>
                If you also list a company, that company is billed separately in the company portal. This page only
                covers your expert membership.
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Box sx={{ position: "relative" }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#E4B96A", mb: 0.5 }}>Your ramp</Typography>
            <Typography sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" }, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", lineHeight: 1.2 }}>
              {phase === "launch"
                ? freePeriodEnds
                  ? `Free until ${freePeriodEnds}`
                  : "Your free founding months"
                : `Now: ${RAMP.growth.price} a month`}
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: CP.ivory80, lineHeight: 1.6, mt: 0.5 }}>
              {rampSentence}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2.5 }}>
              <RampCell {...RAMP.launch} note={freePeriodEnds ? `Until ${freePeriodEnds}` : RAMP.launch.note} current={phase === "launch"} />
              <RampCell {...RAMP.growth} current={phase === "growth"} />
            </Stack>
          </Box>
        )}
      </Box>

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
            <MetaItem label="Course revenue">You keep the full price</MetaItem>
          </Stack>

          {portalError && (
            <Typography sx={{ fontSize: "0.8125rem", color: CP.errorFg, mt: 1.5 }}>
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

      {/* ---- Your terms ---- (never shown to billing-exempt experts) */}
      {!billingExempt && (
      <SectionCard
        title="Your terms"
        subtitle={
          phase === "launch"
            ? freePeriodEnds
              ? `Free until ${freePeriodEnds}`
              : "Your free founding months"
            : "Free months complete"
        }
        padding="none"
      >
        <Stack sx={{ p: 2 }} spacing={0.5}>
          <LadderRow period={RAMP.launch.months} price={`${RAMP.launch.price}/mo`} note={freePeriodEnds ? `Until ${freePeriodEnds}` : RAMP.launch.note} current={phase === "launch"} />
          <LadderRow period={RAMP.growth.months} price={`${RAMP.growth.price}/mo`} note={RAMP.growth.note} current={phase === "growth"} />
        </Stack>
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED, lineHeight: 1.6 }}>
            <Box component="strong" sx={{ color: INK, fontWeight: 600 }}>Course revenue</Box>: sell your own
            courses and products to members and keep the full price. Members buy on your site; the one
            condition is a member-only offer on each.
          </Typography>
        </Box>
      </SectionCard>
      )}

      {/* ---- Invoices ---- (billing-exempt experts are never invoiced) */}
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
      ? { bg: CP.successBg, fg: CP.successFg }
      : tone === "gold"
        ? { bg: CP.warningBg, fg: CP.warningFg }
        : tone === "red"
          ? { bg: CP.errorBg, fg: CP.errorFg }
          : { bg: CP.neutralBg, fg: CP.neutralFg };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1.1,
        height: 26,
        borderRadius: `${CP.radiusChip}px`,
        bgcolor: p.bg,
        color: p.fg,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {label}
    </Box>
  );
}

/** One cell of the ramp inside the forest header band. */
function RampCell({ months, price, note, current }: { months: string; price: string; note: string; current: boolean }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        px: 2,
        py: 1.5,
        borderRadius: "12px",
        bgcolor: current ? "rgba(176,122,44,0.28)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${current ? EP.bronze : "rgba(255,255,255,0.10)"}`,
        position: "relative",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: current ? "#E4B96A" : CP.ivory55 }}>{months}</Typography>
        {current && (
          <Box
            component="span"
            sx={{
              px: 0.75,
              height: 18,
              borderRadius: 999,
              bgcolor: EP.bronze,
              color: "#FFFFFF",
              fontSize: "0.625rem",
              fontWeight: 700,
              display: "inline-grid",
              placeItems: "center",
            }}
          >
            Now
          </Box>
        )}
      </Stack>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", lineHeight: 1.15, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
        {price}
        <Box component="span" sx={{ fontSize: "0.8125rem", fontWeight: 600, color: CP.ivory80, ml: 0.5 }}>
          /mo
        </Box>
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", color: CP.ivory80, mt: 0.25 }}>{note}</Typography>
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
        borderRadius: "10px",
        bgcolor: current ? BRONZE_TINT : "transparent",
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
          fontWeight: 700,
          color: current ? EP.bronzeDeep : INK,
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
      ? { bg: CP.successBg, fg: CP.successFg }
      : status === "open"
        ? { bg: CP.warningBg, fg: CP.warningFg }
        : status === "void" || status === "uncollectible"
          ? { bg: CP.errorBg, fg: CP.errorFg }
          : { bg: CP.neutralBg, fg: CP.neutralFg };
  const label = status ? capitalise(status) : "Unknown";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        px: 0.75,
        borderRadius: `${CP.radiusChip}px`,
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: "0.6875rem",
        fontWeight: 600,
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
