import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { applySubscriptionToBusiness, pickBestSubscription } from "@/lib/billing";
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

    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({
      customer: expert.stripe_customer_id as string,
      status: "all",
      limit: 5,
      expand: ["data.default_payment_method", "data.items.data.price"],
    });

    const best = pickBestSubscription(subs.data);
    if (!best) {
      return NextResponse.json({ error: "No subscription found for this customer." }, { status: 404 });
    }

    await applySubscriptionToBusiness(supabase, { table: "expert_applications", id: guard.rowId }, best, stripe);
    return NextResponse.json({ ok: true, status: best.status });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
