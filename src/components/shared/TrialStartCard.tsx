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
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

/**
 * TrialStartCard: the checkout-style "sign and pay" box shown on first
 * portal login. Modeled on the one-page checkout in the e-sign proposal:
 *
 *   Due today $0.00 · ramp summary · payment element ·
 *   agreement checkbox · "Agree and subscribe"
 *
 * The SetupIntent is prepared on mount so the payment element is usually
 * ready before the user finishes reading: no visible "connecting" state,
 * just a brief skeleton like any standard checkout. The submit button
 * stays disabled until the agreement box is ticked.
 *
 * `audience` picks the benefits list AND the ramp ("green" = expert,
 * "gold" = company). Every provider: free founding months (6 from the
 * member launch), then $39 (experts: flat; companies: $39 x 12 then $149
 * on the ladder plan, or $39 flat). Nothing
 * is charged today. The card itself uses the community palette for both.
 */
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
/** One calm message for anything that is not a card problem the person can fix. */
const STD_ERR = "We couldn't save your card. Nothing was charged. Please try again in a moment, and if it keeps happening email support@aestheticsuccessnetwork.com.";
const AGREEMENT_VERSION = "v1";

const NAVY = "#0A1320";
const NAVY_HOVER = "#141F30";
const INK = "#0A1320";
const BODY = "#3B4451";
const MUTED = "#6B7280";
const LINE = "rgba(10,19,32,0.06)";
const SAND = "#F3EBDD";
const SAND_SOFT = "#F8F4EC";
const GOLD = "#D9A84B";
const GOLD_TEXT = "#7A5B17";
const SHADOW = "0 1px 2px rgba(10,19,32,0.04), 0 8px 24px -16px rgba(10,19,32,0.12)";

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
  rate,
  onSuccess,
}: {
  prepareEndpoint: string;
  startEndpoint: string;
  audience: "gold" | "green";
  /** Company plan: "ladder" (default) or "flat". Ignored for experts. */
  rate?: string;
  onSuccess?: () => void;
}) {
  const expertCard = _audience === "green";
  const flatCompany = rate === "flat" || rate === "flat_49";
  // ASN has ONE Provider Agreement covering experts, companies and
  // expert+company. The prepare endpoint may still override the link
  // (e.g. a versioned PDF), so it stays in state.
  const defaultAgreementLink = "/agreements/asn-provider-agreement.pdf";

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [agreementLink, setAgreementLink] = useState<string>(defaultAgreementLink);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  // Prepare the SetupIntent immediately on mount. By the time the user
  // has read the summary and ticked the box, the card fields are ready.
  // NOTE: no once-only ref guard here. React dev StrictMode mounts twice;
  // a ref guard makes the FIRST (discarded) mount own the fetch and the
  // second mount skip it: skeleton forever. Letting each mount fetch is
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
    <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start", justifyContent: "center" }}>
    <Box
      sx={{
        borderRadius: "16px",
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        boxShadow: SHADOW,
        overflow: "hidden",
        maxWidth: 560,
        width: "100%",
        minWidth: 0,
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em", color: INK, mb: 0.5 }}>
          {_audience === "green" ? "Start your membership" : "Start your company membership"}
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: MUTED, mb: 2.5, lineHeight: 1.55 }}>
          Save a card and accept the agreement. Nothing is charged until your free founding months end, and we remind you 7 days before.
        </Typography>

        {/* Due today */}
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "baseline",
            mb: 2,
            px: 2,
            py: 1.5,
            borderRadius: "12px",
            bgcolor: SAND,
          }}
        >
          <Typography sx={{ fontSize: "0.875rem", color: GOLD_TEXT, fontWeight: 600 }}>Due today</Typography>
          <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            $0.00
          </Typography>
        </Stack>

        {/* Terms: free founding months, then the flat rate */}
        <Box sx={{ border: `1px solid ${LINE}`, borderRadius: "12px", px: 2, py: 1.25, mb: 2.5 }}>
          <RampLine label="First 6 months, from member launch" price="$0/mo" bold />
          {expertCard || flatCompany ? (
            <RampLine label="After that, no increase" price="$39/mo" />
          ) : (
            <>
              <RampLine label="Next 12 months, launch rate" price="$39/mo" />
              <RampLine label="After that, standard rate" price="$149/mo" />
            </>
          )}
        </Box>

        {/* Payment element: skeleton while it boots, no status text */}
        {prepareError ? (
          <Alert severity="error" sx={{ fontSize: "0.875rem", mb: 2, borderRadius: "12px" }}>
            {prepareError}
          </Alert>
        ) : clientSecret ? (
          <Elements
            stripe={stripeInstance}
            options={{
              clientSecret,
              fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" }],
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: NAVY,
                  colorText: INK,
                  colorTextSecondary: MUTED,
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  borderRadius: "10px",
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
      <Box sx={{ borderTop: `1px solid ${LINE}`, bgcolor: SAND_SOFT, px: 3, py: 1.25 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "center" }}>
          <LockRoundedIcon sx={{ fontSize: 13, color: MUTED }} />
          <Typography sx={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
            Secured by Stripe. Billing starts when your free founding months end. A copy of your agreement is emailed to you.
          </Typography>
        </Stack>
      </Box>
    </Box>
    <BenefitsPanel audience={_audience} flat={expertCard || flatCompany} />
    </Stack>
  );
}

/** Placeholder matching the PaymentElement's footprint: standard checkout
 *  skeleton, no "connecting" copy. */
function PaymentSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" height={44} sx={{ mb: 1.25, borderRadius: "10px" }} />
      <Stack direction="row" spacing={1.25} sx={{ mb: 1.25 }}>
        <Skeleton variant="rounded" height={44} sx={{ flex: 1, borderRadius: "10px" }} />
        <Skeleton variant="rounded" height={44} sx={{ flex: 1, borderRadius: "10px" }} />
      </Stack>
      <Skeleton variant="rounded" height={44} sx={{ mb: 2, borderRadius: "10px" }} />
      <Skeleton variant="rounded" height={24} width="70%" sx={{ mb: 2, borderRadius: "8px" }} />
      <Skeleton variant="rounded" height={44} sx={{ borderRadius: "10px" }} />
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

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: "if_required",
    });
    // A retry after a server-side hiccup finds the SetupIntent already
    // confirmed; Stripe reports that as an error that carries the intent.
    const already = result.error?.setup_intent;
    const setupIntent = result.setupIntent ?? (already && already.status === "succeeded" ? already : undefined);
    if (!setupIntent) {
      setError(result.error?.type === "card_error" || result.error?.type === "validation_error" ? (result.error.message ?? STD_ERR) : STD_ERR);
      setBusy(false);
      return;
    }
    if (setupIntent.status !== "succeeded" || typeof setupIntent.payment_method !== "string") {
      setError(STD_ERR);
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
        setError(body.error ?? STD_ERR);
        setBusy(false);
        return;
      }
      if (onSuccess) onSuccess();
      window.location.reload();
    } catch {
      setError(STD_ERR);
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <PaymentElement options={{ layout: "tabs" }} />

      {/* Agreement: one compact terms row between the card fields and the
          button, like a standard checkout. Checkbox top-aligns to the
          first line of text; the agreement name is the direct link to
          the PDF. */}
      <Box sx={{ mt: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          size="small"
          disableRipple
          sx={{ p: 0, mt: "1px", color: "#9AA3AF", "&.Mui-checked": { color: NAVY } }}
          slotProps={{ input: { "aria-label": "Agree to the ASN Provider Agreement" } }}
        />
        <Typography sx={{ fontSize: "0.8125rem", color: BODY, lineHeight: 1.55 }}>
          I agree to the{" "}
          <Box
            component={Link}
            href={agreementLink}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: NAVY, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            ASN Provider Agreement
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
          borderRadius: "10px",
          minHeight: 44,
          fontSize: "0.9375rem",
          fontWeight: 600,
          textTransform: "none",
          bgcolor: NAVY,
          color: "#FFFFFF",
          backgroundImage: "none",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
          "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)", transform: "translateY(-1px)" },
          "&.Mui-disabled": { bgcolor: "#E6E2D9", color: "#9AA3AF", backgroundImage: "none", boxShadow: "none" },
        }}
        startIcon={busy ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : null}
      >
        {busy ? "Processing..." : "Agree and subscribe"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5, fontSize: "0.8125rem", borderRadius: "12px" }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

function RampLine({ label, price, bold }: { label: string; price: string; bold?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", py: 0.45 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {bold && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: GOLD }} />}
        <Typography sx={{ fontSize: "0.875rem", color: bold ? INK : BODY, fontWeight: bold ? 600 : 400 }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: "0.875rem", color: bold ? INK : BODY, fontWeight: bold ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>
        {price}
      </Typography>
    </Stack>
  );
}

/** What the card pays for, listed beside the payment form so the person
 *  knows exactly what they get. Audience "green" = expert, "gold" = company. */
function BenefitsPanel({ audience, flat }: { audience: "gold" | "green"; flat: boolean }) {
  const expert = audience === "green";
  const items = expert
    ? [
        "Featured profile on the expert bench, seen by every member",
        "One recording becomes a full kit: training video, action guide, checklist, worksheet, slide deck",
        "Every kit carries your booking link, so members book straight onto your calendar",
        "Post updates to the network feed and answer member inquiries",
        "Sell your own courses and products to members and keep the full price (members buy on your site; the one condition is a member-only offer)",
        "Refer and earn: $50 per referred member, paid after their first payment",
      ]
    : [
        "Company profile with your logo and member-only offer, placed in your category",
        "Offers with promo codes and a redemptions dashboard",
        "Member leads routed to you with conversion data",
        "Verified Company badge for your marketing",
        "Co-marketing features across the Business of Aesthetics network",
        "Refer and earn: $50 per referred member, paid after their first payment",
      ];
  return (
    <Box
      sx={{
        borderRadius: "16px",
        bgcolor: SAND,
        border: "1px solid rgba(217,168,75,0.35)",
        p: 3,
        width: "100%",
        maxWidth: { xs: 560, md: 360 },
      }}
    >
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK, mb: 0.5 }}>What your membership includes</Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: BODY, mb: 2, lineHeight: 1.55 }}>
        {`${flat ? "Your first 6 months are free, starting the day we open to members. After that it's $39 a month, and it stays $39 with no increase." : "Your first 6 months are free, starting the day we open to members. After that it's $39 a month for your first 12 months, then $149 a month."} Cancel before your first charge and you won't be charged; after that, 30 days' notice.`}
      </Typography>
      <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {items.map((t) => (
          <Stack key={t} component="li" direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                bgcolor: "#FFFFFF",
                color: GOLD_TEXT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                mt: "1px",
                border: "1px solid rgba(217,168,75,0.5)",
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 13 }} />
            </Box>
            <Typography sx={{ fontSize: "0.875rem", color: BODY, lineHeight: 1.5 }}>{t}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
