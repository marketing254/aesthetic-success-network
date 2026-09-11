import { NextResponse } from "next/server";
import { requirePortalPartner } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data: partner } = await supabase
      .from("partner_applications")
      .select("id, contact_email, contact_name, company_name, stripe_customer_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!partner) {
      return NextResponse.json({ error: "Partner not found." }, { status: 404 });
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      usage: "off_session",
      metadata: { audience: "partner", partner_application_id: partner.id as string, purpose: "trial_start" },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret, agreementHref: "/provider-agreement" });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
