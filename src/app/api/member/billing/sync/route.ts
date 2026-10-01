import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/guards";
import { applySubscriptionToMember } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/billing/sync
 *
 * Reads the member's most recent subscription directly from Stripe and
 * writes the canonical state onto the members row. Used as an escape
 * hatch when the webhook didn't fire (e.g. wrong webhook secret, broken
 * URL, network glitch) — the member sees a "Re-sync from Stripe" button
 * in the billing UI when their plan card looks out of date.
 *
 * Safe to call repeatedly. Won't touch the row if there's no Stripe
 * subscription on the customer.
 */
export async function POST() {
  const guard = await requireMember();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: member } = await sb
    .from("members")
    .select("id, stripe_customer_id")
    .eq("id", guard.memberId)
    .single();

  if (!member?.stripe_customer_id) {
    return NextResponse.json(
      {
        synced: false,
        reason:
          "No Stripe customer on file. Start a subscription first; if you already paid, email members@aestheticsuccessnetwork.com.",
      },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[api:error] POST /api/member/billing/sync (503)", err);
    return NextResponse.json(
      { synced: false, reason: "Billing service is unavailable right now. Please try again shortly." },
      { status: 503 },
    );
  }

  // Pull every subscription on the customer (we don't filter by status —
  // a `canceled` or `incomplete` sub is still useful to mirror).
  const list = await stripe.subscriptions.list({
    customer: member.stripe_customer_id,
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

  // Prefer an active/trialing one; otherwise the most recently created.
  const ranked = list.data.slice().sort((a, b) => {
    const aActive = a.status === "active" || a.status === "trialing" ? 1 : 0;
    const bActive = b.status === "active" || b.status === "trialing" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.created - a.created;
  });
  const sub = ranked[0];

  try {
    await applySubscriptionToMember(sb, member.id, sub, stripe);
  } catch (err) {
    console.error("[api:error] POST /api/member/billing/sync (500)", err);
    return NextResponse.json(
      { synced: false, reason: "Sync failed. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    synced: true,
    status: sub.status,
    interval: sub.items.data[0]?.price?.recurring?.interval ?? null,
  });
}
