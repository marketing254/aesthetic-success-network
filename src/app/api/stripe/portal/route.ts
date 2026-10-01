import { NextResponse } from "next/server";
import { appOrigin, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the signed-in member and
 * returns the redirect URL. Members use this to update their card,
 * cancel, switch between monthly/annual, and download invoices — all
 * without us building any of that UI ourselves.
 *
 * Requires that the member already has a stripe_customer_id (set during
 * the first checkout).
 */
export async function POST() {
  const guard = await requireMember();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: member } = await sb
    .from("members")
    .select("stripe_customer_id")
    .eq("id", guard.memberId)
    .single();

  if (!member?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found. Subscribe first before opening the portal." },
      { status: 404 },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/stripe/portal", status: 503 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: `${appOrigin()}/dashboard/account`,
  });

  return NextResponse.json({ url: session.url });
}
