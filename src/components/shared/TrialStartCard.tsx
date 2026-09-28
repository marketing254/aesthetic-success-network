"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

/**
 * TrialStartCard — the standard-checkout-style "sign & pay" box shown
 * on first portal login. Modeled on the one-page checkout in the
 * e-sign proposal PDF:
 *
 *   Due today $0.00 · ramp summary · payment element ·
 *   agreement checkbox · "Agree and subscribe"
 *
 * The SetupIntent is prepared on mount so the payment element is
 * usually ready before the user finishes reading — no visible
 * "connecting" state, just a brief skeleton like any standard
 * checkout. The submit button stays disabled until the agreement box
 * is ticked.
 *
 * `audience` is kept for API compatibility; the card is neutral with a
 * navy primary action for both experts and companies.
 */
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const AGREEMENT_VERSION = "v1";

const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!STRIPE_PK) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PK);
  return stripePromise;
}

export default function TrialStartCard({
  prepareEndpoint,
  startEndpoint,
  audience: _audience,
  onSuccess,
}: {
  prepareEndpoint: string;
  startEndpoint: string;
  audience: "gold" | "green";
  onSuccess?: () => void;
}) {
  void _audience;
  // ASN has ONE Provider Agreement covering experts, partners and
  // expert+partner. The prepare endpoint may still override the link
  // (e.g. a versioned PDF), so it stays in state.
  const defaultAgreementLink = "/agreements/asn-provider-agreement.pdf";

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [agreementLink, setAgreementLink] = useState<string>(defaultAgreementLink);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  // Prepare the SetupIntent immediately on mount — by the time the user
  // has read the summary and ticked the box, the card fields are ready.
  // NOTE: no once-only ref guard here. React dev StrictMode mounts twice;
  // a ref guard makes the FIRST (discarded) mount own the fetch and the
  // second mount skip it — skeleton forever. Letting each mount fetch is
  // correct: the stale one is discarded via `cancelled`, and an abandoned
  // SetupIntent on Stripe's side is harmless.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(prepareEndpoint, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as {
          clientSecret?: string;
          agreementHref?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.clientSecret) {
          setPrepareError(body.error ?? "Payment setup is unavailable right now. Refresh to retry.");
          return;
        }
        if (body.agreementHref) setAgreementLink(body.agreementHref);
        setClientSecret(body.clientSecret);
      } catch {
        if (!cancelled) {
          setPrepareError("Payment setup is unavailable right now. Refresh to retry.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prepareEndpoint]);

  const stripeInstance = useMemo(() => getStripePromise(), []);

  return (
    <Box
      sx={{
        borderRadius: "8px",
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        overflow: "hidden",
        maxWidth: 560,
        mx: "auto",
      }}
    >
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>Start your membership</Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: MUTED, mb: 2 }}>
          Add a card and accept the agreement. Nothing is charged until month 7.
        </Typography>

        {/* Due today */}
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
          <Typography sx={{ fontSize: "0.875rem", color: BODY, fontWeight: 500 }}>Due today</Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 600, color: INK, lineHeight: 1 }}>$0.00</Typography>
        </Stack>

        {/* Ramp summary */}
        <Box sx={{ border: `1px solid ${LINE}`, borderRadius: "6px", px: 2, py: 1.25, mb: 2.5 }}>
          <RampLine label="Months 1 to 6" price="$0/mo" bold />
          <RampLine label="Months 7 to 12" price="$49/mo" />
          <RampLine label="Month 13 onward" price="$199/mo" />
        </Box>

        {/* Payment element — skeleton while it boots, no status text */}
        {prepareError ? (
          <Alert severity="error" sx={{ fontSize: "0.875rem", mb: 2, borderRadius: "6px" }}>
            {prepareError}
          </Alert>
        ) : clientSecret ? (
          <Elements
            stripe={stripeInstance}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: NAVY,
                  colorText: INK,
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <CheckoutInner startEndpoint={startEndpoint} agreementLink={agreementLink} onSuccess={onSuccess} />
          </Elements>
        ) : (
          <PaymentSkeleton />
        )}
      </Box>

      {/* Footer strip */}
      <Box sx={{ borderTop: `1px solid ${LINE}`, bgcolor: "#F9FAFB", px: 3, py: 1.25 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "center" }}>
          <LockRoundedIcon sx={{ fontSize: 13, color: MUTED }} />
          <Typography sx={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
            Secured by Stripe. Billing starts at month 7. A copy of your agreement is emailed to you.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

/** Grey placeholder matching the PaymentElement's footprint — standard
 *  checkout skeleton, no "connecting…" copy. */
function PaymentSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" height={44} sx={{ mb: 1.25, borderRadius: "8px" }} />
      <Stack direction="row" spacing={1.25} sx={{ mb: 1.25 }}>
        <Skeleton variant="rounded" height={44} sx={{ flex: 1, borderRadius: "8px" }} />
        <Skeleton variant="rounded" height={44} sx={{ flex: 1, borderRadius: "8px" }} />
      </Stack>
      <Skeleton variant="rounded" height={44} sx={{ mb: 2, borderRadius: "8px" }} />
      <Skeleton variant="rounded" height={24} width="70%" sx={{ mb: 2, borderRadius: "6px" }} />
      <Skeleton variant="rounded" height={40} sx={{ borderRadius: "6px" }} />
    </Box>
  );
}

function CheckoutInner({
  startEndpoint,
  agreementLink,
  onSuccess,
}: {
  startEndpoint: string;
  agreementLink: string;
  onSuccess?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !agreed) return;
    setBusy(true);
    setError(null);

    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message ?? "Your card couldn't be saved. Try again.");
      setBusy(false);
      return;
    }
    if (
      !setupIntent ||
      setupIntent.status !== "succeeded" ||
      typeof setupIntent.payment_method !== "string"
    ) {
      setError("Your card couldn't be saved. Try again.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(startEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupIntentId: setupIntent.id,
          paymentMethodId: setupIntent.payment_method,
          agreementVersion: AGREEMENT_VERSION,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Something went wrong on our side. Try again.");
        setBusy(false);
        return;
      }
      if (onSuccess) onSuccess();
      window.location.reload();
    } catch {
      setError("Something went wrong on our side. Try again.");
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <PaymentElement options={{ layout: "tabs" }} />

      {/* Agreement — one compact terms row between the card fields and
          the button, like a standard checkout. Checkbox top-aligns to
          the first line of text; the agreement name is the direct link
          to the PDF. */}
      <Box sx={{ mt: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          size="small"
          disableRipple
          sx={{ p: 0, mt: "1px", color: "#9CA3AF", "&.Mui-checked": { color: NAVY } }}
          slotProps={{ input: { "aria-label": "Agree to the ASN Provider Agreement" } }}
        />
        <Typography sx={{ fontSize: "0.8125rem", color: BODY, lineHeight: 1.55 }}>
          I agree to the{" "}
          <Box
            component={Link}
            href={agreementLink}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: NAVY, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            ASN Provider Agreement ({AGREEMENT_VERSION})
          </Box>
          {" "}(<Box
            component={Link}
            href="/agreement/provider"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: NAVY, textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            read online
          </Box>).
        </Typography>
      </Box>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disableElevation
        disabled={!stripe || !elements || !agreed || busy}
        sx={{
          mt: 2,
          borderRadius: "6px",
          minHeight: 40,
          fontSize: "0.875rem",
          fontWeight: 500,
          textTransform: "none",
          bgcolor: NAVY,
          color: "#FFFFFF",
          backgroundImage: "none",
          boxShadow: "none",
          "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "none", transform: "none" },
          "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF", backgroundImage: "none" },
        }}
        startIcon={busy ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : null}
      >
        {busy ? "Processing..." : "Agree and subscribe"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5, fontSize: "0.8125rem", borderRadius: "6px" }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

function RampLine({ label, price, bold }: { label: string; price: string; bold?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.35 }}>
      <Typography sx={{ fontSize: "0.875rem", color: bold ? INK : BODY, fontWeight: bold ? 600 : 400 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.875rem", color: bold ? INK : BODY, fontWeight: bold ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
        {price}
      </Typography>
    </Stack>
  );
}
