import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data: expert } = await supabase
      .from("expert_applications")
      .select("id, email, full_name, company, stripe_customer_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!expert) {
      return NextResponse.json({ error: "Expert not found." }, { status: 404 });
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      usage: "off_session",
      metadata: { audience: "expert", expert_application_id: expert.id as string, purpose: "trial_start" },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret, agreementHref: "/provider-agreement" });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
