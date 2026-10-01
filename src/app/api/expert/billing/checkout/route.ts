import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExpert } from "@/lib/auth/guards";
import {
  ALL_EXPERT_PLAN_KEYS,
  appOrigin,
  expertPriceIdFor,
  getStripe,
  type ExpertPlanKey,
} from "@/lib/stripe";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expert/billing/checkout
 *
 * Body: { plan: "expert_growth_monthly" | "expert_standard_monthly" | "expert_standard_annual" }
 *
 * Creates a Stripe Checkout Session for an expert subscription and
 * returns the redirect URL. Used by the Upgrade card on /expert/billing
 * once the founding waiver runs out.
 *
 * Note: there's deliberately no `expert_launch_monthly` option here —
 * the launch phase (months 1-6) is admin-activated and doesn't touch
 * Stripe at all. Experts only see this endpoint when the upgrade UI
 * appears.
 */
function isValidPlan(p: unknown): p is ExpertPlanKey {
  return typeof p === "string" && (ALL_EXPERT_PLAN_KEYS as string[]).includes(p);
}

export async function POST(req: Request) {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isValidPlan(body.plan)) {
    return NextResponse.json({ error: "Please pick a valid plan." }, { status: 400 });
  }
  const plan = body.plan;

  const sb = getSupabaseAdmin();
  const { data: expert, error: expertErr } = await sb
    .from("experts")
    .select(
      "id, email, full_name, stripe_customer_id, stripe_subscription_id, subscription_status",
    )
    .eq("id", guard.expertId)
    .single();

  if (expertErr || !expert) {
    return NextResponse.json({ error: "Expert record not found." }, { status: 404 });
  }

  // Don't double-charge an active sub — send them to the portal to switch.
  if (
    expert.stripe_subscription_id &&
    (expert.subscription_status === "active" || expert.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      {
        error: "You already have an active subscription. Use 'Manage subscription' to switch plans.",
        redirectTo: "/api/expert/billing/portal",
      },
      { status: 409 },
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripe();
    priceId = expertPriceIdFor(plan);
  } catch (err) {
    return serverError(err, { route: "POST /api/expert/billing/checkout", status: 503 });
  }

  // Reuse Stripe customer if one exists, otherwise create + persist.
  let customerId = expert.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: expert.email,
      name: expert.full_name || undefined,
      metadata: { expert_id: expert.id, audience: "expert" },
    });
    customerId = customer.id;
    await sb
      .from("experts")
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", expert.id);
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
        expert_id: expert.id,
        audience: "expert",
        plan,
      },
    },
    metadata: {
      expert_id: expert.id,
      audience: "expert",
      plan,
    },
    success_url: `${origin}/expert/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/expert/billing?subscribed=0`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe couldn't open the checkout. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
