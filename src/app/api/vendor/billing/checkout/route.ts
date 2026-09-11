import { NextResponse } from "next/server";
import { requirePortalPartner } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import { getStripe, appOrigin, partnerPriceIdFor, ALL_PARTNER_PLAN_KEYS, type PartnerPlanKey } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const plan = body.plan as PartnerPlanKey;
  if (!ALL_PARTNER_PLAN_KEYS.includes(plan)) {
    return NextResponse.json({ error: "Pick a valid plan." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: partner } = await supabase
      .from("partner_applications")
      .select("id, contact_email, contact_name, stripe_customer_id, subscription_status, stripe_subscription_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!partner) {
      return NextResponse.json({ error: "Partner not found." }, { status: 404 });
    }
    if (partner.stripe_subscription_id && (partner.subscription_status === "active" || partner.subscription_status === "trialing")) {
      return NextResponse.json(
        { error: "You already have an active subscription.", redirectTo: "/api/vendor/billing/portal" },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    let customerId = partner.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: partner.contact_email as string,
        name: (partner.contact_name as string) || undefined,
        metadata: { audience: "partner", partner_application_id: partner.id as string },
      });
      customerId = customer.id;
      await supabase.from("partner_applications").update({ stripe_customer_id: customerId }).eq("id", partner.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: partnerPriceIdFor(plan), quantity: 1 }],
      subscription_data: { metadata: { audience: "partner", partner_application_id: partner.id as string, plan } },
      metadata: { audience: "partner", partner_application_id: partner.id as string, plan },
      success_url: `${appOrigin()}/vendor/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/vendor/billing?subscribed=0`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
