import { NextResponse } from "next/server";
import {
  getStripe,
  appOrigin,
  partnerPriceIdFor,
  expertPriceIdFor,
  appUrl,
  FOUNDING_EXPERT_TRIAL_DAYS,
  createCompanyLadderSchedule,
} from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderFoundingAgreementPdf } from "@/lib/pdf/foundingAgreementPdf";
import { sendJoinConfirmationEmail } from "@/lib/email/joinConfirmation";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { serverError } from "@/lib/api/errorResponse";
import { clientIp, hashIp } from "@/lib/security/hashIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// Founding billing (owner decision 2026-09-30). Every founding invite saves
// a card at acceptance; what happens next depends on the role:
//   • Expert side (role expert / both): ONE subscription on the expert
//     growth price with a 365-day trial (FOUNDING_EXPERT_TRIAL_DAYS).
//     $0 for 12 months, then $39/month for good. No billing_exempt.
//   • Company side (role partner / both): $39/month from day 1.
//       pricing_plan "ladder" (default): subscription schedule, phase 1 =
//         partner growth price x 12 iterations, phase 2 = the $149
//         founding standard price (open-ended).
//       pricing_plan "flat_49": plain subscription on the growth price,
//         $39/month with no increase.
//   • Role "both": both of the above on the SAME Stripe customer. The
//     expert row mirrors the expert subscription, the vendor row mirrors
//     the company subscription.

type Body = { setupIntentId?: string; paymentMethodId?: string };

type BillingSnapshot = {
  subscriptionId: string;
  priceId: string;
  status: string;
  periodEnd: string | null;
  /** Trial end (expert side) as ISO, when trialing. */
  trialEnd: string | null;
};

function periodEndIso(sub: { items: { data: { current_period_end?: number }[] } }): string | null {
  const v = sub.items.data[0]?.current_period_end;
  return typeof v === "number" ? new Date(v * 1000).toISOString() : null;
}


/**
 * POST /api/founding/[code]/accept
 *
 * Completes a founding invite: verifies the saved card, provisions the
 * expert and/or vendor row(s) + auth user, creates the subscription(s),
 * records the acceptance (who / version / when / IP), regenerates the
 * signed PDF, emails it, and marks the invite accepted.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const setupIntentId = (body.setupIntentId ?? "").trim();
  const paymentMethodId = (body.paymentMethodId ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Missing invite code." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("founding_invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "Already accepted." }, { status: 409 });
  }
  if (invite.status === "draft") {
    return NextResponse.json({ error: "This invite has not been sent yet." }, { status: 404 });
  }
  if (invite.status === "revoked") {
    return NextResponse.json({ error: "This invite has been revoked." }, { status: 410 });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  const wantsExpert = invite.role === "expert" || invite.role === "both";
  const wantsPartner = invite.role === "partner" || invite.role === "both";
  // Every founding role saves a card now (experts start a 12-month trial
  // that converts to $39/month; companies are billed from day 1).
  if (!setupIntentId || !paymentMethodId) {
    return NextResponse.json({ error: "Missing payment references." }, { status: 400 });
  }
  if (!invite.stripe_customer_id) {
    return NextResponse.json({ error: "Payment not set up. Refresh and retry." }, { status: 400 });
  }

  const email = invite.email.toLowerCase();
  const signerName = invite.signer_name || invite.full_name;
  const signedAt = new Date();
  const ipHash = hashIp(clientIp(req));
  const userAgent = req.headers.get("user-agent") ?? null;

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "POST /api/founding/[code]/accept", status: 503 });
  }

  const si = await stripe.setupIntents.retrieve(setupIntentId);
  if (
    si.status !== "succeeded" ||
    typeof si.customer !== "string" ||
    si.customer !== invite.stripe_customer_id ||
    si.payment_method !== paymentMethodId
  ) {
    return NextResponse.json({ error: "Payment setup didn't complete." }, { status: 400 });
  }

  const customerId: string = invite.stripe_customer_id;
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  } catch {
    /* already attached */
  }
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Card details for the portal.
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    cardBrand = pm.card?.brand ?? null;
    cardLast4 = pm.card?.last4 ?? null;
  } catch {
    /* best effort */
  }

  const ladder = invite.pricing_plan !== "flat_49";
  let expertGrowthPrice: string | null = null;
  let partnerGrowthPrice: string | null = null;
  let partnerFoundingStandardPrice: string | null = null;
  try {
    if (wantsExpert) expertGrowthPrice = expertPriceIdFor("expert_growth_monthly");
    if (wantsPartner) {
      partnerGrowthPrice = partnerPriceIdFor("partner_growth_monthly");
      if (ladder) partnerFoundingStandardPrice = partnerPriceIdFor("partner_founding_standard_monthly");
    }
  } catch (err) {
    return serverError(err, { route: "POST /api/founding/[code]/accept", status: 503 });
  }

  // ---- Expert side: 365-day trial on the expert growth price, then $39.
  let expertBilling: BillingSnapshot | null = null;
  if (wantsExpert && expertGrowthPrice) {
    try {
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: expertGrowthPrice }],
        trial_period_days: FOUNDING_EXPERT_TRIAL_DAYS,
        default_payment_method: paymentMethodId,
        trial_settings: { end_behavior: { missing_payment_method: "pause" } },
        metadata: {
          founding_invite: code,
          role: invite.role,
          pricing_plan: invite.pricing_plan,
          audience: "expert",
          plan: "expert_growth_monthly",
          ramp: "founding-expert-12mo-free",
        },
      });
      expertBilling = {
        subscriptionId: sub.id,
        priceId: expertGrowthPrice,
        status: sub.status,
        periodEnd: periodEndIso(sub),
        trialEnd: typeof sub.trial_end === "number" ? new Date(sub.trial_end * 1000).toISOString() : null,
      };
    } catch (err) {
      return serverError(err, {
        route: "POST /api/founding/[code]/accept",
        status: 502,
        publicMessage: "Stripe rejected the subscription. Check the card details and try again.",
      });
    }
  }

  // ---- Company side: $39/month from day 1 (x12), then $149 (ladder) or
  // $39 for good (flat_49).
  let partnerBilling: BillingSnapshot | null = null;
  let partnerStandardStartsAt: string | null = null;
  if (wantsPartner && partnerGrowthPrice) {
    try {
      if (ladder && partnerFoundingStandardPrice) {
        // Shared with the website company sign-and-pay route: $39 x 12
        // months from today, then $149 open-ended, as one schedule.
        const result = await createCompanyLadderSchedule({
          customerId,
          paymentMethodId,
          metadata: { founding_invite: code, role: invite.role, pricing_plan: invite.pricing_plan },
        });
        partnerBilling = {
          subscriptionId: result.subscription.id,
          priceId: partnerGrowthPrice,
          status: result.subscription.status,
          periodEnd: periodEndIso(result.subscription),
          trialEnd: null,
        };
        partnerStandardStartsAt = result.standardStartsAt;
      } else {
        // Flat plan: $39/month from today with no increase.
        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: partnerGrowthPrice }],
          default_payment_method: paymentMethodId,
          metadata: {
            founding_invite: code,
            role: invite.role,
            pricing_plan: invite.pricing_plan,
            audience: "vendor",
            plan: "partner_growth_monthly",
            ramp: "founding-company-flat",
          },
        });
        partnerBilling = {
          subscriptionId: sub.id,
          priceId: partnerGrowthPrice,
          status: sub.status,
          periodEnd: periodEndIso(sub),
          trialEnd: null,
        };
      }
    } catch (err) {
      return serverError(err, {
        route: "POST /api/founding/[code]/accept",
        status: 502,
        publicMessage: "Stripe rejected the subscription. Check the card details and try again.",
      });
    }
  }

  // Pre-create the auth user so they can log into the portal later.
  let authUserId: string | null = null;
  try {
    const { data: created } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { user_type: invite.role, invited_founding: true },
    });
    authUserId = created?.user?.id ?? null;
  } catch {
    /* already exists */
  }
  if (!authUserId) {
    // Already registered — find the existing id so we can link the rows.
    for (let page = 1; page <= 5; page += 1) {
      const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      const u = (list?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
      if (u) { authUserId = u.id; break; }
      if ((list?.users ?? []).length < 200) break;
    }
  }

  const agreementFields = {
    agreement_signed_at: signedAt.toISOString(),
    agreement_version: invite.agreement_version,
    agreement_ip_hash: ipHash,
    agreement_user_agent: userAgent,
  };
  const billingFieldsFor = (b: BillingSnapshot | null) =>
    b
      ? {
          stripe_customer_id: customerId,
          stripe_subscription_id: b.subscriptionId,
          stripe_price_id: b.priceId,
          subscription_status: b.status,
          subscription_interval: "month",
          current_period_end: b.periodEnd,
          card_brand: cardBrand,
          card_last4: cardLast4,
        }
      : {};
  // Expert row mirrors the expert subscription; vendor row mirrors the
  // company subscription. For "both" these are two different subscriptions
  // on the same customer.
  const expertSubFields = { ...agreementFields, ...billingFieldsFor(expertBilling) };
  // vendors.billing_plan (0070) drives the price ramp the company portal
  // shows: ladder = $39 months 1 to 12 then $149; flat_49 = $39 for good.
  const partnerSubFields = {
    ...agreementFields,
    ...billingFieldsFor(partnerBilling),
    billing_plan: ladder ? "founding_ladder" : "founding_flat",
  };

  let expertId: string | null = null;
  let vendorId: string | null = null;

  if (wantsExpert) {
    const { data: existing } = await sb.from("experts").select("id").eq("email", email).maybeSingle();
    if (existing) {
      expertId = existing.id;
      await sb
        .from("experts")
        .update({ ...expertSubFields, status: "active", founding_expert_locked: true } as never)
        .eq("id", expertId);
    } else {
      const { data: ins } = await sb
        .from("experts")
        .insert({
          email,
          full_name: invite.full_name,
          display_name: invite.full_name,
          // description is the long-form text — it belongs in the BIO
          // (part of the public publish gate). Specialty stays short.
          specialty: invite.category ?? invite.company_name ?? "Founding expert",
          bio: invite.description ?? null,
          company_name: invite.company_name ?? null,
          phone: invite.phone ?? null,
          website: invite.website ?? null,
          booking_link: invite.calendar_link ?? null,
          status: "active",
          months_in_program: 0,
          founding_expert_locked: true,
          ...expertSubFields,
        } as never)
        .select("id")
        .single();
      expertId = ins?.id ?? null;
    }

    // Keep the admin Experts tab complete: founding invites skip the
    // public application form, so mirror an application row here
    // (status onboarded). Without it the expert never appears in admin.
    try {
      const { data: appRow } = await sb
        .from("expert_applications")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!appRow) {
        await sb.from("expert_applications").insert({
          email,
          full_name: invite.full_name,
          specialty: invite.category ?? invite.company_name ?? "Founding expert",
          company_name: invite.company_name ?? null,
          phone: invite.phone ?? null,
          website: invite.website ?? null,
          booking_link: invite.calendar_link ?? null,
          status: "onboarded",
          source: "founding-invite",
          agreement_accepted: true,
        });
      }
    } catch (err) {
      console.error("[founding accept] application-row mirror failed:", err);
    }
  }

  if (wantsPartner) {
    const { data: existing } = await sb
      .from("vendors")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();
    if (existing) {
      vendorId = existing.id;
      await sb
        .from("vendors")
        .update({ ...partnerSubFields, status: "approved", verified: true, founding_partner_locked: true } as never)
        .eq("id", vendorId);
    } else {
      const { data: ins } = await sb
        .from("vendors")
        .insert({
          company_name: invite.company_name ?? invite.full_name,
          display_name: invite.company_name ?? invite.full_name,
          contact_name: invite.full_name,
          contact_email: email,
          contact_phone: invite.phone ?? null,
          billing_email: email,
          category: invite.category ?? null,
          website: invite.website ?? null,
          description: invite.description ?? null,
          calendar_link: invite.calendar_link ?? null,
          hotline_email: email,
          plan_id: "founding",
          status: "approved",
          verified: true,
          months_in_program: 0,
          founding_partner_locked: true,
          ...partnerSubFields,
        } as never)
        .select("id")
        .single();
      vendorId = ins?.id ?? null;
    }
  }

  // Link auth_user_id on the provisioned rows so the portal middleware's
  // own-row check resolves them on their first /vendor or /expert navigation
  // (RLS only lets an authenticated user read their own row).
  if (authUserId) {
    if (vendorId) await sb.from("vendors").update({ auth_user_id: authUserId } as never).eq("id", vendorId);
    if (expertId) await sb.from("experts").update({ auth_user_id: authUserId } as never).eq("id", expertId);
  }

  // Referral link — generate AT ACCEPTANCE so the shareable
  // www.aestheticsuccessnetwork.com/<handle> exists the moment they're in.
  // (Previously the link was only created lazily on their first visit to
  // the portal's referral section, so accepted experts who never opened
  // it had no link and the admin Referrals tab showed nothing for them.)
  // Best-effort: a failure never blocks acceptance — the admin referrals
  // sweep and the portal both self-heal it later.
  try {
    const { getOrCreateExpertReferral, getOrCreateVendorReferral } = await import("@/lib/referral");
    if (expertId) await getOrCreateExpertReferral(expertId, invite.full_name);
    if (vendorId) await getOrCreateVendorReferral(vendorId, invite.company_name ?? invite.full_name);
  } catch (err) {
    console.error("[founding accept] referral-link generation failed (self-heals later):", err);
  }

  // Fan out the EXTRA companies (companies[1..]) into covered listings under
  // the principal partner. One fee already covers them; each is created as a
  // draft (pending_review) for the team to publish. companies[0] is the
  // principal created above.
  if (wantsPartner && vendorId && Array.isArray(invite.companies) && invite.companies.length > 1) {
    const emailLocal = email.split("@")[0] ?? "partner";
    const emailDomain = email.split("@")[1] ?? "example.com";
    const extras = invite.companies.slice(1);
    for (let i = 0; i < extras.length; i++) {
      const c = extras[i];
      const name = (c?.name ?? "").trim();
      if (!name) continue;
      // Each covered company needs its own contact email. Use the provided
      // one; otherwise a plus-addressed alias of the principal keeps it
      // unique and still deliverable to them.
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || `co${i + 2}`;
      const cEmail = c.contact_email?.trim().toLowerCase() || `${emailLocal}+${slug}@${emailDomain}`;
      // eslint-disable-next-line no-await-in-loop
      const { data: dup } = await sb.from("vendors").select("id").eq("contact_email", cEmail).maybeSingle();
      if (dup) continue;
      // eslint-disable-next-line no-await-in-loop
      await sb.from("vendors").insert({
        company_name: name,
        display_name: name,
        contact_name: invite.full_name,
        contact_email: cEmail,
        billing_email: email,
        category: c.category ?? null,
        website: c.website ?? null,
        description: c.description ?? null,
        calendar_link: c.calendar_link ?? null,
        plan_id: "covered",
        billing_parent_id: vendorId,
        status: "pending_review",
        verified: false,
        months_in_program: 0,
      } as never);
    }
  }

  // Regenerate the signed PDF (with the acceptance record filled).
  let signedPdf: Buffer | null = null;
  let signedPath: string | null = null;
  try {
    signedPdf = await renderFoundingAgreementPdf({
      role: invite.role,
      pricing: invite.pricing_plan,
      signer: { name: signerName, email, companyName: invite.company_name },
      companies: invite.companies ?? undefined,
      memberOffer: invite.member_offer,
      signedAt,
      ipHashLast6: ipHash.slice(-6),
      accepted: true,
    });
    signedPath = `founding/${code}-signed.pdf`;
    await sb.storage
      .from("agreements")
      .upload(signedPath, signedPdf, { contentType: "application/pdf", upsert: true });
    if (expertId) {
      await sb.from("experts").update({ agreement_pdf_path: signedPath } as never).eq("id", expertId);
    }
    if (vendorId) {
      await sb.from("vendors").update({ agreement_pdf_path: signedPath } as never).eq("id", vendorId);
    }
  } catch (err) {
    console.error("[founding:accept] signed PDF failed", err);
  }

  // Mark the invite accepted.
  await sb
    .from("founding_invites")
    .update({
      status: "accepted",
      accepted_at: signedAt.toISOString(),
      accepted_ip_hash: ipHash,
      accepted_user_agent: userAgent,
      // One column on the invite: prefer the company subscription (the one
      // billed from day 1), else the expert one.
      stripe_subscription_id: partnerBilling?.subscriptionId ?? expertBilling?.subscriptionId ?? null,
      agreement_pdf_path: signedPath ?? invite.agreement_pdf_path,
      expert_id: expertId,
      vendor_id: vendorId,
    } as never)
    .eq("id", invite.id);

  // No code or magic-link is sent here. The confirmation email below tells
  // them to check their inbox and sign in; the portal login screen is what
  // sends the 6-digit code, only once they submit their email there.
  if (signedPdf) {
    void sendJoinConfirmationEmail({
      role: invite.role,
      pricing: invite.pricing_plan,
      to: email,
      contactName: signerName,
      companyName: invite.company_name,
      pdfBuffer: signedPdf,
      pdfFilename: `ASN-Founding-Agreement-${invite.agreement_version}.pdf`,
      portalUrl: `${appOrigin()}${wantsExpert ? "/expert/login" : "/vendor/login"}`,
      agreementVersion: invite.agreement_version,
      signedAt,
      memberOffer: invite.member_offer,
      companies: invite.companies ?? undefined,
      founding: true,
      expertTrialEndsAt: expertBilling?.trialEnd ?? expertBilling?.periodEnd ?? null,
      partnerStandardStartsAt,
      cardCaptured: true,
    });
  }

  // Alert the whole team that the invitee accepted + saved their card so
  // they know this person is ready to sign in.
  const nice = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  void notifyTeamEvent({
    kind: "invite_accepted",
    role: invite.role,
    name: signerName,
    email,
    adminLink: appUrl("/admin/founding"),
    highlight: "Card on file. They're ready to sign in.",
    fields: [
      { label: "Role", value: invite.role === "both" ? "Expert + Company" : invite.role },
      { label: "Company", value: invite.company_name },
      { label: "Payment method", value: "On file" },
      { label: "Expert subscription", value: expertBilling?.status ?? null },
      { label: "Expert free period ends", value: nice(expertBilling?.trialEnd ?? null) },
      { label: "Company subscription", value: partnerBilling?.status ?? null },
      {
        label: "Company rate",
        value: partnerBilling ? (ladder ? "$39/month for 12 months, then $149/month" : "$39/month, no increase") : null,
      },
      { label: "Company $149 starts", value: nice(partnerStandardStartsAt) },
      { label: "Member offer", value: invite.member_offer },
    ],
  });

  const loginPath = wantsExpert ? "/expert/login" : "/vendor/login";
  const next = `${loginPath}?welcome=1&prefill=${encodeURIComponent(email)}`;
  return NextResponse.json({ ok: true, next });
}
