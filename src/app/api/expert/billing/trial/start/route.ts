import { NextResponse } from "next/server";
import { getStripe, appOrigin, expertPriceIdFor, createProviderSubscription } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExpert } from "@/lib/auth/guards";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { sendJoinConfirmationEmail } from "@/lib/email/joinConfirmation";
import { serverError } from "@/lib/api/errorResponse";
import { clientIp, hashIp } from "@/lib/security/hashIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expert/billing/trial/start — mirror of the vendor version.
 * Saves the card, records the agreement acceptance and creates the expert
 * billing (free until 6 months after the member launch, then $39 for 6
 * months, then $149). Nothing is charged today.
 */
type Body = { setupIntentId?: string; paymentMethodId?: string; agreementVersion?: string };



export async function POST(req: Request) {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as Body;
  const setupIntentId = (body.setupIntentId ?? "").trim();
  const paymentMethodId = (body.paymentMethodId ?? "").trim();
  const agreementVersion = (body.agreementVersion ?? "").trim() || "v1";
  if (!setupIntentId || !paymentMethodId) {
    return NextResponse.json({ error: "Missing Stripe references." }, { status: 400 });
  }

  let stripe;
  let priceGrowth: string;
  try {
    stripe = getStripe();
    priceGrowth = expertPriceIdFor("expert_growth_monthly");
  } catch (err) {
    return serverError(err, { route: "POST /api/expert/billing/trial/start", status: 503 });
  }

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb
    .from("experts")
    .select("id, email, full_name, specialty, stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", guard.expertId)
    .maybeSingle();
  if (!expert?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer on file." }, { status: 404 });
  }
  if (
    expert.stripe_subscription_id &&
    (expert.subscription_status === "active" || expert.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      { error: "You already have an active subscription." },
      { status: 409 },
    );
  }

  const si = await stripe.setupIntents.retrieve(setupIntentId);
  if (
    si.status !== "succeeded" ||
    typeof si.customer !== "string" ||
    si.customer !== expert.stripe_customer_id
  ) {
    return NextResponse.json({ error: "Payment setup didn't complete." }, { status: 400 });
  }
  if (typeof si.payment_method !== "string" || si.payment_method !== paymentMethodId) {
    return NextResponse.json({ error: "Payment method mismatch." }, { status: 400 });
  }

  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: expert.stripe_customer_id,
    });
  } catch {
    // Already attached.
  }
  await stripe.customers.update(expert.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  let created;
  try {
    created = await createProviderSubscription({
      customerId: expert.stripe_customer_id,
      paymentMethodId,
      audience: "expert",
      metadata: { expert_id: expert.id, source: "website", ramp: "website-expert" },
    });
  } catch (err) {
    return serverError(err, {
        route: "POST /api/expert/billing/trial/start",
        status: 502,
        publicMessage: "We couldn't save your card. Nothing was charged. Please try again in a moment, and if it keeps happening email support@aestheticsuccessnetwork.com.",
      });
  }
  const subscription = created.subscription;

  // Fetch payment method explicitly — passing paymentMethodId as a
  // string to the create call means subscription.default_payment_method
  // stays a string, so reading `.card` off it silently returns null.
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }
  } catch (err) {
    console.error("[expert:trial:start] payment_method retrieve failed", err);
  }

  // Record the agreement acceptance atomically with the subscription.
  // This is the SAME moment they funded the trial — the audit trail
  // matches the exact click, not an earlier form submit.
  const signedAt = new Date();
  const ipHash = hashIp(clientIp(req));
  const userAgent = req.headers.get("user-agent") ?? null;

  await sb
    .from("experts")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceGrowth,
      subscription_status: subscription.status,
      subscription_interval: "month",
      current_period_end:
        typeof subscription.items.data[0]?.current_period_end === "number"
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
      card_brand: cardBrand,
      card_last4: cardLast4,
      founding_expert_locked: true,
      agreement_signed_at: signedAt.toISOString(),
      agreement_version: agreementVersion,
      agreement_ip_hash: ipHash,
      agreement_user_agent: userAgent,
    } as never)
    .eq("id", expert.id);

  // Best-effort PDF + email so the signer gets a copy in their inbox.
  // Failure here doesn't roll back — the acceptance is already stamped.
  try {
    const pdfBuffer = await renderAgreementPdf({
      role: "expert",
      agreementVersion,
      freePeriodEndsAt: created.freePeriodEndsAt,
      signer: {
        name: expert.full_name ?? "Expert",
        email: expert.email,
        companyName: expert.specialty ?? null,
      },
      signedAt,
      ipHashLast6: ipHash.slice(-6),
    });
    const pdfPath = `expert/${expert.id}/${signedAt.getTime()}.pdf`;
    const { error: upErr } = await sb.storage
      .from("agreements")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await sb
        .from("experts")
        .update({ agreement_pdf_path: pdfPath } as never)
        .eq("id", expert.id);
    }
    void sendJoinConfirmationEmail({
      role: "expert",
      to: expert.email,
      accountEmail: expert.email,
      contactName: expert.full_name ?? "Expert",
      companyName: expert.specialty ?? null,
      pdfBuffer,
      pdfFilename: `ASN-Provider-Agreement-${agreementVersion}.pdf`,
      portalUrl: `${appOrigin()}/expert/billing`,
      agreementVersion,
      signedAt,
      freePeriodEndsAt: created.freePeriodEndsAt,
      standardStartsAt: created.standardStartsAt,
      cardCaptured: true,
    });
  } catch (err) {
    console.error("[expert:trial:start] PDF/email failed", err);
  }

  return NextResponse.json({ ok: true, status: subscription.status });
}
