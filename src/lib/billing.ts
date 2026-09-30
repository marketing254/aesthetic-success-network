import type Stripe from "stripe";
import type { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Shared subscription-sync helpers used by both:
 *
 *   - /api/stripe/webhook   (authoritative path — fires on every event)
 *   - /api/member/billing/sync   (manual recovery path — used when the
 *                                  webhook didn't fire for any reason)
 *
 * Anything that mirrors Stripe state onto the members row should live
 * here so the two paths never drift.
 */

type SupabaseClient = ReturnType<typeof getSupabaseAdmin>;

/**
 * Look up the member id for a Stripe customer id. Falls back to a
 * member_id passed via subscription metadata if we haven't yet stored
 * the mapping (this can happen if checkout finished but the webhook
 * raced ahead of the customer-id update from the checkout handler).
 */
export async function memberIdForCustomer(
  sb: SupabaseClient,
  customerId: string,
  fallbackMemberId?: string | null,
): Promise<string | null> {
  const { data } = await sb
    .from("members")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? fallbackMemberId ?? null;
}

/**
 * Write the full subscription shadow onto the members row. Idempotent —
 * safe to call repeatedly. Handles the founding-lock invariant so we
 * never undo a member's locked rate.
 *
 * Pass `stripe` when available — it's used to fall back to the customer's
 * default payment method when the subscription's own is null (typical for
 * Checkout-created subs in modern API versions).
 */
export async function applySubscriptionToMember(
  sb: SupabaseClient,
  memberId: string,
  sub: Stripe.Subscription,
  stripe?: Stripe,
): Promise<void> {
  const firstItem = sub.items.data[0];
  const price = firstItem?.price;
  const status = sub.status;
  // In API version 2025-03-31+ the period fields live on each
  // subscription item. ASN subs only ever have a single item.
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;
  const canceledAt = sub.canceled_at
    ? new Date(sub.canceled_at * 1000).toISOString()
    : null;
  const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
  const interval = price?.recurring?.interval ?? null;
  const isFoundingMeta = sub.metadata?.founding_member === "true";
  const isEarlyMeta = sub.metadata?.early_member === "true";
  // Fall back to subscription.metadata.tier if the boolean flags are missing
  // (older sessions or manual Stripe edits). `tier` is also written by the
  // checkout route for every new sub.
  const tierMeta = (sub.metadata?.tier as "founding" | "early" | "standard" | undefined) ?? null;

  // Card metadata. The subscription's own default_payment_method is
  // often null for Checkout-created subs — the PM lives on the customer's
  // invoice_settings.default_payment_method instead. Try the sub first,
  // then fall back to the customer.
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  if (sub.default_payment_method && typeof sub.default_payment_method !== "string") {
    const pm = sub.default_payment_method;
    if (pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }
  }
  if ((!cardBrand || !cardLast4) && stripe) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method"],
        });
        if (!customer.deleted) {
          const pm = customer.invoice_settings?.default_payment_method;
          if (pm && typeof pm !== "string" && pm.card) {
            cardBrand = pm.card.brand ?? null;
            cardLast4 = pm.card.last4 ?? null;
          }
        }
      } catch {
        /* best-effort hydration */
      }
    }
  }

  const { data: current } = await sb
    .from("members")
    .select("founding_member_locked, early_member_locked, tier")
    .eq("id", memberId)
    .single();

  type MemberPatch = {
    stripe_subscription_id?: string | null;
    stripe_price_id?: string | null;
    subscription_status?: string | null;
    subscription_interval?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    canceled_at?: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
    founding_member_locked?: boolean;
    early_member_locked?: boolean;
    tier?: string;
    status?: "waitlist" | "invited" | "active" | "paused" | "churned";
  };

  const patch: MemberPatch = {
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    subscription_status: status,
    subscription_interval: interval,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: canceledAt,
    card_brand: cardBrand,
    card_last4: cardLast4,
  };

  // Lock the tier on first successful sub. Once locked, never reset — that's
  // the cancellation-doesn't-free-a-seat invariant. tierMeta is the
  // ground truth from checkout (it's set on every new session).
  if ((isFoundingMeta || tierMeta === "founding") && !current?.founding_member_locked) {
    patch.founding_member_locked = true;
    if (current?.tier !== "founding") patch.tier = "founding";
  } else if ((isEarlyMeta || tierMeta === "early") && !current?.early_member_locked) {
    patch.early_member_locked = true;
    if (current?.tier !== "early" && current?.tier !== "founding") patch.tier = "early";
  } else if (tierMeta === "standard" && !current?.tier) {
    patch.tier = "standard";
  }

  if (status === "active" || status === "trialing") {
    patch.status = "active";
  }

  await sb.from("members").update(patch).eq("id", memberId);

  // Referral conversion — when the subscription transitions to a paid
  // state for the first time, stamp converted_at on the matching
  // referral_signups row so the admin dashboard counts it. Best-effort.
  if (status === "active" || status === "trialing") {
    try {
      await sb
        .from("referral_signups")
        .update({ converted_at: new Date().toISOString() })
        .eq("member_id", memberId)
        .is("converted_at", null);
    } catch {
      /* analytics best-effort */
    }
  }
}

// =====================================================================
// BUSINESS AUDIENCES — partners (vendors) + experts
// =====================================================================
//
// Historically the webhook only mirrored MEMBER subscriptions; vendor and
// expert rows were written once at checkout and never updated again. That
// meant a cancellation or card change made in the Stripe Dashboard never
// reached the DB, so `subscription_status` silently drifted from reality.
// These two helpers close that gap using the same column set 0033 added
// to both tables.

export type BusinessRef = {
  table: "vendors" | "experts";
  id: string;
  /** experts only — billing-exempt expert (manual admin override). */
  billingExempt: boolean;
};

/**
 * Resolve a Stripe customer (and, when known, the subscription) to the
 * vendor or expert row that owns it.
 *
 * A dual-role founding person (expert + company) has TWO subscriptions on
 * ONE customer: the expert trial subscription mirrored on `experts`, and
 * the company schedule mirrored on `vendors`. So when a subscription id is
 * supplied we match on `stripe_subscription_id` first, and only fall back
 * to the customer id (vendors first, then experts) for rows that have not
 * stored a subscription yet.
 *
 * Returns null when nothing matches, or when the only match is a
 * billing-exempt expert (see applySubscriptionToBusiness).
 */
export async function businessForCustomer(
  sb: SupabaseClient,
  customerId: string,
  subscriptionId?: string | null,
): Promise<BusinessRef | null> {
  if (subscriptionId) {
    const { data: vBySub } = await sb
      .from("vendors")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (vBySub) return { table: "vendors", id: vBySub.id, billingExempt: false };
    const { data: eBySub } = await sb
      .from("experts")
      .select("id, billing_exempt")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (eBySub) return { table: "experts", id: eBySub.id, billingExempt: !!eBySub.billing_exempt };
  }

  const { data: vendor } = await sb
    .from("vendors")
    .select("id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  // A vendor row already bound to a DIFFERENT subscription must not absorb
  // events from the expert-side subscription on the same customer.
  if (vendor && !(subscriptionId && vendor.stripe_subscription_id && vendor.stripe_subscription_id !== subscriptionId)) {
    return { table: "vendors", id: vendor.id, billingExempt: false };
  }

  const { data: expert } = await sb
    .from("experts")
    .select("id, billing_exempt, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (expert && !(subscriptionId && expert.stripe_subscription_id && expert.stripe_subscription_id !== subscriptionId)) {
    return { table: "experts", id: expert.id, billingExempt: !!expert.billing_exempt };
  }
  return null;
}

/**
 * Mirror a Stripe subscription onto a vendors / experts row.
 *
 * Two deliberate safety properties:
 *
 *  1. A billing-exempt expert is NEVER written to. The exemption is a
 *     manual admin override; re-attaching a customer/subscription to
 *     their row would resurrect the paywall and the trial-ending emails.
 *
 *  2. Card brand/last4 are only written when we actually resolved them.
 *     If hydration fails we leave whatever is already on the row rather
 *     than nulling it — losing a live partner's card details on a
 *     transient Stripe hiccup would be a real regression.
 */
export async function applySubscriptionToBusiness(
  sb: SupabaseClient,
  ref: BusinessRef,
  sub: Stripe.Subscription,
  stripe?: Stripe,
): Promise<void> {
  if (ref.table === "experts" && ref.billingExempt) return;

  const firstItem = sub.items.data[0];
  const price = firstItem?.price;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  if (sub.default_payment_method && typeof sub.default_payment_method !== "string") {
    const pm = sub.default_payment_method;
    if (pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }
  }
  if ((!cardBrand || !cardLast4) && stripe) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method"],
        });
        if (!customer.deleted) {
          const pm = customer.invoice_settings?.default_payment_method;
          if (pm && typeof pm !== "string" && pm.card) {
            cardBrand = pm.card.brand ?? null;
            cardLast4 = pm.card.last4 ?? null;
          }
        }
      } catch {
        /* best-effort hydration — keep whatever is already stored */
      }
    }
  }

  // Both `vendors` and `experts` carry this identical column set (0033).
  const patch: {
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    subscription_status: string | null;
    subscription_interval: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
  } = {
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    subscription_status: sub.status,
    subscription_interval: price?.recurring?.interval ?? null,
    current_period_end: periodEnd,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
  };
  // Only touch card columns when we resolved real values (see note 2).
  if (cardBrand) patch.card_brand = cardBrand;
  if (cardLast4) patch.card_last4 = cardLast4;

  // Branch explicitly rather than `sb.from(ref.table)` — a union table
  // name collapses the generated row types to `never`.
  if (ref.table === "vendors") {
    await sb.from("vendors").update(patch).eq("id", ref.id);
  } else {
    await sb.from("experts").update(patch).eq("id", ref.id);
  }
}
