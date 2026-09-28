import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/billing/trial/prepare
 *
 * First half of the "add card in portal" flow. Ensures a Stripe
 * customer exists for the signed-in vendor and returns a SetupIntent
 * client_secret so <PaymentElement> can render.
 *
 * No subscription is created here — that happens in /start once the
 * card is confirmed on the client.
 */
export async function POST() {
  const guard = await requireVendor();
  if (!guard.ok) return guard.response;

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/vendor/billing/trial/prepare", status: 503 });
  }

  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id, contact_email, billing_email, company_name, contact_name, stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", guard.vendorId)
    .maybeSingle();
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  }
  if (
    vendor.stripe_subscription_id &&
    (vendor.subscription_status === "active" || vendor.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      { error: "You already have an active subscription." },
      { status: 409 },
    );
  }

  let customerId = vendor.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: vendor.billing_email ?? vendor.contact_email,
      name: vendor.company_name || vendor.contact_name || undefined,
      metadata: { audience: "vendor", vendor_id: vendor.id },
    });
    customerId = customer.id;
    await sb
      .from("vendors")
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", vendor.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: { audience: "vendor", vendor_id: vendor.id, purpose: "trial_start" },
  });
  if (!setupIntent.client_secret) {
    return NextResponse.json(
      { error: "Stripe didn't return a client secret. Try again." },
      { status: 500 },
    );
  }

  // Serve the right agreement: if this same email is ALSO an expert
  // (an experts row exists), they get the combined Expert + Partner
  // agreement — one fee covers both roles. Otherwise the Partner one.
  const { data: alsoExpert } = await sb
    .from("experts")
    .select("id")
    .eq("email", (vendor.contact_email ?? "").toLowerCase())
    .maybeSingle();
  const agreementHref = alsoExpert
    ? "/agreements/asn-provider-agreement.pdf"
    : "/agreements/asn-provider-agreement.pdf";

  return NextResponse.json({ clientSecret: setupIntent.client_secret, agreementHref });
}
