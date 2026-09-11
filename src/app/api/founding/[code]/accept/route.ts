import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { clientIp } from "@/lib/forms/request";
import { getStripe, appOrigin, priceIdFor, FOUNDING_MEMBER_CAP } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/founding/[code]/accept — PUBLIC (no login required; the
 * unguessable code IS the credential). Body: { agreementAccepted: boolean }.
 *
 * Creates a Stripe Checkout Session for the Founding plan and returns
 * its URL. Deliberately does NOT create the `members` row here — that
 * only happens once /welcome verifies the payment actually went through
 * (see src/app/welcome/page.tsx), so a visitor can never get portal
 * access without paying. This route only reserves nothing beyond the
 * invite itself; the founding-seat cap is enforced again at /welcome.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let body: { agreementAccepted?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (body.agreementAccepted !== true) {
    return NextResponse.json({ error: "Please agree to the Member Agreement to continue." }, { status: 400 });
  }

  const rl = checkRateLimit(`founding-accept:${clientIp(req)}:${code}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[founding:accept] supabase not configured:", err);
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  }

  const { data: invite } = await supabase
    .from("founding_member_invites")
    .select("id, full_name, email, practice_name, status, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invite has already been accepted." }, { status: 409 });
  }
  if (invite.status === "revoked" || new Date(invite.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "This invite has expired or been revoked." }, { status: 410 });
  }

  // A founding invite is for a brand-new member. If this email already
  // belongs to an active member, send them to log in instead of double-
  // creating a Stripe customer.
  const { data: existingMember } = await supabase
    .from("members")
    .select("id")
    .ilike("email", invite.email as string)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      { error: "This email already has a membership. Please log in instead.", redirectTo: "/login" },
      { status: 409 },
    );
  }

  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("founding_member_locked", true);
  if ((count ?? 0) >= FOUNDING_MEMBER_CAP) {
    return NextResponse.json(
      { error: "Founding seats are sold out — please email hello@aestheticsuccessnetwork.com." },
      { status: 409 },
    );
  }

  try {
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: invite.email as string,
      name: invite.full_name as string,
      metadata: { channel: "founding_invite", invite_id: invite.id as string },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceIdFor("founding_monthly"), quantity: 1 }],
      subscription_data: {
        metadata: { audience: "member", plan: "founding_monthly", tier: "founding" },
      },
      metadata: {
        channel: "founding_invite",
        invite_id: invite.id as string,
        invite_code: code,
      },
      success_url: `${appOrigin()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/founding/${code}?canceled=1`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("[founding:accept] checkout session failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
