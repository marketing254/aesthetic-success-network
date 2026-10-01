import Stripe from "stripe";
import {
  EXPERT_RATE_LABEL,
  normalizeProviderRate,
  providerFreePeriodEnd,
  rateLabel,
  type ProviderRate,
} from "@/lib/providerBilling";

/**
 * Single source of truth for the Stripe SDK + the Aesthetic Success
 * Network (ASN) pricing catalogue.
 *
 * Price IDs are read from env vars so the same code runs against the test
 * sandbox locally and against live prices in production without an edit.
 *
 *   STRIPE_PRICE_FOUNDING_MONTHLY            - $29/mo    — first 100 members, locked while active
 *   STRIPE_PRICE_FOUNDING_ANNUAL             - $290/yr   — "pay for 10 months, get 12"
 *   STRIPE_PRICE_FOUNDING_ANNUAL_PROMO       - $261/yr   — founding annual with a ≥90-day promo code only
 *   STRIPE_PRICE_EARLY_MONTHLY / _ANNUAL     - NOT OFFERED. ASN has no "early" tier
 *                                              (EARLY_MEMBER_CAP = 0). The plan keys stay so
 *                                              the webhook never crashes on a legacy metadata
 *                                              value; nothing in the UI can select them.
 *   STRIPE_PRICE_STANDARD_MONTHLY            - $99/mo   — after the founding cap
 *   STRIPE_PRICE_STANDARD_ANNUAL             - $990/yr
 *
 *   STRIPE_PRICE_PARTNER_GROWTH_MONTHLY            - $39/mo   company standard rate after the free months
 *   STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY - $149/mo  company "large" rate after the free months (admin-set)
 *   STRIPE_PRICE_PARTNER_STANDARD_MONTHLY          - LEGACY key, never offered or shown; point it at the $149 price
 *   STRIPE_PRICE_PARTNER_STANDARD_ANNUAL           - LEGACY key, never offered or shown
 *
 *   STRIPE_PRICE_EXPERT_GROWTH_MONTHLY             - $39/mo   — expert rate after the free months (never steps up)
 *   STRIPE_PRICE_EXPERT_STANDARD_MONTHLY           - $199/mo  — defined but NEVER offered or shown
 *   STRIPE_PRICE_EXPERT_STANDARD_ANNUAL            - $1,990/yr — defined but NEVER offered or shown
 *
 * Provider pricing model (owner decision 2026-10-01, src/lib/providerBilling.ts):
 *   Every provider, expert or company, founding invite or website signup,
 *   saves a card when they accept the agreement and pays nothing until
 *   PROVIDER_FREE_MONTHS (6) after the member launch (MEMBER_LAUNCH_DATE).
 *   Stripe holds the subscription in `trialing` until that date
 *   (createProviderSubscription), then charges a flat monthly rate with
 *   no increase: experts $39; companies $39 ("standard") or $149
 *   ("large", set by the admin at approval or on the invite). There are
 *   no subscription schedules, no month-13 step and no $199 rate.
 *   Role "both" = an expert subscription and a company subscription on
 *   the same Stripe customer, mirrored onto the experts and vendors rows.
 *
 * Tier caps (lifetime — cancellations do NOT free a seat):
 *   Founding: first 100 lifetime  → FOUNDING_MEMBER_CAP
 *   Early:    0 (tier disabled)   → EARLY_MEMBER_CAP
 *   Standard: unlimited
 *
 * The webhook handler also needs STRIPE_WEBHOOK_SECRET.
 */

/** Canonical public origin. Every default URL in the app derives from this. */
export const CANONICAL_ORIGIN = "https://www.aestheticsuccessnetwork.com";

// Lifetime caps. Once N members have ever subscribed to a tier, the tier
// closes permanently — cancellations do NOT free a seat. We track this by
// the {founding,early}_member_locked boolean on members, set by the
// Stripe webhook on first successful checkout and never reset.
export const FOUNDING_MEMBER_CAP = 100;
/** ASN has no early tier. Zero means the tier can never open. */
export const EARLY_MEMBER_CAP = 0;

/**
 * Billing exemption cap for EXPERTS (`experts.billing_exempt`). This is a
 * MANUAL admin override only: an admin can mark up to 20 experts as never
 * charged. Founding invites do NOT set this flag any more; a founding
 * expert gets a 12-month free trial and then pays $39/month (case A).
 * INTERNAL ONLY: never offered on a public page, form, email or agreement.
 *
 * This constant is for labels and pre-flight checks only. The cap is
 * ENFORCED in the database (0043_founding_expert_cap.sql) because the
 * flag can be set from the repair script, the admin console, or a future
 * onboarding step — a trigger is the one place all of them must pass.
 *
 * Expert-side only: an exempt expert who also runs a company still pays
 * through their `vendors` row.
 */
export const FOUNDING_EXPERT_CAP = 20;

/**
 * Legacy fixed-day trial lengths. No route reads these any more: every
 * provider's free period now ends PROVIDER_FREE_MONTHS after the member
 * launch (see src/lib/providerBilling.ts and createProviderSubscription).
 * Kept only so older scripts and env names stay valid.
 */
export const TRIAL_DAYS = 180;
export const FOUNDING_EXPERT_TRIAL_DAYS = 365;

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local for local dev and to Vercel env vars (Preview + Production).",
    );
  }
  _client = new Stripe(key, {
    // Pinning the API version keeps webhook payloads + types stable
    // even when Stripe ships new defaults.
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  return _client;
}

export type SubscriptionPlanKey =
  | "founding_monthly"
  | "founding_annual"
  | "early_monthly"
  | "early_annual"
  | "standard_monthly"
  | "standard_annual";

export type SubscriptionTier = "founding" | "early" | "standard";

export const ALL_PLAN_KEYS: SubscriptionPlanKey[] = [
  "founding_monthly",
  "founding_annual",
  "early_monthly",
  "early_annual",
  "standard_monthly",
  "standard_annual",
];

/**
 * Display price for each plan (USD). Used by the UI — Stripe still
 * charges based on the price ID in the env var, this is just the label.
 *
 * The `early_*` entries exist ONLY so a webhook carrying a legacy plan
 * key can still resolve a label. ASN has no early tier, so they carry the
 * Standard label and amount: nothing can ever render "$99".
 */
export const PLAN_DISPLAY: Record<
  SubscriptionPlanKey,
  { amount: number; per: "mo" | "yr"; tier: SubscriptionTier; label: string }
> = {
  founding_monthly: { amount: 29,   per: "mo", tier: "founding", label: "Founding Monthly" },
  founding_annual:  { amount: 290,  per: "yr", tier: "founding", label: "Founding Annual"  },
  early_monthly:    { amount: 99,  per: "mo", tier: "early",    label: "Standard Monthly" },
  early_annual:     { amount: 990, per: "yr", tier: "early",    label: "Standard Annual"  },
  standard_monthly: { amount: 99,  per: "mo", tier: "standard", label: "Standard Monthly" },
  standard_annual:  { amount: 990, per: "yr", tier: "standard", label: "Standard Annual"  },
};

/** Plan keys a member can actually pick. Early keys are never offered. */
export const OFFERED_PLAN_KEYS: SubscriptionPlanKey[] = [
  "founding_monthly",
  "founding_annual",
  "standard_monthly",
  "standard_annual",
];

export function tierForPlan(plan: SubscriptionPlanKey): SubscriptionTier {
  return PLAN_DISPLAY[plan].tier;
}

/**
 * Map our plan keys to the price IDs configured in Stripe Dashboard.
 * Throws a clear error if any are missing so misconfiguration shows up
 * at request time, not silently at runtime.
 */
export function priceIdFor(plan: SubscriptionPlanKey): string {
  const envKey =
    plan === "founding_monthly"   ? "STRIPE_PRICE_FOUNDING_MONTHLY"
      : plan === "founding_annual"  ? "STRIPE_PRICE_FOUNDING_ANNUAL"
      : plan === "early_monthly"    ? "STRIPE_PRICE_EARLY_MONTHLY"
      : plan === "early_annual"     ? "STRIPE_PRICE_EARLY_ANNUAL"
      : plan === "standard_monthly" ? "STRIPE_PRICE_STANDARD_MONTHLY"
      : "STRIPE_PRICE_STANDARD_ANNUAL";
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `Missing env var ${envKey}. Set this in .env.local (and Vercel) to a Stripe price ID like "price_1Te9...".`,
    );
  }
  return value;
}

export function isFoundingPlan(plan: SubscriptionPlanKey): boolean {
  return plan === "founding_monthly" || plan === "founding_annual";
}

export function isEarlyPlan(plan: SubscriptionPlanKey): boolean {
  return plan === "early_monthly" || plan === "early_annual";
}

export function billingIntervalFor(plan: SubscriptionPlanKey): "month" | "year" {
  return PLAN_DISPLAY[plan].per === "yr" ? "year" : "month";
}

// =====================================================================
// EXPERT + PARTNER PLANS
// =====================================================================
//
// Members and the two provider audiences (vendors/partners + experts) all
// run through Stripe but with separate products + price IDs so we can
// tell them apart in reports + dashboards.
//
// Company (cases B and D, identical), two phases:
//   Phase 1 (months 1-12)  $39/mo   "Growth"   charged from the day the card is added
//   Phase 2 (month 13+)    $149/mo  "Standard" (partner_founding_standard_monthly)
// Both are created as ONE subscription schedule by createCompanyLadderSchedule;
// Stripe rolls the company onto $149 at month 13 by itself. Founding
// pricing_plan "flat_49" is a plain $39 subscription with no increase.
//
// Website expert (case C), two phases only:
//   Phase 1 (months 1-6)   $0/mo    "Launch"   — 180-day trial on the growth price
//   Phase 2 (month 7+)     $39/mo   "Growth"   — stays $39, no month-13 step
//
// Founding expert (case A): 365-day trial on the growth price, then $39/mo.
//
// The "phase" is just the price the customer is paying RIGHT NOW.

export type PartnerPlanKey =
  | "partner_growth_monthly"             // $39, months 1-12 (website and founding)
  | "partner_standard_monthly"           // LEGACY key: never offered or shown; displays as $149
  | "partner_standard_annual"            // LEGACY key: never offered or shown
  | "partner_founding_standard_monthly"; // $149, month 13+ (website and founding)

export type ExpertPlanKey =
  | "expert_growth_monthly"      // $39 after the free period, never steps up
  | "expert_standard_monthly"    // $199, defined but never offered or shown
  | "expert_standard_annual";    // $1,990/year, defined but never offered or shown

export type PartnerPhase = "launch" | "growth" | "standard";
export type ExpertPhase = "launch" | "growth" | "standard";

export const ALL_PARTNER_PLAN_KEYS: PartnerPlanKey[] = [
  "partner_growth_monthly",
  "partner_standard_monthly",
  "partner_standard_annual",
  "partner_founding_standard_monthly",
];

export const ALL_EXPERT_PLAN_KEYS: ExpertPlanKey[] = [
  "expert_growth_monthly",
  "expert_standard_monthly",
  "expert_standard_annual",
];

export const PARTNER_PLAN_DISPLAY: Record<
  PartnerPlanKey,
  { amount: number; per: "mo" | "yr"; phase: PartnerPhase; label: string }
> = {
  partner_growth_monthly:            { amount: 39,   per: "mo", phase: "growth",   label: "ASN Company Growth" },
  // Legacy keys. Nothing offers or renders them; they resolve to the $149
  // standard rate so a stale metadata value can never display $199.
  partner_standard_monthly:          { amount: 149,  per: "mo", phase: "standard", label: "ASN Company Standard Monthly" },
  partner_standard_annual:           { amount: 1490, per: "yr", phase: "standard", label: "ASN Company Standard Annual" },
  partner_founding_standard_monthly: { amount: 149,  per: "mo", phase: "standard", label: "ASN Company Standard Monthly" },
};

/** Plan keys a company can actually be put on. The legacy standard keys are never offered. */
export const OFFERED_PARTNER_PLAN_KEYS: PartnerPlanKey[] = [
  "partner_growth_monthly",
  "partner_founding_standard_monthly",
];

export const EXPERT_PLAN_DISPLAY: Record<
  ExpertPlanKey,
  { amount: number; per: "mo" | "yr"; phase: ExpertPhase; label: string }
> = {
  expert_growth_monthly:   { amount: 39,   per: "mo", phase: "growth",   label: "ASN Expert Growth" },
  expert_standard_monthly: { amount: 199,  per: "mo", phase: "standard", label: "ASN Expert Standard Monthly" },
  expert_standard_annual:  { amount: 1990, per: "yr", phase: "standard", label: "ASN Expert Standard Annual" },
};

export function partnerPriceIdFor(plan: PartnerPlanKey): string {
  const envKey =
    plan === "partner_growth_monthly"   ? "STRIPE_PRICE_PARTNER_GROWTH_MONTHLY"
      : plan === "partner_standard_monthly" ? "STRIPE_PRICE_PARTNER_STANDARD_MONTHLY"
      : plan === "partner_founding_standard_monthly" ? "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY"
      : "STRIPE_PRICE_PARTNER_STANDARD_ANNUAL";
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `Missing env var ${envKey}. Set this in .env.local (and Vercel) to a Stripe price ID like "price_1Te9...".`,
    );
  }
  return value;
}

export function expertPriceIdFor(plan: ExpertPlanKey): string {
  const envKey =
    plan === "expert_growth_monthly"   ? "STRIPE_PRICE_EXPERT_GROWTH_MONTHLY"
      : plan === "expert_standard_monthly" ? "STRIPE_PRICE_EXPERT_STANDARD_MONTHLY"
      : "STRIPE_PRICE_EXPERT_STANDARD_ANNUAL";
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `Missing env var ${envKey}. Set this in .env.local (and Vercel) to a Stripe price ID like "price_1Te9...".`,
    );
  }
  return value;
}

/** Which provider ramp applies. Experts never have a standard step. */
export type ProviderAudience = "partner" | "expert";

/**
 * Phase label derived from months_in_program, used only as a fallback
 * when the Stripe status is unknown. Every provider is in the free
 * "launch" phase while Stripe reports `trialing`; after the free months
 * they are on their flat "growth" rate for good. There is no "standard"
 * step any more for either audience.
 */
export function phaseForMonth(
  monthsInProgram: number,
  audience: ProviderAudience = "partner",
): "launch" | "growth" | "standard" {
  void audience;
  return monthsInProgram <= 6 ? "launch" : "growth";
}

/**
 * "$0 / mo" during the free months, otherwise the provider's flat rate.
 * Companies on the large rate pass "large".
 */
export function priceLabelForPhase(
  phase: "launch" | "growth" | "standard",
  audience: ProviderAudience = "partner",
  rate?: ProviderRate | string | null,
): string {
  if (phase === "launch") return "$0 / mo";
  if (audience === "expert") return `${EXPERT_RATE_LABEL} / mo`;
  return `${rateLabel(rate)} / mo`;
}

// =====================================================================
// PROVIDER SUBSCRIPTION — shared by the founding accept route and the
// portal sign-and-pay routes (expert and company).
// =====================================================================

export type ProviderSubscriptionResult = {
  subscription: Stripe.Subscription;
  /** Price the subscription bills after the free months (mirrored to stripe_price_id). */
  priceId: string;
  /** ISO date the free founding months end and the first charge lands. */
  freePeriodEndsAt: string;
  /** True while MEMBER_LAUNCH_DATE is unset and the end date is a placeholder. */
  provisional: boolean;
  /** "$39" or "$149". */
  rateLabel: string;
};

/**
 * Create ONE provider subscription with the card saved as default:
 *   - items: the rate price (expert $39; company $39 standard or $149 large)
 *   - trial_end: PROVIDER_FREE_MONTHS after the member launch
 *     (providerFreePeriodEnd); nothing is charged before that date
 *   - trial_settings: if the card is removed before then, Stripe pauses
 *     instead of charging a missing card
 * Every provider (founding invite, website expert, website company) runs
 * through here so the flows can never drift. `metadata` is written to
 * the subscription; `audience`, `plan`, `rate` and `free_period` are
 * added here.
 */
export async function createProviderSubscription(opts: {
  customerId: string;
  paymentMethodId: string;
  audience: "expert" | "vendor";
  /** Companies only. Experts are always the $39 price. */
  rate?: ProviderRate | string | null;
  metadata?: Record<string, string>;
}): Promise<ProviderSubscriptionResult> {
  const stripe = getStripe();
  const rate = normalizeProviderRate(opts.rate);
  const priceId =
    opts.audience === "expert"
      ? expertPriceIdFor("expert_growth_monthly")
      : rate === "large"
        ? partnerPriceIdFor("partner_founding_standard_monthly")
        : partnerPriceIdFor("partner_growth_monthly");
  const plan =
    opts.audience === "expert"
      ? "expert_growth_monthly"
      : rate === "large"
        ? "partner_founding_standard_monthly"
        : "partner_growth_monthly";
  const free = providerFreePeriodEnd();
  const subscription = await stripe.subscriptions.create({
    customer: opts.customerId,
    items: [{ price: priceId }],
    trial_end: Math.floor(free.date.getTime() / 1000),
    default_payment_method: opts.paymentMethodId,
    trial_settings: { end_behavior: { missing_payment_method: "pause" } },
    metadata: {
      ...(opts.metadata ?? {}),
      audience: opts.audience,
      plan,
      rate: opts.audience === "expert" ? "standard" : rate,
      free_period: free.provisional ? "provisional" : "launch_based",
      free_period_ends_at: free.date.toISOString(),
    },
  });
  return {
    subscription,
    priceId,
    freePeriodEndsAt: free.date.toISOString(),
    provisional: free.provisional,
    rateLabel: opts.audience === "expert" ? EXPERT_RATE_LABEL : rateLabel(rate),
  };
}

// =====================================================================
// BILLING ACCESS GATE — applied to vendor + expert portals.
// =====================================================================
// Decide whether the user's portal access should be locked based on
// their position in the provider ramp + current Stripe subscription
// status. Used by:
//   - components/shared/BillingGate.tsx (renders a paywall card if
//     blocked, but always lets them through to the billing page itself
//     so they can update the card or re-subscribe)
//   - lib/auth/guards.ts (returns 402 Payment Required on API calls if
//     blocked, so a client that bypasses the wall still can't write).
//
// Why the months-in-program check matters: rows created under the old
// no-subscription waiver flow (months 1-6, NULL status) are legacy and
// are still let through. Every new provider has an `active`/`trialing`
// subscription (experts trial, companies pay from day 1); anything else
// means there's a problem we should surface.

export type BillingAccess =
  | { allowed: true }
  | { allowed: false; reason: BillingBlockReason; title: string; message: string; cta: string };

export type BillingBlockReason =
  | "subscription_required"  // waiver ended, no subscription created
  | "past_due"               // card declined on latest invoice
  | "canceled"               // subscription terminated
  | "unpaid";                // multiple retry failures, Stripe marked unpaid

/**
 * Preview / demo accounts that skip the card gate entirely, from the
 * server-only env BILLING_BYPASS_EMAILS (comma-separated). Empty in
 * production. Used by the API guards; the portal shells rely on the
 * account row instead (see supabase/preview/mark-preview-accounts-paid.sql).
 */
export function isBillingBypassed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.BILLING_BYPASS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export function checkBillingAccess(opts: {
  monthsInProgram: number;
  subscriptionStatus: string | null;
  /**
   * True if the user has any Stripe subscription on file (even one
   * that's `canceled` or `past_due`). Newly-approved users who haven't
   * hit TrialStartCard yet arrive here with `false`, and we block
   * portal access until they add a card and start the trial.
   */
  hasSubscription: boolean;
  /** Which copy to show. Every provider gets the same free founding months, then a flat rate. Defaults to "partner". */
  audience?: ProviderAudience;
  /** Company rate ("standard" $39 or "large" $149) for the message. */
  rate?: ProviderRate | string | null;
  /**
   * Billing-exempt expert (`experts.billing_exempt`, manual admin
   * override). These people are never charged and are never asked for a
   * card, so every check below is skipped. Note this is expert-side only
   * — a person who also runs a company still pays through their
   * `vendors` row.
   */
  billingExempt?: boolean;
}): BillingAccess {
  const { monthsInProgram, subscriptionStatus, hasSubscription, billingExempt } = opts;
  const audience: ProviderAudience = opts.audience ?? "partner";

  // Exempt override — always allowed, no card, no subscription.
  // Checked first so a stale/absent Stripe status can never lock them out.
  if (billingExempt) return { allowed: true };

  // No subscription at all — regardless of where they are in the
  // program timeline, they need to add a card first. Fresh signups
  // land here on their first portal login; the BillingGate's "Go to
  // billing page" button routes them to /vendor/account or
  // /expert/billing, where TrialStartCard captures the card and starts
  // the subscription (free until the launch-based date, then the flat rate).
  if (!hasSubscription) {
    const rate = audience === "expert" ? EXPERT_RATE_LABEL : rateLabel(opts.rate);
    return {
      allowed: false,
      reason: "subscription_required",
      title: "One more step: save your card",
      message: `You're approved. Save a card to activate your free founding months. Nothing is charged today; your first ${rate} charge lands when your free months end, and we'll remind you 7 days before.`,
      cta: "Save card & activate",
    };
  }

  // Healthy subscriptions always pass.
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return { allowed: true };
  }

  // Waiver-era grandfather clause — if someone signed up under the old
  // no-subscription flow (months_in_program still ≤ 6 with a NULL
  // status), let them through. The `hasSubscription` short-circuit
  // above catches new-flow users; this block only matches legacy rows.
  if (monthsInProgram <= 6 && !subscriptionStatus) return { allowed: true };

  if (subscriptionStatus === "past_due") {
    return {
      allowed: false,
      reason: "past_due",
      title: "Payment failed on your last invoice",
      message:
        "Your card was declined on the latest charge. Update your payment method to keep your portal and listing active. Stripe will retry once more before suspending.",
      cta: "Update payment method",
    };
  }
  if (subscriptionStatus === "unpaid") {
    return {
      allowed: false,
      reason: "unpaid",
      title: "Subscription suspended",
      message:
        "Your subscription was suspended after repeated payment failures. Add a working card to reactivate.",
      cta: "Reactivate subscription",
    };
  }
  if (
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "incomplete_expired"
  ) {
    return {
      allowed: false,
      reason: "canceled",
      title: "Subscription is no longer active",
      message:
        "Your subscription has ended. Reactivate to restore portal access and your public listing.",
      cta: "Reactivate subscription",
    };
  }

  // No usable subscription, past the legacy waiver: they never started one.
  if (audience === "expert") {
    return {
      allowed: false,
      reason: "subscription_required",
      title: "Your free period has ended",
      message:
        "Your free period is up. Add a subscription to keep your portal and public listing active.",
      cta: "Start subscription",
    };
  }
  return {
    allowed: false,
    reason: "subscription_required",
    title: "Your subscription is not active",
    message:
      "Add a card to keep your portal and public listing active: $39 a month, then $149 a month from month 13.",
    cta: "Start subscription",
  };
}

/**
 * The app's absolute origin: Stripe success/cancel/return URLs, portal
 * links, admin deep links in team emails, invite URLs. ONE helper for
 * every server-side URL builder so no route hard-codes a domain.
 * Resolved in this order so it works without manual env-var fiddling for
 * each preview deploy:
 *
 *   1. NEXT_PUBLIC_APP_ORIGIN / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL
 *      — explicit override (production sets NEXT_PUBLIC_APP_URL)
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel auto-sets this for the
 *      project's production deployment, even on preview builds
 *   3. VERCEL_BRANCH_URL       — Vercel auto-sets this to a STABLE
 *      per-branch URL (e.g. <project>-git-<branch>-<team>.vercel.app)
 *      that survives across pushes — great for previews
 *   4. VERCEL_URL              — Vercel auto-sets this to the specific
 *      deployment's URL (changes per push) — last-resort fallback
 *   5. CANONICAL_ORIGIN in production, http://localhost:3000 otherwise
 *
 * All Vercel system env vars are bare hostnames (no scheme), so we
 * prepend https:// when we use them.
 */
export function appOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return stripTrailingSlash(explicit);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost && process.env.VERCEL_ENV === "production") {
    return `https://${productionHost}`;
  }

  const branchHost = process.env.VERCEL_BRANCH_URL;
  if (branchHost) return `https://${branchHost}`;

  const deploymentHost = process.env.VERCEL_URL;
  if (deploymentHost) return `https://${deploymentHost}`;

  return process.env.NODE_ENV === "production" ? CANONICAL_ORIGIN : "http://localhost:3000";
}

/**
 * Absolute URL for a path on this app (admin deep links, portal links).
 * `adminLink("/admin/members?filter=new")` → `<appOrigin()>/admin/members?filter=new`.
 */
export function appUrl(path: string): string {
  return `${appOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}
