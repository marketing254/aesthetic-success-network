import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExpert } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expert/billing/sync
 *
 * Re-syncs the expert's subscription state directly from Stripe and
 * writes it onto the experts row. Used as an escape hatch when the
 * webhook didn't fire (wrong secret, broken URL, network glitch) — the
 * expert sees a "Re-sync from Stripe" button when their plan card looks
 * out of date.
 *
 * Safe to call repeatedly. Won't touch the row if there's no Stripe
 * subscription on the customer.
 */
export async function POST() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb
    .from("experts")
    .select("id, stripe_customer_id")
    .eq("id", guard.expertId)
    .single();

  if (!expert?.stripe_customer_id) {
    return NextResponse.json(
      {
        synced: false,
        reason:
          "No Stripe customer on file. Activate your subscription first; if you already paid, email partners@aestheticsuccessnetwork.com.",
      },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[api:error] POST /api/expert/billing/sync (503)", err);
    return NextResponse.json(
      { synced: false, reason: "Billing service is unavailable right now. Please try again shortly." },
      { status: 503 },
    );
  }

  const list = await stripe.subscriptions.list({
    customer: expert.stripe_customer_id,
    status: "all",
    limit: 5,
    expand: ["data.default_payment_method", "data.items.data.price"],
  });

  if (list.data.length === 0) {
    return NextResponse.json({
      synced: false,
      reason: "No subscriptions found on this Stripe customer.",
    });
  }

  const ranked = list.data.slice().sort((a, b) => {
    const aActive = a.status === "active" || a.status === "trialing" ? 1 : 0;
    const bActive = b.status === "active" || b.status === "trialing" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.created - a.created;
  });
  const sub = ranked[0];

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const interval = sub.items.data[0]?.price?.recurring?.interval ?? null;
  const pm =
    typeof sub.default_payment_method === "object" && sub.default_payment_method
      ? sub.default_payment_method
      : null;
  const card = pm?.card ?? null;

  const periodEnd =
    typeof sub.items.data[0]?.current_period_end === "number"
      ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      : null;

  try {
    const { error } = await sb
      .from("experts")
      .update({
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        subscription_status: sub.status,
        subscription_interval: interval,
        current_period_end: periodEnd,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        card_brand: card?.brand ?? null,
        card_last4: card?.last4 ?? null,
      } as never)
      .eq("id", expert.id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[api:error] POST /api/expert/billing/sync (500)", err);
    return NextResponse.json(
      { synced: false, reason: "Sync failed. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    synced: true,
    status: sub.status,
    interval,
  });
}
