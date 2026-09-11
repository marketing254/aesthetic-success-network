import "server-only";
import Stripe from "stripe";

/**
 * Stripe SDK singleton + the founding-waiver pricing catalog.
 *
 * Members pay from day one: Founding ($49/mo, first 100 lifetime seats)
 * → Early ($99/mo, next 400) → Standard ($199/mo, uncapped). Experts and
 * partners get a 6-month free waiver (clock starts at admin approval,
 * see `monthsSince`), then Growth ($49/mo, months 7-12) → Standard
 * ($199/mo, month 13+). Starting a trial locks the Growth rate for
 * life — enforced by a DB trigger (supabase/migrations/0010), not just
 * the app code below.
 */

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// ── Members ───────────────────────────────────────────────────────────

export type SubscriptionPlanKey =
  | "founding_monthly"
  | "founding_annual"
  | "early_monthly"
  | "early_annual"
  | "standard_monthly"
  | "standard_annual";

export const ALL_PLAN_KEYS: SubscriptionPlanKey[] = [
  "founding_monthly",
  "founding_annual",
  "early_monthly",
  "early_annual",
  "standard_monthly",
  "standard_annual",
];

export const PLAN_DISPLAY: Record<
  SubscriptionPlanKey,
  { amount: number; per: "month" | "year"; tier: "founding" | "early" | "standard"; label: string }
> = {
  founding_monthly: { amount: 49, per: "month", tier: "founding", label: "Founding — $49/mo" },
  founding_annual: { amount: 490, per: "year", tier: "founding", label: "Founding — $490/yr" },
  early_monthly: { amount: 99, per: "month", tier: "early", label: "Early — $99/mo" },
  early_annual: { amount: 990, per: "year", tier: "early", label: "Early — $990/yr" },
  standard_monthly: { amount: 199, per: "month", tier: "standard", label: "Standard — $199/mo" },
  standard_annual: { amount: 1990, per: "year", tier: "standard", label: "Standard — $1990/yr" },
};

const MEMBER_PRICE_ENV: Record<SubscriptionPlanKey, string> = {
  founding_monthly: "STRIPE_PRICE_FOUNDING_MONTHLY",
  founding_annual: "STRIPE_PRICE_FOUNDING_ANNUAL",
  early_monthly: "STRIPE_PRICE_EARLY_MONTHLY",
  early_annual: "STRIPE_PRICE_EARLY_ANNUAL",
  standard_monthly: "STRIPE_PRICE_STANDARD_MONTHLY",
  standard_annual: "STRIPE_PRICE_STANDARD_ANNUAL",
};

export function priceIdFor(plan: SubscriptionPlanKey): string {
  const envVar = MEMBER_PRICE_ENV[plan];
  const id = process.env[envVar];
  if (!id) throw new Error(`Missing env var ${envVar} for member plan "${plan}".`);
  return id;
}

export function tierForPlan(plan: SubscriptionPlanKey) {
  return PLAN_DISPLAY[plan].tier;
}
export function isFoundingPlan(plan: SubscriptionPlanKey) {
  return PLAN_DISPLAY[plan].tier === "founding";
}
export function isEarlyPlan(plan: SubscriptionPlanKey) {
  return PLAN_DISPLAY[plan].tier === "early";
}
export function billingIntervalFor(plan: SubscriptionPlanKey) {
  return PLAN_DISPLAY[plan].per === "year" ? "year" : "month";
}

export const FOUNDING_MEMBER_CAP = 100;
export const EARLY_MEMBER_CAP = 400;
export const FOUNDING_EXPERT_CAP = 20;

// ── Experts & partners ───────────────────────────────────────────────

export type ExpertPlanKey = "expert_growth_monthly" | "expert_standard_monthly" | "expert_standard_annual";
export type PartnerPlanKey = "partner_growth_monthly" | "partner_standard_monthly" | "partner_standard_annual";

export const ALL_EXPERT_PLAN_KEYS: ExpertPlanKey[] = [
  "expert_growth_monthly",
  "expert_standard_monthly",
  "expert_standard_annual",
];
export const ALL_PARTNER_PLAN_KEYS: PartnerPlanKey[] = [
  "partner_growth_monthly",
  "partner_standard_monthly",
  "partner_standard_annual",
];

export const EXPERT_PLAN_DISPLAY: Record<ExpertPlanKey, { amount: number; per: "month" | "year"; label: string }> = {
  expert_growth_monthly: { amount: 49, per: "month", label: "Growth — $49/mo" },
  expert_standard_monthly: { amount: 199, per: "month", label: "Standard — $199/mo" },
  expert_standard_annual: { amount: 1990, per: "year", label: "Standard — $1990/yr" },
};
export const PARTNER_PLAN_DISPLAY: Record<PartnerPlanKey, { amount: number; per: "month" | "year"; label: string }> = {
  partner_growth_monthly: { amount: 49, per: "month", label: "Growth — $49/mo" },
  partner_standard_monthly: { amount: 199, per: "month", label: "Standard — $199/mo" },
  partner_standard_annual: { amount: 1990, per: "year", label: "Standard — $1990/yr" },
};

const EXPERT_PRICE_ENV: Record<ExpertPlanKey, string> = {
  expert_growth_monthly: "STRIPE_PRICE_EXPERT_GROWTH_MONTHLY",
  expert_standard_monthly: "STRIPE_PRICE_EXPERT_STANDARD_MONTHLY",
  expert_standard_annual: "STRIPE_PRICE_EXPERT_STANDARD_ANNUAL",
};
const PARTNER_PRICE_ENV: Record<PartnerPlanKey, string> = {
  partner_growth_monthly: "STRIPE_PRICE_PARTNER_GROWTH_MONTHLY",
  partner_standard_monthly: "STRIPE_PRICE_PARTNER_STANDARD_MONTHLY",
  partner_standard_annual: "STRIPE_PRICE_PARTNER_STANDARD_ANNUAL",
};

export function expertPriceIdFor(plan: ExpertPlanKey): string {
  const envVar = EXPERT_PRICE_ENV[plan];
  const id = process.env[envVar];
  if (!id) throw new Error(`Missing env var ${envVar} for expert plan "${plan}".`);
  return id;
}
export function partnerPriceIdFor(plan: PartnerPlanKey): string {
  const envVar = PARTNER_PRICE_ENV[plan];
  const id = process.env[envVar];
  if (!id) throw new Error(`Missing env var ${envVar} for partner plan "${plan}".`);
  return id;
}

/** Reverse-lookup for display purposes — which configured plan does this Stripe price id correspond to, if any. */
export function expertPlanKeyForPriceId(priceId: string | null): ExpertPlanKey | null {
  if (!priceId) return null;
  return ALL_EXPERT_PLAN_KEYS.find((k) => process.env[EXPERT_PRICE_ENV[k]] === priceId) ?? null;
}
export function partnerPlanKeyForPriceId(priceId: string | null): PartnerPlanKey | null {
  if (!priceId) return null;
  return ALL_PARTNER_PLAN_KEYS.find((k) => process.env[PARTNER_PRICE_ENV[k]] === priceId) ?? null;
}

export type ProgramPhase = "launch" | "growth" | "standard";

/** Months elapsed since the free-waiver clock started (admin approval). */
export function monthsSince(startedAt: string | null): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  const days = (Date.now() - start) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(days / 30));
}

export function phaseForMonth(monthsInProgram: number): ProgramPhase {
  if (monthsInProgram <= 6) return "launch";
  if (monthsInProgram <= 12) return "growth";
  return "standard";
}

export function priceLabelForPhase(phase: ProgramPhase): string {
  if (phase === "launch") return "$0 / mo";
  if (phase === "growth") return "$49 / mo";
  return "$199 / mo";
}

// ── Access gate (audience-agnostic) ──────────────────────────────────

export type BillingAccessReason =
  | "subscription_required"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete_expired";

export type BillingAccess =
  | { allowed: true }
  | { allowed: false; reason: BillingAccessReason; title: string; message: string; cta: string };

export function checkBillingAccess(opts: {
  monthsInProgram: number;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
}): BillingAccess {
  const { monthsInProgram, subscriptionStatus, hasSubscription } = opts;

  if (!hasSubscription) {
    // Still inside the free waiver window with no card on file yet.
    if (monthsInProgram <= 6 && !subscriptionStatus) return { allowed: true };
    return {
      allowed: false,
      reason: "subscription_required",
      title: "Add your billing details",
      message: "Start your subscription to unlock the full portal.",
      cta: "Add card",
    };
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return { allowed: true };
  }

  switch (subscriptionStatus) {
    case "past_due":
      return {
        allowed: false,
        reason: "past_due",
        title: "Payment past due",
        message: "Your last payment didn't go through. Update your card to keep your access.",
        cta: "Update card",
      };
    case "unpaid":
      return {
        allowed: false,
        reason: "unpaid",
        title: "Payment required",
        message: "Your subscription is unpaid. Update your card to restore access.",
        cta: "Update card",
      };
    case "canceled":
      return {
        allowed: false,
        reason: "canceled",
        title: "Subscription canceled",
        message: "Your subscription was canceled. Resubscribe to regain access.",
        cta: "Resubscribe",
      };
    case "incomplete_expired":
      return {
        allowed: false,
        reason: "incomplete_expired",
        title: "Checkout expired",
        message: "Your checkout session expired before payment completed. Try again.",
        cta: "Try again",
      };
    default:
      return {
        allowed: false,
        reason: "subscription_required",
        title: "Add your billing details",
        message: "Start your subscription to unlock the full portal.",
        cta: "Add card",
      };
  }
}
