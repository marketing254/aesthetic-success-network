import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import {
  getStripe,
  appOrigin,
  priceIdFor,
  tierForPlan,
  isFoundingPlan,
  isEarlyPlan,
  billingIntervalFor,
  ALL_PLAN_KEYS,
  FOUNDING_MEMBER_CAP,
  EARLY_MEMBER_CAP,
  type SubscriptionPlanKey,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const plan = body.plan as SubscriptionPlanKey;
  if (!ALL_PLAN_KEYS.includes(plan)) {
    return NextResponse.json({ error: "Pick a valid plan." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: member } = await supabase
      .from("members")
      .select("id, email, first_name, last_name, stripe_customer_id, subscription_status, stripe_subscription_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (member.stripe_subscription_id && (member.subscription_status === "active" || member.subscription_status === "trialing")) {
      return NextResponse.json(
        { error: "You already have an active subscription.", redirectTo: "/api/stripe/portal" },
        { status: 409 },
      );
    }

    if (isFoundingPlan(plan)) {
      const { count } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("founding_member_locked", true);
      if ((count ?? 0) >= FOUNDING_MEMBER_CAP) {
        return NextResponse.json(
          { error: "Founding tier is sold out. Please choose the Early tier instead.", tierSoldOut: true },
          { status: 409 },
        );
      }
    } else if (isEarlyPlan(plan)) {
      const { count } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("early_member_locked", true);
      if ((count ?? 0) >= EARLY_MEMBER_CAP) {
        return NextResponse.json(
          { error: "Early tier is sold out. Please choose the Standard tier instead.", tierSoldOut: true },
          { status: 409 },
        );
      }
    }

    const stripe = getStripe();
    let customerId = member.stripe_customer_id as string | null;
    if (!customerId) {
      const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
      const customer = await stripe.customers.create({
        email: member.email as string,
        name: name || undefined,
        metadata: { member_id: member.id as string },
      });
      customerId = customer.id;
      await supabase.from("members").update({ stripe_customer_id: customerId }).eq("id", member.id);
    }

    const tier = tierForPlan(plan);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      subscription_data: {
        metadata: { audience: "member", member_id: member.id as string, plan, tier, billing_interval: billingIntervalFor(plan) },
      },
      metadata: { audience: "member", member_id: member.id as string, plan, tier },
      success_url: `${appOrigin()}/dashboard/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/dashboard/billing?subscribed=0`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("[stripe:checkout] failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
