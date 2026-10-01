import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { clientIp } from "@/lib/security/hashIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/founding/[code]/prepare
 *
 * Public (unguessable-code-gated). Validates the invite, marks it
 * `viewed`, ensures a Stripe customer, and returns a SetupIntent
 * client_secret so the founding accept card can render the payment
 * element. No login — the code is the credential.
 *
 * Every role saves a card: founding experts start a 12-month trial that
 * converts to $39/month, founding companies are billed $39/month from
 * acceptance.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!code) return NextResponse.json({ error: "Missing code." }, { status: 400 });

  // The code is the only credential, so cap guesses per IP (5 per 10 min,
  // the shared public-route limit) before any lookup or Stripe call.
  // The acceptance page calls this on every load (SetupIntent); allow
  // generous reloads while still stopping scripted abuse.
  const rl = await checkRateLimit(`founding-prepare:${clientIp(req)}`, { maxHits: 60, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return apiError.rateLimited("POST /api/founding/[code]/prepare");

  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("founding_invites")
    .select("id, role, email, full_name, company_name, status, expires_at, stripe_customer_id")
    .eq("code", code)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });
  }
  if (invite.status === "draft") {
    // Draft invites haven't been sent — the link isn't active yet.
    return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invite has already been accepted." }, { status: 409 });
  }
  if (invite.status === "revoked") {
    return NextResponse.json({ error: "This invite has been revoked." }, { status: 410 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 410 });
  }

  // Mark viewed (best-effort, only bumps from sent).
  if (invite.status === "sent") {
    await sb
      .from("founding_invites")
      .update({ status: "viewed", viewed_at: new Date().toISOString() } as never)
      .eq("id", invite.id);
  }
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/founding/[code]/prepare", status: 503 });
  }

  let customerId = invite.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: invite.email,
      name: invite.company_name || invite.full_name || undefined,
      metadata: { founding_invite: code, audience: "founding" },
    });
    customerId = customer.id;
    await sb
      .from("founding_invites")
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", invite.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: { founding_invite: code, purpose: "founding_accept" },
  });
  if (!setupIntent.client_secret) {
    return NextResponse.json({ error: "Stripe didn't return a client secret." }, { status: 500 });
  }

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
