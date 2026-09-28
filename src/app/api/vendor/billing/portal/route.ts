import { NextResponse } from "next/server";
import { appOrigin, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/billing/portal
 *
 * Opens the Stripe Customer Portal for the signed-in vendor. They use
 * this to update their card, cancel, switch from monthly to annual, and
 * download invoices.
 *
 * Returns 404 if the vendor hasn't subscribed yet (no Stripe customer).
 */
export async function POST() {
  const guard = await requireVendor();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb
    .from("vendors")
    .select("stripe_customer_id")
    .eq("id", guard.vendorId)
    .single();

  if (!vendor?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found. Activate your subscription first." },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/vendor/billing/portal", status: 503 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: vendor.stripe_customer_id,
    return_url: `${appOrigin()}/vendor/account`,
  });

  return NextResponse.json({ url: session.url });
}
