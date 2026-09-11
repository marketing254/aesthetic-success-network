"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Box, Button, Checkbox, FormControlLabel, Link as MuiLink, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/components/portal/ui";

const AGREEMENT_VERSION = "v1";

let stripePromise: Promise<StripeJs | null> | null = null;
function getStripeJs() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
  }
  return stripePromise;
}

function Inner({
  startEndpoint,
  agreementHref,
  onSuccess,
}: {
  startEndpoint: string;
  agreementHref: string;
  onSuccess?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !agreed) return;
    setBusy(true);
    setError(null);

    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (confirmError || !setupIntent) {
      setError(confirmError?.message ?? "Couldn't confirm your card.");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start your trial.");
      onSuccess?.();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Due today: $0.00</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Months 1–6 are free. Then $49/month (locked rate) for months 7–12, then $199/month from month 13.
          </Typography>
        </Box>

        <PaymentElement />

        <FormControlLabel
          control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
          label={
            <Typography variant="body2">
              I agree to the{" "}
              <MuiLink href={agreementHref} target="_blank" rel="noreferrer">
                agreement
              </MuiLink>
              , including the founding-rate terms above.
            </Typography>
          }
        />

        {error && (
          <Typography variant="body2" sx={{ color: "error.main" }}>
            {error}
          </Typography>
        )}

        <Button type="submit" variant="contained" size="large" disabled={!stripe || !agreed || busy} sx={{ alignSelf: "flex-start" }}>
          Add card &amp; start
        </Button>
      </Stack>
    </Box>
  );
}

export function TrialStartCard({
  prepareEndpoint,
  startEndpoint,
  onSuccess,
}: {
  prepareEndpoint: string;
  startEndpoint: string;
  onSuccess?: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [agreementHref, setAgreementHref] = useState<string>("/provider-agreement");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(prepareEndpoint, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.clientSecret) setClientSecret(data.clientSecret);
        if (data.agreementHref) setAgreementHref(data.agreementHref);
        if (data.error) setError(data.error);
      })
      .catch(() => active && setError("Couldn't start billing setup."));
    return () => {
      active = false;
    };
  }, [prepareEndpoint]);

  return (
    <SectionCard title="Add your billing details">
      {error && (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          {error}
        </Typography>
      )}
      {!clientSecret && !error && <Typography variant="body2">Loading…</Typography>}
      {clientSecret && (
        <Elements stripe={getStripeJs()} options={{ clientSecret }}>
          <Inner startEndpoint={startEndpoint} agreementHref={agreementHref} onSuccess={onSuccess} />
        </Elements>
      )}
    </SectionCard>
  );
}
