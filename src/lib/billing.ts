import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

/**
 * The ONE place that writes Stripe subscription state to the DB. Both
 * the webhook handler and the manual "re-sync from Stripe" fallback
 * routes call these functions, so the two paths can't drift apart.
 */

type SubscriptionShadow = {
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  subscription_status: string;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
};

/** Newer Stripe API versions put period fields on the subscription item, not the subscription itself. */
function periodEndOf(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  return item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
}

async function resolveCard(
  sub: Stripe.Subscription,
  stripe?: Stripe,
): Promise<{ brand: string | null; last4: string | null }> {
  const pm = sub.default_payment_method;
  if (pm && typeof pm !== "string" && pm.card) {
    return { brand: pm.card.brand ?? null, last4: pm.card.last4 ?? null };
  }
  // Best-effort fallback — never throw, a missing card must not block a sync.
  try {
    const client = stripe ?? getStripe();
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const customer = await client.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (!customer.deleted) {
      const dpm = customer.invoice_settings?.default_payment_method;
      if (dpm && typeof dpm !== "string" && dpm.card) {
        return { brand: dpm.card.brand ?? null, last4: dpm.card.last4 ?? null };
      }
    }
  } catch (err) {
    console.error("[billing] card hydration failed:", err);
  }
  return { brand: null, last4: null };
}

async function buildShadow(sub: Stripe.Subscription, stripe?: Stripe): Promise<SubscriptionShadow> {
  const item = sub.items?.data?.[0];
  const periodEnd = periodEndOf(sub);
  const { brand, last4 } = await resolveCard(sub, stripe);
  return {
    stripe_subscription_id: sub.id,
    stripe_price_id: item?.price?.id ?? null,
    subscription_status: sub.status,
    subscription_interval: item?.price?.recurring?.interval ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    card_brand: brand,
    card_last4: last4,
  };
}

/** Rank active/trialing first, else the most recently created. Used by every "re-sync from Stripe" fallback route. */
export function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (subs.length === 0) return null;
  const rank = (s: Stripe.Subscription) => (s.status === "active" || s.status === "trialing" ? 0 : 1);
  return [...subs].sort((a, b) => rank(a) - rank(b) || b.created - a.created)[0]!;
}

// ── Members ───────────────────────────────────────────────────────────

export async function memberIdForCustomer(
  sb: SupabaseClient,
  customerId: string,
  fallbackMemberId?: string | null,
): Promise<string | null> {
  const { data } = await sb.from("members").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (data?.id) return data.id as string;
  return fallbackMemberId ?? null;
}

export async function applySubscriptionToMember(
  sb: SupabaseClient,
  memberId: string,
  sub: Stripe.Subscription,
  stripe?: Stripe,
): Promise<void> {
  const shadow = await buildShadow(sub, stripe);
  const { data: member } = await sb
    .from("members")
    .select("founding_member_locked, early_member_locked, tier")
    .eq("id", memberId)
    .maybeSingle();

  const plan = (sub.metadata?.plan ?? "") as string;
  const tier = (sub.metadata?.tier ?? member?.tier ?? "founding") as string;
  const isFirstSub = !member?.founding_member_locked && !member?.early_member_locked;

  const update: Record<string, unknown> = { ...shadow };
  if (sub.status === "active" || sub.status === "trialing") {
    // Card fields may be null on a transient hydration failure — never
    // overwrite a working card with a null one.
    if (!shadow.card_brand) delete update.card_brand;
    if (!shadow.card_last4) delete update.card_last4;
  }

  if (isFirstSub && (sub.status === "active" || sub.status === "trialing")) {
    if (tier === "founding") update.founding_member_locked = true;
    else if (tier === "early") update.early_member_locked = true;
    if (tier) update.tier = tier;
  }
  void plan;

  const { error } = await sb.from("members").update(update).eq("id", memberId);
  if (error) throw error;
}

// ── Experts & partners ───────────────────────────────────────────────

export type BusinessRef = { table: "expert_applications" | "partner_applications"; id: string };

export async function businessForCustomer(sb: SupabaseClient, customerId: string): Promise<BusinessRef | null> {
  const { data: partner } = await sb
    .from("partner_applications")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (partner?.id) return { table: "partner_applications", id: partner.id as string };

  const { data: expert } = await sb
    .from("expert_applications")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (expert?.id) return { table: "expert_applications", id: expert.id as string };

  return null;
}

export async function applySubscriptionToBusiness(
  sb: SupabaseClient,
  ref: BusinessRef,
  sub: Stripe.Subscription,
  stripe?: Stripe,
): Promise<void> {
  const shadow = await buildShadow(sub, stripe);
  const update: Record<string, unknown> = { ...shadow };
  if (!shadow.card_brand) delete update.card_brand;
  if (!shadow.card_last4) delete update.card_last4;

  const { error } = await sb.from(ref.table).update(update).eq("id", ref.id);
  if (error) throw error;
}
