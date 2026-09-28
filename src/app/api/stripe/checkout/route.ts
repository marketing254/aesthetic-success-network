import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveCheckoutMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { normalizeCode } from "@/lib/waitlist/validate";
import {
  ALL_PLAN_KEYS,
  appOrigin,
  billingIntervalFor,
  EARLY_MEMBER_CAP,
  FOUNDING_MEMBER_CAP,
  getStripe,
  isEarlyPlan,
  isFoundingPlan,
  priceIdFor,
  tierForPlan,
  type SubscriptionPlanKey,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout
 *
 * Body: { plan: "founding_monthly" | "founding_annual" | "standard_monthly" | "standard_annual" }
 *
 * Creates a Stripe Checkout Session for a subscription and returns the
 * redirect URL. The actual subscription state lives in Stripe — we just
 * mirror it via the /api/stripe/webhook endpoint once the customer pays.
 *
 * Founding-tier checkouts include `metadata.founding_member = "true"` on
 * the subscription so the webhook can lock the member into the founding
 * grandfathered rate.
 */
function isValidPlan(p: unknown): p is SubscriptionPlanKey {
  return typeof p === "string" && (ALL_PLAN_KEYS as string[]).includes(p);
}

export async function POST(req: Request) {
  // Session OR the short-lived signup cookie — a just-signed-up member can
  // pay before logging in (pay-first flow). The portal stays OTP-gated.
  const guard = await resolveCheckoutMember();
  if (!guard.ok) return guard.response;

  const route = "POST /api/stripe/checkout";
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; promoCode?: unknown; resume?: unknown };
  if (!isValidPlan(body.plan)) {
    return apiError.badRequest("Please pick a valid plan.", route);
  }
  const plan = body.plan;

  const sb = getSupabaseAdmin();

  // Optional promotional code (expert/partner/team owned, admin-activated).
  // A valid ACTIVE code turns the subscription into a free trial (default
  // 90 days = 3 months): card collected now, first charge after the trial.
  // Validated HERE — server-side, at the moment of checkout — so a code
  // the team deactivated a second ago can never slip through.
  // Strict shape (CODE_RE) before the lookup, then an exact `.eq()` on the
  // upper-cased code: no wildcard can reach the query.
  const promoRaw = typeof body.promoCode === "string" ? body.promoCode.trim() : "";
  const promoInput = normalizeCode(promoRaw);
  if (promoRaw && !promoInput) {
    return apiError.badRequest("That promotional code isn't valid.", route);
  }
  let promo: { id: string; code: string; trial_days: number } | null = null;
  if (promoInput) {
    try {
      const { data: promoRow } = await sb
        .from("member_promo_codes")
        .select("id, code, trial_days, active")
        .eq("code", promoInput)
        .maybeSingle();
      if (!promoRow) {
        return apiError.badRequest("That promotional code isn't valid.", route);
      }
      if (!promoRow.active) {
        return apiError.badRequest("That promotional code is no longer available.", route);
      }
      const { isPromoFullyClaimed } = await import("@/lib/promoCodes");
      if (await isPromoFullyClaimed(promoRow.id)) {
        return apiError.badRequest("That code has been fully claimed.", route);
      }
      promo = { id: promoRow.id, code: promoRow.code, trial_days: promoRow.trial_days };
    } catch {
      return apiError.badRequest("That promotional code isn't valid.", route);
    }
  }

  // Welcome-back checkout (follow-up email 3): a resume token whose
  // month-free code is active, unused, and matches this member's email
  // turns the subscription into a 30-day trial. Validated server-side at
  // this moment — the code never travels through the browser. Invalid or
  // expired tokens fall through silently to normal pricing (per SPEC).
  let recovery: { rowId: string; code: string } | null = null;
  const resumeToken = typeof body.resume === "string" ? body.resume.trim() : "";
  if (!promo && resumeToken) {
    try {
      const { recoveryGrantForCheckout } = await import("@/lib/abandoned");
      const { data: memberRow } = await sb
        .from("members")
        .select("email")
        .eq("id", guard.memberId)
        .maybeSingle();
      if (memberRow?.email) {
        recovery = await recoveryGrantForCheckout(resumeToken, memberRow.email);
      }
    } catch (err) {
      console.error("[checkout] recovery grant lookup failed:", err);
    }
  }

  // ASN has no early tier: EARLY_MEMBER_CAP is 0, so an early plan key can
  // never pass the cap check below. It stays a valid key only so a legacy
  // value in Stripe metadata cannot crash the webhook.
  // Tier caps — Founding (100) is LIFETIME. Cancellations do NOT free a
  // seat. We count the {tier}_member_locked boolean which is set on first
  // successful checkout and never reset.
  if (isFoundingPlan(plan) || isEarlyPlan(plan)) {
    const tier = tierForPlan(plan); // "founding" | "early"
    const column = tier === "founding" ? "founding_member_locked" : "early_member_locked";
    const cap = tier === "founding" ? FOUNDING_MEMBER_CAP : EARLY_MEMBER_CAP;

    const { count, error: countErr } = await sb
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq(column, true);
    if (countErr) {
      return serverError(countErr, { route, extra: { stage: "cap_count", tier } });
    }
    if ((count ?? 0) >= cap) {
      const msg =
        tier === "founding"
          ? "Founding seats are sold out. Standard membership is still available."
          : "That plan is not available. Standard membership is still available.";
      return NextResponse.json(
        { error: msg, tierSoldOut: tier },
        { status: 409 },
      );
    }
  }

  // Pull the latest member row to see if they already have a Stripe customer/sub.
  const { data: member, error: memErr } = await sb
    .from("members")
    .select(
      "id, email, first_name, last_name, stripe_customer_id, stripe_subscription_id, subscription_status, founding_member_locked",
    )
    .eq("id", guard.memberId)
    .single();

  if (memErr || !member) {
    if (memErr) {
      return serverError(memErr, { route, extra: { stage: "member_lookup" } });
    }
    return apiError.notFound(route);
  }

  // If they already have an active subscription, don't double-charge — send
  // them to the Customer Portal instead.
  if (
    member.stripe_subscription_id &&
    (member.subscription_status === "active" || member.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      {
        error: "You already have an active subscription.",
        redirectTo: "/api/stripe/portal",
      },
      { status: 409 },
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripe();
    priceId = priceIdFor(plan);
  } catch (err) {
    // Specific Stripe-config errors stay in server logs; user gets a
    // generic "service unavailable" response.
    return serverError(err, { route, status: 503, extra: { stage: "stripe_init" } });
  }

  // FINAL pricing decision (18 Aug 2026): standard founding annual is
  // $490; with a 3-month code applied the annual becomes $441 — a
  // separate Stripe Price used ONLY here, so the trial converts into
  // exactly what the card promised ("then $441/yr").
  // Only 3-month (90-day) codes earn the $441 annual; a 30-day welcome
  // code keeps the standard $490 annual with its free month up front.
  if (promo && plan === "founding_annual" && promo.trial_days >= 90) {
    const promoAnnual = process.env.STRIPE_PRICE_FOUNDING_ANNUAL_PROMO;
    if (!promoAnnual) {
      console.error("[checkout] STRIPE_PRICE_FOUNDING_ANNUAL_PROMO is not set — promo-annual blocked");
      return apiError.badRequest(
        "Annual billing with a code isn't available right now. Choose monthly, or remove the code.",
        route,
      );
    }
    priceId = promoAnnual;
  }

  // Create or reuse the Stripe Customer for this member. Storing the
  // customer_id back in our DB means we never create duplicates.
  let customerId = member.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: member.email,
      name: [member.first_name, member.last_name].filter(Boolean).join(" ") || undefined,
      metadata: { member_id: member.id },
    });
    customerId = customer.id;
    await sb.from("members").update({ stripe_customer_id: customerId }).eq("id", member.id);
  }

  const origin = appOrigin();
  const tier = tierForPlan(plan);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      // Promo code → free trial: card on file now, first charge after.
      // Welcome-back grant → 30-day trial the same way.
      ...(promo ? { trial_period_days: promo.trial_days } : recovery ? { trial_period_days: 30 } : {}),
      metadata: {
        member_id: member.id,
        plan,
        billing_interval: billingIntervalFor(plan),
        tier,
        founding_member: isFoundingPlan(plan) ? "true" : "false",
        early_member: isEarlyPlan(plan) ? "true" : "false",
        ...(promo ? { promo_code: promo.code, promo_code_id: promo.id } : {}),
        ...(recovery ? { recovery_row_id: recovery.rowId, recovery_code: recovery.code } : {}),
      },
    },
    metadata: {
      member_id: member.id,
      plan,
      tier,
      ...(promo ? { promo_code: promo.code, promo_code_id: promo.id } : {}),
      ...(recovery ? { recovery_row_id: recovery.rowId, recovery_code: recovery.code } : {}),
    },
    success_url: `${origin}/upgrade?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/upgrade?subscribed=0`,
  });

  if (!session.url) {
    return serverError(new Error("Stripe checkout session missing url"), {
      route,
      extra: { stage: "session_create" },
    });
  }

  return NextResponse.json({ url: session.url });
}
