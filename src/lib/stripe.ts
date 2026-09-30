import Stripe from "stripe";

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
 *   STRIPE_PRICE_PARTNER_GROWTH_MONTHLY            - $39/mo   company growth rate, months 1 to 12 (website and founding)
 *   STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY - $149/mo  company standard rate, month 13 onward (website and founding)
 *   STRIPE_PRICE_PARTNER_STANDARD_MONTHLY          - LEGACY key, never offered or shown; point it at the $149 price
 *   STRIPE_PRICE_PARTNER_STANDARD_ANNUAL           - LEGACY key, never offered or shown
 *
 *   STRIPE_PRICE_EXPERT_GROWTH_MONTHLY             - $39/mo   — expert rate after the free period (never steps up)
 *   STRIPE_PRICE_EXPERT_STANDARD_MONTHLY           - $199/mo  — defined but NEVER offered or shown
 *   STRIPE_PRICE_EXPERT_STANDARD_ANNUAL            - $1,990/yr — defined but NEVER offered or shown
 *
 * Provider pricing model (four cases):
 *   A. Founding expert (admin invite, role expert): 12 months free
 *      (FOUNDING_EXPERT_TRIAL_DAYS trial on the expert growth price), then
 *      $39/month for good. `billing_exempt` is NOT set by invites any more;
 *      it stays as a manual admin override only.
 *   B. Founding company (admin invite, role partner): $39/month from day 1
 *      for months 1–12, then $149/month from month 13 (subscription
 *      schedule: growth price x 12 iterations, then the founding standard
 *      price). pricing_plan "flat_49" keeps $39 with no increase.
 *   C. Website expert (/experts): $0 months 1–6 (TRIAL_DAYS trial on the
 *      expert growth price), then $39/month, and it stays $39.
 *   D. Website company (/companies): identical to case B. $39/month from
 *      the day the card is added for months 1–12, then $149/month from
 *      month 13, via the same subscription schedule
 *      (createCompanyLadderSchedule). No free months, no $199 rate.
 *   Role "both" = case A for the expert side and case B for the company
 *   side, as two subscriptions on the same Stripe customer.
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
 * Website EXPERT free period (case C): 180 days on the expert growth
 * price, first $39 charge on day 181. Experts only. Companies never trial;
 * they pay $39 from the day the card is added (createCompanyLadderSchedule).
 */
export const TRIAL_DAYS = 180;

/** Founding expert (admin invite) free period: 365 days on the expert growth price, then $39/month. */
export const FOUNDING_EXPERT_TRIAL_DAYS = 365;

/** Company ladder (founding invite AND website signup): number of $39 months before the $149 standard rate. */
export const FOUNDING_PARTNER_GROWTH_MONTHS = 12;

/**
 * LEGACY fixed-date founding ramp anchors. The founding-invite acceptance
 * flow now builds its schedule relative to the acceptance date (12 x $39,
 * then $149), so these are no longer read by the accept route. Kept so the
 * env names stay valid.
 */
export const FOUNDING_TRIAL_END_ISO =
  process.env.FOUNDING_TRIAL_END_ISO || "2027-02-01T00:00:00Z";
export const FOUNDING_STANDARD_START_ISO =
  process.env.FOUNDING_STANDARD_START_ISO || "2027-08-01T00:00:00Z";

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
 * Phase the customer is currently in, derived from months_in_program.
 * Used to render the right "current rate" line in the billing UI without
 * round-tripping to Stripe on every render.
 *
 *   partner (company): months 1-12 growth ($39), month 13 onward standard
 *     ($149). Companies have no launch (free) phase.
 *   expert (website expert): months 1-6 launch ($0), month 7 onward growth
 *     ($39). There is no standard phase for experts.
 */
export function phaseForMonth(
  monthsInProgram: number,
  audience: ProviderAudience = "partner",
): "launch" | "growth" | "standard" {
  if (audience === "expert") return monthsInProgram <= 6 ? "launch" : "growth";
  if (monthsInProgram <= 12) return "growth";
  return "standard";
}

/**
 * Pretty "$0 / mo" / "$39 / mo" / "$149 / mo" label for the given phase.
 * Experts never reach "standard"; if asked, the label stays at $39.
 */
export function priceLabelForPhase(
  phase: "launch" | "growth" | "standard",
  audience: ProviderAudience = "partner",
): string {
  if (phase === "launch") return "$0 / mo";
  if (phase === "growth" || audience === "expert") return "$39 / mo";
  return "$149 / mo";
}

// =====================================================================
// COMPANY LADDER SCHEDULE — shared by the founding accept route and the
// website company sign-and-pay route.
// =====================================================================

export type CompanyLadderScheduleResult = {
  schedule: Stripe.SubscriptionSchedule;
  /** The subscription Stripe created for the schedule, re-fetched so `items` and `status` are populated. */
  subscription: Stripe.Subscription;
  /** Growth price ID used for phase 1 (mirrored to vendors.stripe_price_id). */
  growthPriceId: string;
  /** ISO date phase 2 ($149) starts: month 13. */
  standardStartsAt: string;
};

/**
 * Create the company price ladder as ONE Stripe subscription schedule:
 *
 *   phase 1: STRIPE_PRICE_PARTNER_GROWTH_MONTHLY ($39) x 12 months,
 *            charged from today (no trial)
 *   phase 2: STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY ($149),
 *            open-ended; end_behavior "release" hands the subscription
 *            back to normal management once the schedule is done
 *
 * The first $39 invoice is created and charged immediately. Every company
 * (founding invite, website signup) runs through here so the two flows
 * can never drift. `metadata` is written to the schedule and both phases;
 * `audience: "vendor"` and the per-phase `plan` are added here.
 */
export async function createCompanyLadderSchedule(opts: {
  customerId: string;
  paymentMethodId: string;
  metadata?: Record<string, string>;
}): Promise<CompanyLadderScheduleResult> {
  const stripe = getStripe();
  const growthPriceId = partnerPriceIdFor("partner_growth_monthly");
  const standardPriceId = partnerPriceIdFor("partner_founding_standard_monthly");
  const base: Record<string, string> = { ...(opts.metadata ?? {}), audience: "vendor" };
  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);

  const schedule = await stripe.subscriptionSchedules.create({
    customer: opts.customerId,
    start_date: nowSec,
    end_behavior: "release",
    default_settings: {
      default_payment_method: opts.paymentMethodId,
      collection_method: "charge_automatically",
    },
    phases: [
      // $39/mo for the first 12 months, charged from today.
      {
        items: [{ price: growthPriceId }],
        duration: { interval: "month", interval_count: FOUNDING_PARTNER_GROWTH_MONTHS },
        metadata: { ...base, plan: "partner_growth_monthly" },
      },
      // $149/mo standard, month 13 onward (open-ended).
      {
        items: [{ price: standardPriceId }],
        metadata: { ...base, plan: "partner_founding_standard_monthly" },
      },
    ],
    metadata: base,
  });

  const subId =
    typeof schedule.subscription === "string" ? schedule.subscription : schedule.subscription?.id;
  if (!subId) throw new Error("Schedule did not create a subscription.");
  const subscription = await stripe.subscriptions.retrieve(subId);

  const phase1End = schedule.phases?.[0]?.end_date;
  let standardStartsAt: string;
  if (typeof phase1End === "number") {
    standardStartsAt = new Date(phase1End * 1000).toISOString();
  } else {
    const d = new Date(now.getTime());
    d.setUTCMonth(d.getUTCMonth() + FOUNDING_PARTNER_GROWTH_MONTHS);
    standardStartsAt = d.toISOString();
  }

  return { schedule, subscription, growthPriceId, standardStartsAt };
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
  /**
   * Which ramp the copy describes. Experts: free period then $39.
   * Companies: $39 from the day the card is added, then $149 from
   * month 13 (no free period). Defaults to "partner".
   */
  audience?: ProviderAudience;
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
  // the subscription (expert: 180-day trial; company: $39 charged today).
  if (!hasSubscription) {
    if (audience === "expert") {
      return {
        allowed: false,
        reason: "subscription_required",
        title: "One more step: add your card",
        message:
          "You're approved. Add a card to activate your free period. Nothing is charged today; the first $39 charge lands when your free period ends.",
        cta: "Add card & start trial",
      };
    }
    return {
      allowed: false,
      reason: "subscription_required",
      title: "One more step: add your card",
      message:
        "You're approved. Add a card to start: $39 a month, then $149 a month from month 13. Your first $39 charge is today.",
      cta: "Add card & start membership",
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
