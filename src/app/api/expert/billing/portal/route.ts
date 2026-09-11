import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe, appOrigin } from "@/lib/stripe";
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
      .select("stripe_customer_id")
      .eq("id", guard.rowId)
      .maybeSingle();

    if (!expert?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer on file yet." }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: expert.stripe_customer_id as string,
      return_url: `${appOrigin()}/expert/billing`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
