import { NextResponse } from "next/server";
import { appOrigin, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expert/billing/portal
 *
 * Opens the Stripe Customer Portal for the signed-in expert. They use
 * this to update their card, cancel, switch from monthly to annual, and
 * download invoices — all without us building any of that UI ourselves.
 *
 * Returns 404 if the expert hasn't subscribed yet (no Stripe customer).
 */
export async function POST() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb
    .from("experts")
    .select("stripe_customer_id")
    .eq("id", guard.expertId)
    .single();

  if (!expert?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found. Activate your subscription first." },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/expert/billing/portal", status: 503 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: expert.stripe_customer_id,
    return_url: `${appOrigin()}/expert/billing`,
  });

  return NextResponse.json({ url: session.url });
}
