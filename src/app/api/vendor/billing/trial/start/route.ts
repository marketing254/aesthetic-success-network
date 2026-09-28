import { NextResponse } from "next/server";
import { getStripe, appOrigin, partnerPriceIdFor, TRIAL_DAYS } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireVendor } from "@/lib/auth/guards";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { sendJoinConfirmationEmail } from "@/lib/email/joinConfirmation";
import { serverError } from "@/lib/api/errorResponse";
import { clientIp, hashIp } from "@/lib/security/hashIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/billing/trial/start
 *
 * Second half of the trial-start flow. Given the setupIntentId +
 * paymentMethodId (from the /prepare step's <PaymentElement>
 * confirmation), attaches the card as default, records the agreement
 * acceptance stamp, and creates the subscription with trial_period_days
 * = 180. No $0 catalog item — Stripe zeroes the trial on the $49 price.
 */

type Body = { setupIntentId?: string; paymentMethodId?: string; agreementVersion?: string };



export async function POST(req: Request) {
  const guard = await requireVendor();
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
    priceGrowth = partnerPriceIdFor("partner_growth_monthly");
  } catch (err) {
    return serverError(err, { route: "POST /api/vendor/billing/trial/start", status: 503 });
  }

  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id, contact_email, billing_email, company_name, contact_name, stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", guard.vendorId)
    .maybeSingle();
  if (!vendor?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer on file." }, { status: 404 });
  }
  if (
    vendor.stripe_subscription_id &&
    (vendor.subscription_status === "active" || vendor.subscription_status === "trialing")
  ) {
    return NextResponse.json(
      { error: "You already have an active subscription." },
      { status: 409 },
    );
  }

  // Verify SetupIntent belongs to this customer.
  const si = await stripe.setupIntents.retrieve(setupIntentId);
  if (
    si.status !== "succeeded" ||
    typeof si.customer !== "string" ||
    si.customer !== vendor.stripe_customer_id
  ) {
    return NextResponse.json({ error: "Payment setup didn't complete." }, { status: 400 });
  }
  if (typeof si.payment_method !== "string" || si.payment_method !== paymentMethodId) {
    return NextResponse.json({ error: "Payment method mismatch." }, { status: 400 });
  }

  // Attach the card and make it the default.
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: vendor.stripe_customer_id,
    });
  } catch {
    // Already attached.
  }
  await stripe.customers.update(vendor.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Create the subscription with 180-day trial. missing_payment_method:
  // pause means Stripe pauses instead of hard-fails if the card fails
  // when the trial converts.
  let subscription;
  try {
    subscription = await stripe.subscriptions.create({
      customer: vendor.stripe_customer_id,
      items: [{ price: priceGrowth }],
      trial_period_days: TRIAL_DAYS,
      default_payment_method: paymentMethodId,
      trial_settings: { end_behavior: { missing_payment_method: "pause" } },
      metadata: {
        audience: "vendor",
        vendor_id: vendor.id,
        plan: "partner_growth_monthly",
      },
      expand: ["latest_invoice"],
    });
  } catch (err) {
    return serverError(err, {
        route: "POST /api/vendor/billing/trial/start",
        status: 502,
        publicMessage: "Stripe rejected the subscription. Check the card details and try again.",
      });
  }

  // `default_payment_method` came in as a string ID from the create
  // call, so `subscription.default_payment_method` is still a string,
  // not an object — reading `.card` off it silently returned null and
  // left card_brand/card_last4 NULL on the vendors row. Fetch the
  // payment method explicitly so the portal renders the card right
  // after the reload.
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }
  } catch (err) {
    console.error("[vendor:trial:start] payment_method retrieve failed", err);
  }

  const signedAt = new Date();
  const ipHash = hashIp(clientIp(req));
  const userAgent = req.headers.get("user-agent") ?? null;

  await sb
    .from("vendors")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceGrowth,
      subscription_status: subscription.status, // "trialing"
      subscription_interval: "month",
      current_period_end:
        typeof subscription.items.data[0]?.current_period_end === "number"
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
      card_brand: cardBrand,
      card_last4: cardLast4,
      founding_partner_locked: true,
      agreement_signed_at: signedAt.toISOString(),
      agreement_version: agreementVersion,
      agreement_ip_hash: ipHash,
      agreement_user_agent: userAgent,
    } as never)
    .eq("id", vendor.id);

  // Best-effort PDF + email — acceptance is already stamped on the row.
  try {
    const pdfBuffer = await renderAgreementPdf({
      role: "partner",
      agreementVersion,
      signer: {
        name: vendor.contact_name ?? "Partner",
        email: vendor.contact_email,
        companyName: vendor.company_name ?? null,
      },
      signedAt,
      ipHashLast6: ipHash.slice(-6),
    });
    const pdfPath = `vendor/${vendor.id}/${signedAt.getTime()}.pdf`;
    const { error: upErr } = await sb.storage
      .from("agreements")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await sb
        .from("vendors")
        .update({ agreement_pdf_path: pdfPath } as never)
        .eq("id", vendor.id);
    }
    void sendJoinConfirmationEmail({
      role: "partner",
      to: vendor.billing_email ?? vendor.contact_email,
      contactName: vendor.contact_name ?? "Partner",
      companyName: vendor.company_name ?? null,
      pdfBuffer,
      pdfFilename: `ASN-Provider-Agreement-${agreementVersion}.pdf`,
      portalUrl: `${appOrigin()}/vendor/account`,
      agreementVersion,
    });
  } catch (err) {
    console.error("[vendor:trial:start] PDF/email failed", err);
  }

  return NextResponse.json({ ok: true, status: subscription.status });
}
