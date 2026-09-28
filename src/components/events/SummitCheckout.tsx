"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

/**
 * Stripe embedded checkout for the summit trial. Kept in its own module so
 * Stripe.js (~250 KB compressed) and the React bindings are downloaded only
 * when a visitor has submitted the form and a client secret exists, never
 * on the initial load of the ad landing page.
 */
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function stripe(): Promise<Stripe | null> | null {
  if (!STRIPE_PK) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PK);
  return stripePromise;
}

export default function SummitCheckout({ clientSecret }: { clientSecret: string }) {
  const s = stripe();
  if (!s) return <div className="form-error">Checkout is not configured. Please contact support.</div>;
  return (
    <EmbeddedCheckoutProvider stripe={s} options={{ clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
