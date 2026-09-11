import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import { getStripe, appOrigin, expertPriceIdFor, ALL_EXPERT_PLAN_KEYS, type ExpertPlanKey } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manual Growth→Standard upgrade or annual pre-pay — not the initial trial (that's trial/start, which uses a SetupIntent). */
export async function POST(req: Request) {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const plan = body.plan as ExpertPlanKey;
  if (!ALL_EXPERT_PLAN_KEYS.includes(plan)) {
    return NextResponse.json({ error: "Pick a valid plan." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: expert } = await supabase
      .from("expert_applications")
      .select("id, email, full_name, stripe_customer_id, subscription_status, stripe_subscription_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!expert) {
      return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    }
    if (expert.stripe_subscription_id && (expert.subscription_status === "active" || expert.subscription_status === "trialing")) {
      return NextResponse.json(
        { error: "You already have an active subscription.", redirectTo: "/api/expert/billing/portal" },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    let customerId = expert.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: expert.email as string,
        name: (expert.full_name as string) || undefined,
        metadata: { audience: "expert", expert_application_id: expert.id as string },
      });
      customerId = customer.id;
      await supabase.from("expert_applications").update({ stripe_customer_id: customerId }).eq("id", expert.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: expertPriceIdFor(plan), quantity: 1 }],
      subscription_data: { metadata: { audience: "expert", expert_application_id: expert.id as string, plan } },
      metadata: { audience: "expert", expert_application_id: expert.id as string, plan },
      success_url: `${appOrigin()}/expert/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/expert/billing?subscribed=0`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
