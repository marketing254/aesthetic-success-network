import { NextResponse } from "next/server";
import { requirePortalPartner } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe, partnerPriceIdFor, PARTNER_PLAN_DISPLAY } from "@/lib/stripe";
import { applySubscriptionToBusiness } from "@/lib/billing";
import { clientIp, hashIp, userAgent, asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { sendAgreementSignedEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  let body: { setupIntentId?: string; paymentMethodId?: string; agreementVersion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const setupIntentId = asString(body.setupIntentId);
  const paymentMethodId = asString(body.paymentMethodId);
  const agreementVersion = asString(body.agreementVersion) || "v1";
  if (!setupIntentId || !paymentMethodId) {
    return NextResponse.json({ error: "Missing setup intent or payment method." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: partner } = await supabase
      .from("partner_applications")
      .select("id, contact_email, contact_name, company_name, stripe_customer_id, program_started_at, stripe_subscription_id")
      .eq("id", guard.rowId)
      .maybeSingle();
    if (!partner?.stripe_customer_id) {
      return NextResponse.json({ error: "Start billing setup first." }, { status: 400 });
    }
    if (partner.stripe_subscription_id) {
      return NextResponse.json({ error: "You already have a subscription." }, { status: 409 });
    }

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.customer !== partner.stripe_customer_id || setupIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Card setup didn't complete." }, { status: 400 });
    }

    await stripe.customers.update(partner.stripe_customer_id as string, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const plan = "partner_growth_monthly" as const;
    const sub = await stripe.subscriptions.create({
      customer: partner.stripe_customer_id as string,
      items: [{ price: partnerPriceIdFor(plan) }],
      trial_period_days: 180,
      default_payment_method: paymentMethodId,
      trial_settings: { end_behavior: { missing_payment_method: "pause" } },
      metadata: { audience: "partner", partner_application_id: partner.id as string, plan },
      expand: ["default_payment_method", "items.data.price"],
    });

    await applySubscriptionToBusiness(supabase, { table: "partner_applications", id: partner.id as string }, sub, stripe);

    const signedAt = new Date();
    const ip = clientIp(req);
    const ipHash = hashIp(ip);
    const patch: Record<string, unknown> = {
      founding_partner_locked: true,
      billing_agreement_signed_at: signedAt.toISOString(),
      billing_agreement_version: agreementVersion,
      billing_agreement_ip_hash: ipHash,
      billing_agreement_user_agent: userAgent(req),
    };
    if (!partner.program_started_at) patch.program_started_at = signedAt.toISOString();
    await supabase.from("partner_applications").update(patch).eq("id", partner.id);

    try {
      const pdfBuffer = await renderAgreementPdf({
        role: "partner",
        agreementVersion,
        planLabel: PARTNER_PLAN_DISPLAY[plan].label,
        signer: { name: (partner.contact_name as string) ?? "", email: partner.contact_email as string, companyName: (partner.company_name as string) ?? null },
        signedAt,
        ipHashLast6: ipHash.slice(-6),
      });
      const pdfPath = `partner/${partner.id}/${signedAt.getTime()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("agreements")
        .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
      if (!upErr) {
        await supabase.from("partner_applications").update({ billing_agreement_pdf_path: pdfPath }).eq("id", partner.id);
      }
      await sendAgreementSignedEmail({
        role: "partner",
        to: partner.contact_email as string,
        name: (partner.contact_name as string) ?? "",
        planLabel: PARTNER_PLAN_DISPLAY[plan].label,
        agreementVersion,
        pdfBuffer,
      });
    } catch (err) {
      console.error("[partner:trial:start] agreement PDF/email failed (non-fatal):", err);
    }

    return NextResponse.json({ ok: true, status: sub.status });
  } catch (err) {
    console.error("[partner:trial:start] failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
