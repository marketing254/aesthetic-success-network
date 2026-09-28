import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireVendor } from "@/lib/auth/guards";
import {
  ALL_PARTNER_PLAN_KEYS,
  appOrigin,
  getStripe,
  partnerPriceIdFor,
  type PartnerPlanKey,
} from "@/lib/stripe";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/billing/checkout
 *
 * Body: { plan: "partner_growth_monthly" | "partner_standard_monthly" | "partner_standard_annual" }
 *
 * Creates a Stripe Checkout Session for a partner subscription and
 * returns the redirect URL. Used by the Upgrade card on /vendor/account
 * once the founding waiver runs out.
 *
 * Note: there's no `partner_launch_monthly` option — the launch phase
 * (months 1-6) is admin-activated and doesn't touch Stripe at all.
 * Partners only see this endpoint when the upgrade UI appears.
 */
function isValidPlan(p: unknown): p is PartnerPlanKey {
  return typeof p === "string" && (ALL_PARTNER_PLAN_KEYS as string[]).includes(p);
}

export async function POST(req: Request) {
  const guard = await requireVendor();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isValidPlan(body.plan)) {
    return NextResponse.json({ error: "Please pick a valid plan." }, { status: 400 });
  }
  const plan = body.plan;

  const sb = getSupabaseAdmin();
  const { data: vendor, error: vErr } = await sb
    .from("vendors")
    .select(
      "id, contact_email, billing_email, company_name, contact_name, stripe_customer_id, stripe_subscription_id, subscription_status",
    )
    .eq("id", guard.vendorId)
    .single();

  if (vErr || !vendor) {
    return NextResponse.json({ error: "Vendor record not found." }, { status: 404 });
  }

  if (
    vendor.stripe_subscription_id &&
    (vendor.subscription_status === "active" || vendor.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      {
        error: "You already have an active subscription. Use 'Manage subscription' to switch plans.",
        redirectTo: "/api/vendor/billing/portal",
      },
      { status: 409 },
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripe();
    priceId = partnerPriceIdFor(plan);
  } catch (err) {
    return serverError(err, { route: "POST /api/vendor/billing/checkout", status: 503 });
  }

  // Reuse the Stripe customer if one exists; otherwise create + persist.
  // We prefer billing_email if the partner specified one, falling back
  // to the contact_email used to sign in.
  let customerId = vendor.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: vendor.billing_email ?? vendor.contact_email,
      name: vendor.company_name || vendor.contact_name || undefined,
      metadata: { vendor_id: vendor.id, audience: "vendor" },
    });
    customerId = customer.id;
    await sb
      .from("vendors")
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", vendor.id);
  }

  const origin = appOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: {
        vendor_id: vendor.id,
        audience: "vendor",
        plan,
      },
    },
    metadata: {
      vendor_id: vendor.id,
      audience: "vendor",
      plan,
    },
    success_url: `${origin}/vendor/account?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/vendor/account?subscribed=0`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe couldn't open the checkout. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
