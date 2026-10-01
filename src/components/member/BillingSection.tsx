"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import type { CurrentMember } from "@/lib/hooks/useCurrentMember";

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
 * BillingSection — the standard SaaS billing block: current plan card,
 * payment method, invoice history. All managed by Stripe; we just
 * surface the read-side shadow plus deep-links to the Customer Portal
 * for any write actions (cancel, update card, switch plan).
 */
export function BillingSection({ member }: { member: CurrentMember }) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // The effect only runs when the member actually has a Stripe customer.
  // For un-subscribed members the "invoices" view is derived as []
  // straight in the render path — no effect needed, which avoids the
  // react-hooks/set-state-in-effect lint trap.
  useEffect(() => {
    if (!member.stripe_customer_id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/billing/invoices", { cache: "no-store" });
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
  }, [member.stripe_customer_id]);

  // For never-subscribed members, surface an empty list immediately.
  const effectiveInvoices: Invoice[] | null = member.stripe_customer_id ? invoices : [];

  const openPortal = async () => {
    setPortalBusy(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
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

  const planLabel = useMemo(() => derivePlanLabel(member), [member]);
  const priceLabel = useMemo(() => derivePriceLabel(member), [member]);
  const statusLabel = useMemo(() => deriveStatusLabel(member), [member]);
  const statusTone = useMemo(() => deriveStatusTone(member), [member]);

  const hasSubscription = !!member.stripe_subscription_id;
  // The "Re-sync from Stripe" escape hatch fires when the local row
  // looks out of date relative to what we *should* have if the webhook
  // delivered cleanly. Two cases:
  //   - we have a customer but no subscription (webhook didn't fire), or
  //   - we have a subscription but no card on file (payment_method lives
  //     on the customer and the webhook ran before we hydrated it).
  const needsManualSync =
    !!member.stripe_customer_id &&
    (!hasSubscription || (hasSubscription && (!member.card_brand || !member.card_last4)));

  const syncFromStripe = async () => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/member/billing/sync", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        synced?: boolean;
        reason?: string;
        status?: string;
      };
      if (res.ok && body.synced) {
        setSyncMessage({
          tone: "ok",
          text: `Synced. Subscription is "${body.status ?? "active"}". Reload to see the updated plan.`,
        });
        // Auto-reload so the page picks up the new member state.
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSyncMessage({
          tone: "err",
          text: body.reason ?? `Sync failed (${res.status})`,
        });
      }
    } catch (err) {
      setSyncMessage({
        tone: "err",
        text: err instanceof Error ? err.message : "Sync failed.",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      {/* ----- Current Plan card ----- */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          bgcolor: "var(--paper, #FBF8F1)",
          border: "1px solid rgba(14,42,61,0.08)",
          boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
        }}
      >
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, borderBottom: "1px solid rgba(14,42,61,0.06)" }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1A2F" }}>
            Current plan
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: "#5C6770", mt: 0.25 }}>
            Managed by Stripe. Changes take effect at the next renewal.
          </Typography>
        </Box>

        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.25 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 2, sm: 3 }}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 0.75,
                    bgcolor: "rgba(217,168,75,0.14)",
                    color: "var(--gold-deep, #A07823)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <WorkspacePremiumRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "1.2rem", md: "1.35rem" },
                    fontWeight: 500,
                    color: "#0A1A2F",
                    lineHeight: 1.2,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {planLabel}
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontSize: "0.92rem",
                  color: "#3B4A55",
                  ml: 4.75, // align under the title (icon width + gap)
                  lineHeight: 1.55,
                }}
              >
                {priceLabel}
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ ml: 4.75, mt: 1.25, flexWrap: "wrap", rowGap: 0.5 }}
              >
                <StatusPill label={statusLabel} tone={statusTone} />
                {member.current_period_end && (
                  <MetaPill
                    label={member.cancel_at_period_end ? "Ends" : "Renews"}
                    value={formatDate(member.current_period_end)}
                  />
                )}
                {member.founding_member_locked && <MetaPill label="Rate" value="Locked" tone="gold" />}
              </Stack>
            </Box>

            <Box sx={{ flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}>
              {hasSubscription ? (
                <Button
                  onClick={openPortal}
                  disabled={portalBusy}
                  variant="contained"
                  size="medium"
                  disableElevation
                  startIcon={
                    portalBusy ? (
                      <CircularProgress size={14} sx={{ color: "inherit" }} />
                    ) : (
                      <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                    )
                  }
                  sx={{
                    bgcolor: "var(--ink, #0A1A2F)",
                    color: "#FFFFFF",
                    textTransform: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    borderRadius: 0.75,
                    px: 2,
                    py: 1,
                    width: { xs: "100%", sm: "auto" },
                    "&:hover": { bgcolor: "#0F2540" },
                  }}
                >
                  Manage subscription
                </Button>
              ) : (
                <Button
                  href="/dashboard"
                  variant="contained"
                  size="medium"
                  disableElevation
                  sx={{
                    bgcolor: "var(--gold-deep, #A07823)",
                    color: "#FFFFFF",
                    textTransform: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    borderRadius: 0.75,
                    px: 2,
                    py: 1,
                    width: { xs: "100%", sm: "auto" },
                    "&:hover": { bgcolor: "#7A5B17" },
                  }}
                >
                  Subscribe now
                </Button>
              )}
            </Box>
          </Stack>
          {portalError && (
            <Typography sx={{ fontSize: "0.74rem", color: "#8C1D1D", mt: 1 }}>
              {portalError}
            </Typography>
          )}

          {needsManualSync && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1.25,
                bgcolor: "rgba(217,168,75,0.08)",
                border: "1px solid rgba(217,168,75,0.3)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ alignItems: { sm: "center" } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#7A5B17" }}>
                    Plan looks out of date?
                  </Typography>
                  <Typography
                    sx={{ fontSize: "0.76rem", color: "#5C6770", lineHeight: 1.55, mt: 0.25 }}
                  >
                    If Stripe charged your card but this card still says &ldquo;not
                    subscribed&rdquo;, the webhook didn&apos;t reach us. Click below to pull
                    your subscription state directly from Stripe.
                  </Typography>
                </Box>
                <Button
                  onClick={syncFromStripe}
                  disabled={syncBusy}
                  variant="contained"
                  size="small"
                  disableElevation
                  startIcon={
                    syncBusy ? (
                      <CircularProgress size={12} sx={{ color: "inherit" }} />
                    ) : (
                      <SyncRoundedIcon sx={{ fontSize: 14 }} />
                    )
                  }
                  sx={{
                    bgcolor: "var(--gold-deep, #A07823)",
                    color: "#FFFFFF",
                    textTransform: "none",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    borderRadius: 0.75,
                    px: 1.5,
                    py: 0.5,
                    flexShrink: 0,
                    "&:hover": { bgcolor: "#7A5B17" },
                  }}
                >
                  {syncBusy ? "Syncing…" : "Re-sync from Stripe"}
                </Button>
              </Stack>
              {syncMessage && (
                <Typography
                  sx={{
                    mt: 1,
                    fontSize: "0.74rem",
                    color: syncMessage.tone === "ok" ? "#1F5C40" : "#8C1D1D",
                    fontWeight: 500,
                  }}
                >
                  {syncMessage.text}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* ----- Payment method card ----- */}
      {hasSubscription && (
        <Box
          sx={{
            borderRadius: 2,
            bgcolor: "#FFFFFF",
            border: "1px solid rgba(14,42,61,0.08)",
            boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 2.5 },
              py: 1.5,
              borderBottom: "1px solid rgba(14,42,61,0.06)",
            }}
          >
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1A2F" }}>
              Payment method
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#5C6770", mt: 0.25 }}>
              Update or replace your card in the Stripe portal.
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              px: { xs: 2, md: 2.5 },
              py: 2,
              alignItems: { sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 42,
                  height: 30,
                  borderRadius: 0.75,
                  bgcolor: "var(--ink, #0A1A2F)",
                  color: "#F0C16E",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <CreditCardRoundedIcon sx={{ fontSize: 16 }} />
              </Box>
              {member.card_brand && member.card_last4 ? (
                <Box>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1A2F" }}>
                    {capitaliseFirst(member.card_brand)} ending {member.card_last4}
                  </Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: "#7A8590" }}>
                    Default for future charges
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: "0.86rem", color: "#5C6770" }}>
                  No card details available yet.
                </Typography>
              )}
            </Stack>
            <Button
              onClick={openPortal}
              disabled={portalBusy}
              variant="outlined"
              size="small"
              sx={{
                borderColor: "rgba(14,42,61,0.18)",
                color: "#0A1A2F",
                textTransform: "none",
                fontSize: "0.78rem",
                fontWeight: 600,
                borderRadius: 0.75,
                px: 1.5,
                py: 0.4,
                "&:hover": {
                  borderColor: "var(--gold-deep, #A07823)",
                  bgcolor: "rgba(217,168,75,0.06)",
                },
              }}
            >
              Update card
            </Button>
          </Stack>
        </Box>
      )}

      {/* ----- Invoices ----- */}
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: "#FFFFFF",
          border: "1px solid rgba(14,42,61,0.08)",
          boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: "1px solid rgba(14,42,61,0.06)",
          }}
        >
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1A2F" }}>
            Invoices
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: "#5C6770", mt: 0.25 }}>
            Receipts for every charge. Download for your records.
          </Typography>
        </Box>

        {effectiveInvoices === null ? (
          <Stack sx={{ alignItems: "center", py: 4 }}>
            <CircularProgress size={18} sx={{ color: "#A07823" }} />
          </Stack>
        ) : effectiveInvoices.length === 0 ? (
          <Box sx={{ px: { xs: 2, md: 2.5 }, py: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.86rem", color: "#5C6770" }}>
              No invoices yet. They&apos;ll appear here after your first charge.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Table header (desktop only) */}
            <Box
              sx={{
                display: { xs: "none", sm: "grid" },
                gridTemplateColumns: "1.4fr 2fr 1fr 0.9fr 0.7fr",
                gap: 1,
                px: 2.5,
                py: 1,
                bgcolor: "rgba(14,42,61,0.02)",
                borderBottom: "1px solid rgba(14,42,61,0.06)",
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
      </Box>
    </Stack>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const amount = `$${invoice.amountPaid.toFixed(2)}`;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1.4fr 2fr 1fr 0.9fr 0.7fr" },
        gap: { xs: 0.5, sm: 1 },
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        borderBottom: "1px solid rgba(14,42,61,0.04)",
        alignItems: { sm: "center" },
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": { bgcolor: "rgba(14,42,61,0.015)" },
      }}
    >
      <Box>
        <Typography sx={{ fontSize: "0.84rem", color: "#0A1A2F", fontWeight: 500 }}>
          {formatDate(invoice.createdAt)}
        </Typography>
        <Typography
          sx={{ display: { xs: "block", sm: "none" }, fontSize: "0.74rem", color: "#7A8590" }}
        >
          {invoice.description ?? ""}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", color: "#3B4A55" }} noWrap>
          {invoice.description ?? ""}
        </Typography>
      </Box>
      <Box
        sx={{
          textAlign: { sm: "right" },
          display: { xs: "flex", sm: "block" },
          justifyContent: "space-between",
        }}
      >
        <Box
          component="span"
          sx={{ display: { xs: "inline", sm: "none" }, fontSize: "0.72rem", color: "#7A8590" }}
        >
          Amount
        </Box>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#0A1A2F" }}>
          {amount}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "flex", sm: "block" }, justifyContent: "space-between" }}>
        <Box
          component="span"
          sx={{ display: { xs: "inline", sm: "none" }, fontSize: "0.72rem", color: "#7A8590" }}
        >
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
            startIcon={<DownloadRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: "none",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "var(--gold-deep, #A07823)",
              minWidth: "auto",
              p: 0.5,
              "&:hover": { bgcolor: "rgba(217,168,75,0.06)" },
            }}
          >
            PDF
          </Button>
        ) : (
          <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AB" }}>n/a</Typography>
        )}
      </Box>
    </Box>
  );
}

function InvoiceStatus({ status }: { status: string | null }) {
  const palette =
    status === "paid"
      ? { bg: "rgba(34,108,78,0.1)", fg: "#1F5C40", border: "rgba(34,108,78,0.28)" }
      : status === "open"
        ? { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17", border: "rgba(217,168,75,0.36)" }
        : status === "void" || status === "uncollectible"
          ? { bg: "rgba(140,29,29,0.06)", fg: "#8C1D1D", border: "rgba(140,29,29,0.24)" }
          : { bg: "rgba(14,42,61,0.04)", fg: "#5C6770", border: "rgba(14,42,61,0.12)" };
  const label = status ? capitaliseFirst(status) : "Unknown";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 18,
        px: 0.75,
        borderRadius: 0.5,
        bgcolor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: "0.66rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: palette.fg, opacity: 0.85 }} />
      {label}
    </Box>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "leaf" | "gold" | "signal" | "ink";
}) {
  const palette =
    tone === "leaf"
      ? { bg: "rgba(34,108,78,0.12)", fg: "#1F5C40", border: "rgba(34,108,78,0.3)" }
      : tone === "gold"
        ? { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17", border: "rgba(217,168,75,0.36)" }
        : tone === "signal"
          ? { bg: "rgba(140,29,29,0.08)", fg: "#8C1D1D", border: "rgba(140,29,29,0.24)" }
          : { bg: "rgba(14,42,61,0.05)", fg: "#0A1A2F", border: "rgba(14,42,61,0.14)" };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 22,
        px: 0.9,
        borderRadius: 0.75,
        bgcolor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: palette.fg, opacity: 0.85 }} />
      {label}
    </Box>
  );
}

function MetaPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold";
}) {
  const accent = tone === "gold" ? "#A07823" : "#7A8590";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0.5,
        height: 22,
        fontSize: "0.74rem",
        color: "#3B4A55",
      }}
    >
      <Box component="span" sx={{ fontSize: "0.62rem", fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontWeight: 600, color: "#0A1A2F" }}>
        {value}
      </Box>
    </Box>
  );
}

function HeaderCell({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <Typography
      sx={{
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: "#7A8590",
        textTransform: "uppercase",
        textAlign: align,
      }}
    >
      {children}
    </Typography>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function derivePlanLabel(m: CurrentMember): string {
  const intervalLabel =
    m.subscription_interval === "year"
      ? "Annual"
      : m.subscription_interval === "month"
        ? "Monthly"
        : null;
  const tierLabel =
    m.tier === "founding" ? "Founding Member" : m.tier === "standard" ? "Standard Member" : "Member";
  return intervalLabel ? `${tierLabel} · ${intervalLabel}` : tierLabel;
}

function derivePriceLabel(m: CurrentMember): string {
  if (m.tier === "founding") {
    return m.subscription_interval === "year" ? "$290 / year" : "$29 / month";
  }
  if (m.tier === "standard") {
    return m.subscription_interval === "year" ? "$990 / year" : "$99 / month";
  }
  return m.stripe_subscription_id ? "Active plan" : "Not subscribed";
}

function deriveStatusLabel(m: CurrentMember): string {
  switch (m.subscription_status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    case "incomplete":
      return "Incomplete";
    case "incomplete_expired":
      return "Expired";
    case "unpaid":
      return "Unpaid";
    case "paused":
      return "Paused";
    default:
      return m.stripe_subscription_id ? "Active" : "Not subscribed";
  }
}

function deriveStatusTone(m: CurrentMember): "leaf" | "gold" | "signal" | "ink" {
  switch (m.subscription_status) {
    case "active":
    case "trialing":
      return "leaf";
    case "past_due":
    case "unpaid":
      return "gold";
    case "canceled":
    case "incomplete_expired":
      return "signal";
    default:
      return "ink";
  }
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

function capitaliseFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
