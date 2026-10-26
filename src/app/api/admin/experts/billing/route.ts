import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";
import { FOUNDING_EXPERT_CAP, getStripe } from "@/lib/stripe";
import { FREE_EXPERT_LABEL } from "@/lib/providerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expert billing exemption — admin control (MANUAL OVERRIDE ONLY).
 *
 * Up to FOUNDING_EXPERT_CAP (20) experts can be marked billing-exempt:
 * `experts.billing_exempt = true` means they are never charged, never
 * asked for a card, and never see the billing UI. Founding invites do NOT
 * set this: every expert (founding invite or website signup) gets the first
 * 12 months (founding) or 6 months (website) free from the member launch, then $39/month flat.
 *
 * Expert-side ONLY. A founding expert who also lists a company keeps
 * paying through their `vendors` row — this endpoint never touches it.
 *
 * Two invariants are enforced by database triggers, NOT here, because the
 * flag can also be set by the repair script or a future onboarding step:
 *   - 0042: an exemption can never be un-set (lifetime grant)
 *   - 0043: at most 20 exemptions can exist
 * We surface those trigger errors as clean 409s instead of a 500.
 */

type Body = { expertId?: string; email?: string; action?: string };

/** GET — how many billing-exemption overrides are used / left. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("experts")
      .select("id, email, display_name, full_name, billing_exempt, billing_exempt_reason, billing_exempt_granted_at")
      .eq("billing_exempt", true);
    if (error) return serverError(error, { route: "admin/experts/billing" });

    const used = data?.length ?? 0;
    return NextResponse.json({
      cap: FOUNDING_EXPERT_CAP,
      used,
      remaining: Math.max(0, FOUNDING_EXPERT_CAP - used),
      experts: data ?? [],
    });
  } catch (err) {
    return serverError(err, { route: "admin/experts/billing" });
  }
}

/**
 * PATCH — grant the billing exemption (manual override) to one expert.
 *
 * Body: { expertId | email, action: "grant_free" }
 *
 * There is deliberately no "revoke" action: the grant is a promise we
 * made to the founding cohort, and 0042's trigger blocks un-setting it
 * at the database level anyway.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "grant_free") {
    return NextResponse.json(
      { error: 'Unsupported action. Only "grant_free" is allowed. An exemption is a lifetime grant and cannot be revoked.' },
      { status: 400 },
    );
  }
  if (!body.expertId && !body.email) {
    return NextResponse.json({ error: "expertId or email is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const lookup = supabase
      .from("experts")
      .select("id, email, display_name, full_name, billing_exempt, stripe_customer_id, stripe_subscription_id");
    const { data: expert, error: findErr } = body.expertId
      ? await lookup.eq("id", body.expertId).maybeSingle()
      : await lookup.ilike("email", body.email!).maybeSingle();

    if (findErr) return serverError(findErr, { route: "admin/experts/billing" });
    if (!expert) {
      return NextResponse.json(
        { error: "No expert found. They must be onboarded (have an experts row) before they can be made free." },
        { status: 404 },
      );
    }

    const name = expert.display_name || expert.full_name || expert.email;

    if (expert.billing_exempt) {
      return NextResponse.json({ ok: true, alreadyExempt: true, message: `${name} is already a ${FREE_EXPERT_LABEL}.` });
    }

    // Pre-flight so the common case gets a friendly message rather than a
    // raw trigger exception. The trigger is still the real enforcement.
    const { count } = await supabase
      .from("experts")
      .select("id", { count: "exact", head: true })
      .eq("billing_exempt", true);
    if ((count ?? 0) >= FOUNDING_EXPERT_CAP) {
      return NextResponse.json(
        {
          error: `All ${FOUNDING_EXPERT_CAP} billing-exemption overrides are used. ${name} stays on their normal expert billing.`,
          cap: FOUNDING_EXPERT_CAP,
          used: count ?? 0,
          remaining: 0,
        },
        { status: 409 },
      );
    }

    // "Take the payment off": cancel the expert subscription (and its
    // schedule) right away and remove the saved card so it can never be
    // charged. The vendors row (if they also run a company) keeps its own
    // subscription on the same Stripe customer, so only detach the card
    // when nothing else on the customer still bills.
    const stripeNotes: string[] = [];
    if (expert.stripe_subscription_id || expert.stripe_customer_id) {
      try {
        const stripe = getStripe();
        if (expert.stripe_subscription_id) {
          const sub = await stripe.subscriptions.retrieve(expert.stripe_subscription_id).catch(() => null);
          if (sub && sub.status !== "canceled") {
            const scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
            if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId).catch(() => null);
            await stripe.subscriptions.cancel(expert.stripe_subscription_id, { prorate: false });
            stripeNotes.push("expert subscription cancelled");
          }
        }
        if (expert.stripe_customer_id) {
          const remaining = await stripe.subscriptions.list({ customer: expert.stripe_customer_id, status: "all", limit: 20 });
          const stillBilling = remaining.data.some((s) => s.status !== "canceled" && s.status !== "incomplete_expired");
          if (!stillBilling) {
            const pms = await stripe.paymentMethods.list({ customer: expert.stripe_customer_id, type: "card", limit: 20 });
            for (const pm of pms.data) await stripe.paymentMethods.detach(pm.id).catch(() => null);
            if (pms.data.length) stripeNotes.push(`${pms.data.length} card${pms.data.length === 1 ? "" : "s"} removed`);
          } else {
            stripeNotes.push("card kept: their company subscription still uses it");
          }
        }
      } catch (err) {
        console.error("[admin/experts/billing] Stripe cleanup failed:", err);
        return NextResponse.json({ error: "Couldn't cancel their Stripe billing. Nothing was changed. Check Stripe and try again." }, { status: 502 });
      }
    }

    const { error: upErr } = await supabase
      .from("experts")
      .update({
        billing_exempt: true,
        billing_exempt_reason: `${FREE_EXPERT_LABEL} (admin console). Granted by ${guard.email}.`,
        billing_exempt_granted_at: new Date().toISOString(),
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_status: null,
        current_period_end: null,
        card_brand: null,
        card_last4: null,
      } as never)
      .eq("id", expert.id);

    if (upErr) {
      // 0043's cap trigger / 0042's revoke guard surface as raised
      // exceptions — report them as a conflict, not a server fault.
      if (/cap reached|cannot be un-set/i.test(upErr.message)) {
        return NextResponse.json({ error: upErr.message }, { status: 409 });
      }
      return serverError(upErr, { route: "admin/experts/billing" });
    }

    await supabase.from("review_actions").insert({
      target_type: "expert",
      target_id: expert.id,
      action: "grant_billing_exempt",
      note: `Billing exemption, manual override (cap ${FOUNDING_EXPERT_CAP})`,
      admin_id: guard.adminId,
    });

    const used = (count ?? 0) + 1;
    return NextResponse.json({
      ok: true,
      message: `${name} is now a ${FREE_EXPERT_LABEL}${stripeNotes.length ? ` (${stripeNotes.join(", ")})` : ""}. ${FOUNDING_EXPERT_CAP - used} of ${FOUNDING_EXPERT_CAP} free slots left.`,
      cap: FOUNDING_EXPERT_CAP,
      used,
      remaining: Math.max(0, FOUNDING_EXPERT_CAP - used),
    });
  } catch (err) {
    return serverError(err, { route: "admin/experts/billing" });
  }
}
