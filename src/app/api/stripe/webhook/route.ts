import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, appOrigin, appUrl } from "@/lib/stripe";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  applySubscriptionToBusiness,
  applySubscriptionToMember,
  businessForCustomer,
  memberIdForCustomer,
} from "@/lib/billing";
import { notifyTeam } from "@/lib/email/teamNotify";
import { sendTrialEndingReminder } from "@/lib/email/trialEndingReminder";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Stripe sometimes batches events; allow enough time to process.
export const maxDuration = 30;

/**
 * POST /api/stripe/webhook
 *
 * Stripe POSTs subscription / invoice events here. We:
 *   1. Verify the signature so a random caller can't spoof events
 *   2. Skip events we've already processed (idempotency)
 *   3. Update the members row to mirror the new state
 *   4. Append a row to stripe_events for the audit trail
 *
 * The signing secret comes from STRIPE_WEBHOOK_SECRET (Developers →
 * Webhooks → your endpoint → reveal "Signing secret").
 */
const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  // Newer Stripe dashboards list the same moment as invoice.payment_succeeded.
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("STRIPE_WEBHOOK_SECRET is not set", { status: 503 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[stripe webhook] Stripe client unavailable:", err);
    return new NextResponse("Stripe unavailable", { status: 503 });
  }

  // Stripe needs the raw body to verify the signature.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Idempotency — bail out if we've already processed this event id.
  // A row only exists once the handler has SUCCEEDED (see below), so a
  // Stripe retry after a failed attempt is reprocessed, not deduplicated
  // away. Every side effect inside handleEvent is idempotent on its own
  // (unique constraints, "only if null" updates, insert-first sends), so
  // a partial first attempt followed by a retry cannot double-apply.
  const { data: prior } = await sb
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (prior) {
    return NextResponse.json({ received: true, deduped: true });
  }

  const eventRow = {
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  };

  if (!RELEVANT_EVENTS.has(event.type)) {
    // Record unhandled events too — easier to add handling later if we need it.
    await sb.from("stripe_events").insert(eventRow);
    return NextResponse.json({ received: true, ignored: true });
  }

  let memberId: string | null = null;
  try {
    memberId = await handleEvent(event, stripe);
  } catch (err) {
    // Deliberately NOT recorded: with no stripe_events row the next Stripe
    // retry runs the handler again instead of short-circuiting on the
    // dedupe check above. The 500 tells Stripe to retry.
    return serverError(err, {
      route: "POST /api/stripe/webhook",
      extra: { stripeEventId: event.id, eventType: event.type },
    });
  }

  // Handler succeeded: record the event so replays are no-ops. The unique
  // index on stripe_event_id makes a concurrent double delivery collapse
  // to one row; the loser's insert error is logged, never surfaced.
  const { error: recordErr } = await sb.from("stripe_events").insert({
    ...eventRow,
    member_id: memberId,
  });
  if (recordErr) {
    console.error("[stripe webhook] could not record processed event:", recordErr.message);
  }

  return NextResponse.json({ received: true });
}

/**
 * Apply an event to our members table. Returns the affected member_id
 * (if known) so we can stamp it on the stripe_events row.
 */
async function handleEvent(event: Stripe.Event, stripe: Stripe): Promise<string | null> {
  const sb = getSupabaseAdmin();

  // ---- checkout.session.completed -----------------------------------
  // Fires the moment the customer finishes paying. We pull the freshly
  // created subscription and write the full shape onto the member row,
  // then notify the team distribution list so they can see the sale.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const memberId = (session.metadata?.member_id ?? null) as string | null;
    if (!memberId || !session.subscription) return memberId;

    const subId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["default_payment_method", "items.data.price"],
    });

    await applySubscriptionToMember(sb, memberId, sub, stripe);

    // Onboarding: send the Day 0 welcome immediately (BCC'd to the team,
    // recorded in member_onboarding_emails). Days 3/7/14 follow via the
    // hourly cron. AWAITED — fire-and-forget here let the serverless
    // function freeze mid-work (day-0 rows stuck in "sending", which the
    // cron then skips, silently killing the member's whole sequence).
    // Never throws, so the webhook still acks Stripe on any failure.
    const { onMemberActivated } = await import("@/lib/onboarding");
    await onMemberActivated(memberId);

    // Abandoned-registration sequence: a purchase for this email, from
    // ANY path, stops the sequence immediately (SPEC stop condition) and
    // burns the single-use recovery code if one was applied.
    try {
      const { data: buyerEmailRow } = await sb
        .from("members").select("email").eq("id", memberId).maybeSingle();
      if (buyerEmailRow?.email) {
        const { stopSequenceOnPurchase } = await import("@/lib/abandoned");
        await stopSequenceOnPurchase(
          buyerEmailRow.email,
          (session.metadata?.recovery_row_id as string | undefined) ?? null,
        );
      }
    } catch (err) {
      console.error("[stripe webhook] abandoned-sequence stop failed:", err);
    }

    // Summit trial checkout (SUMMIT_ENABLED only): payment method verified and the
    // $0 trial subscription exists → the event registration is ENTITLED
    // and handed to n8n for the Zoom registration. entitleRegistration is
    // idempotent (only pending rows move), so a replayed webhook cannot
    // register anyone twice. Never throws into the webhook.
    const isSummitTrial = session.metadata?.offer === "summit_trial";
    if (isSummitTrial && session.metadata?.registration_id) {
      try {
        const { entitleRegistration } = await import("@/lib/events/summit");
        await entitleRegistration(session.metadata.registration_id, "trial_checkout", {
          memberId,
          stripeSessionId: session.id,
          stripeSubscriptionId: subId,
        });
      } catch (err) {
        console.error("[stripe webhook] summit entitlement failed:", err);
      }
    }

    // Meta Conversions API — CONFIRMED Purchase for the paid-ads channel
    // only. Fired here (server-side, after verified payment) so a
    // thank-you-page visit or refresh can never fabricate a purchase.
    // The event id was minted at checkout creation and is shared with
    // the browser Pixel, so Meta de-duplicates. This whole webhook is
    // idempotent per event (stripe_events), so it sends at most once.
    //
    // A $0 TRIAL IS NOT A PURCHASE. Summit-trial sessions report
    // StartTrial with value 0 here; their Purchase fires from the first
    // PAID invoice (see invoice.paid below), with the amount actually
    // collected.
    if (session.metadata?.channel === "meta_ads") {
      try {
        const { data: buyer } = await sb
          .from("members")
          .select("email, first_name, last_name")
          .eq("id", memberId)
          .maybeSingle();
        const item = sub.items.data[0];
        const amount = (item?.price?.unit_amount ?? 0) / 100;
        const currency = item?.price?.currency ?? "usd";
        if (buyer?.email && session.metadata?.meta_event_id) {
          const { sendMetaEvent } = await import("@/lib/meta");
          await sendMetaEvent(isSummitTrial ? "StartTrial" : "Purchase", {
            eventId: session.metadata.meta_event_id,
            email: buyer.email,
            firstName: buyer.first_name,
            lastName: buyer.last_name,
            value: isSummitTrial ? 0 : amount,
            currency,
            contentName: session.metadata?.plan ?? "founding_membership",
            eventSourceUrl: session.metadata?.landing_url ?? null,
            fbp: session.metadata?.meta_fbp ?? null,
            fbc: session.metadata?.meta_fbc ?? null,
            fbclid: session.metadata?.meta_fbclid ?? null,
            clientIp: session.metadata?.client_ip ?? null,
            clientUserAgent: session.metadata?.client_ua ?? null,
          });
        }
      } catch (err) {
        console.error("[stripe webhook] meta purchase report failed:", err);
      }
    }

    // Promo-code attribution — one row per member per code, so the admin
    // console and the code owner's portal can count real uses. Idempotent
    // (unique constraint) and best-effort: a miss never blocks activation.
    const promoCodeId = (session.metadata?.promo_code_id ?? null) as string | null;
    if (promoCodeId) {
      try {
        await sb
          .from("member_promo_redemptions")
          .upsert(
            { promo_code_id: promoCodeId, member_id: memberId },
            { onConflict: "promo_code_id,member_id", ignoreDuplicates: true },
          );
      } catch (err) {
        console.error("[stripe webhook] promo redemption record failed:", err);
      }
    }

    // Sales tracker — append this sale to the team's Google Sheet via its
    // Apps Script web-app URL (SALES_TRACKER_WEBHOOK_URL). Best-effort and
    // env-gated: a missing URL or a failed append never affects the sale.
    // Idempotent like everything here — the webhook dedupes per event.
    if (process.env.SALES_TRACKER_WEBHOOK_URL) {
      try {
        // signup_channel/heard_about come from migration 0058 — not in the
        // generated types yet, so the row shape is asserted (same pattern
        // as the 0058 writes elsewhere).
        const { data: buyer } = await sb
          .from("members")
          .select("first_name, last_name, email, phone, practice_name, practice_role, tier, subscription_interval, signup_channel, heard_about, referral_code_id")
          .eq("id", memberId)
          .maybeSingle<{
            first_name: string | null; last_name: string | null; email: string | null;
            phone: string | null; practice_name: string | null; practice_role: string | null;
            tier: string | null; subscription_interval: string | null;
            signup_channel: string | null; heard_about: string | null;
            referral_code_id: string | null;
          }>();
        const item = sub.items.data[0];
        const billing = item?.price?.recurring?.interval === "year" ? "Annual" : "Monthly";
        const planPrice = (item?.price?.unit_amount ?? 0) / 100;
        const channel = buyer?.signup_channel ?? (buyer?.referral_code_id ? "referral" : "organic");
        const customerId = typeof session.customer === "string" ? session.customer : "";
        // Masterclass-tracker style "Order Details" blob — the sheet cell a
        // reader clicks to see the whole order in one place. NO card data:
        // we never receive card numbers (Stripe holds those), and even the
        // brand/last-4 receipt info is deliberately left out of the tracker.
        const orderDetails = [
          `Order ID: ${sub.id}`,
          "",
          `Name: ${[buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ")}`,
          `Email: ${buyer?.email ?? "-"}`,
          `Phone: ${buyer?.phone ?? "-"}`,
          `Practice: ${buyer?.practice_name ?? "-"}`,
          `Role: ${buyer?.practice_role ?? "-"}`,
          "",
          `Membership: ${buyer?.tier ?? "founding"}, ${billing} at $${planPrice}`,
          `Status: ${sub.status}`,
          ...(session.metadata?.promo_code ? [`Promo code: ${session.metadata.promo_code}`] : []),
          `Channel: ${channel}`,
          ...(buyer?.heard_about ? [`How they heard: ${buyer.heard_about}`] : []),
          "",
          `Stripe customer: ${customerId || "-"}`,
        ].join("\n");
        await fetch(process.env.SALES_TRACKER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "sale",
            date: new Date().toISOString(),
            firstName: buyer?.first_name ?? "",
            lastName: buyer?.last_name ?? "",
            practice: buyer?.practice_name ?? "",
            role: buyer?.practice_role ?? "",
            email: buyer?.email ?? "",
            phone: buyer?.phone ?? "",
            tier: buyer?.tier ?? "",
            billing,
            planPrice,
            status: sub.status,
            promoCode: session.metadata?.promo_code ?? "",
            channel,
            heardAbout: buyer?.heard_about ?? "",
            orderDetails,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        console.error("[stripe webhook] sales-tracker append failed:", err);
      }
    }

    // Best-effort team alert. Pull the member's name + email + amount.
    try {
      const { data: member } = await sb
        .from("members")
        .select("first_name, last_name, email, practice_name, tier, subscription_interval, referral_code_id")
        .eq("id", memberId)
        .maybeSingle();

      // Referral attribution — which expert/partner link brought them in.
      let referredBy: string | null = null;
      try {
        if (member?.referral_code_id) {
          const { data: rc } = await sb
            .from("referral_codes")
            .select("code, slug, expert_id, vendor_id")
            .eq("id", member.referral_code_id)
            .maybeSingle();
          if (rc) {
            let owner: string | null = null;
            if (rc.expert_id) {
              const { data: e } = await sb.from("experts").select("display_name, full_name").eq("id", rc.expert_id).maybeSingle();
              owner = e?.display_name || e?.full_name || null;
            } else if (rc.vendor_id) {
              const { data: v } = await sb.from("vendors").select("display_name, company_name").eq("id", rc.vendor_id).maybeSingle();
              owner = v?.display_name || v?.company_name || null;
            }
            const link = rc.slug ? `/${rc.slug}` : rc.code;
            referredBy = owner ? `${owner} (${link})` : link;
          }
        }
      } catch {
        /* best-effort — the alert still goes out without it */
      }
      const firstItem = sub.items.data[0];
      const amountCents = firstItem?.price?.unit_amount ?? 0;
      const currency = (firstItem?.price?.currency ?? "usd").toUpperCase();
      const interval = firstItem?.price?.recurring?.interval ?? null;
      const memberName = member
        ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email
        : "Unknown member";
      const amountStr = (amountCents / 100).toFixed(2);

      // Every interpolated value is escaped: member names, practice names
      // and promo codes are user- or admin-typed strings.
      const promoCode = session.metadata?.promo_code ?? null;
      const adminMembersUrl = appUrl("/admin/members");
      await notifyTeam({
        tag: "stripe-payment",
        subject: `New paid member: ${memberName}, $${amountStr}/${interval ?? "subscription"}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0A1A2F;">
            <p><strong>A new member just completed checkout.</strong></p>
            <ul>
              <li><strong>Name:</strong> ${escapeHtml(memberName)}</li>
              <li><strong>Email:</strong> ${escapeHtml(member?.email ?? "-")}</li>
              <li><strong>Practice:</strong> ${escapeHtml(member?.practice_name ?? "-")}</li>
              <li><strong>Tier:</strong> ${escapeHtml(member?.tier ?? "-")}</li>
              <li><strong>Interval:</strong> ${escapeHtml(interval ?? "-")}</li>
              <li><strong>Amount:</strong> ${escapeHtml(currency)} $${escapeHtml(amountStr)}</li>
              ${promoCode ? `<li><strong>Promo code:</strong> ${escapeHtml(promoCode)} (trial applied, first charge after)</li>` : ""}
              ${referredBy ? `<li><strong>Referred by:</strong> ${escapeHtml(referredBy)}</li>` : ""}
              <li><strong>Stripe sub:</strong> ${escapeHtml(sub.id)}</li>
            </ul>
            <p>See it at <a href="${escapeHtml(adminMembersUrl)}">/admin/members</a>.</p>
          </div>
        `,
        text: [
          "New paid member.",
          `Name:     ${memberName}`,
          `Email:    ${member?.email ?? "-"}`,
          `Practice: ${member?.practice_name ?? "-"}`,
          `Tier:     ${member?.tier ?? "-"}`,
          `Interval: ${interval ?? "-"}`,
          `Amount:   ${currency} $${amountStr}`,
          ...(promoCode ? [`Promo code: ${promoCode} (trial applied, first charge after)`] : []),
          ...(referredBy ? [`Referred by: ${referredBy}`] : []),
          `Stripe sub: ${sub.id}`,
          `See it at ${adminMembersUrl}`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[stripe webhook] team-notify failed:", err);
    }

    return memberId;
  }

  // ---- customer.subscription.* --------------------------------------
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    // Hydrate default_payment_method on the way through so we can store
    // brand + last4. The webhook payload doesn't always include it expanded.
    const hydrated = sub.default_payment_method
      ? sub
      : await stripe.subscriptions.retrieve(sub.id, { expand: ["default_payment_method"] });

    const memberId = await memberIdForCustomer(sb, customerId, sub.metadata?.member_id);
    if (memberId) {
      await applySubscriptionToMember(sb, memberId, hydrated, stripe);
      return memberId;
    }

    // Not a member — mirror onto the partner (vendor) or expert row.
    // Without this, a cancellation or card change made in the Stripe
    // Dashboard never reached the DB and `subscription_status` drifted.
    // applySubscriptionToBusiness refuses to write to a billing-exempt
    // expert (manual admin override), so an exempt expert can never have
    // a paywall resurrected by a stray Stripe event. The subscription id
    // is passed so a dual-role founding person (two subscriptions on one
    // customer) mirrors each subscription onto the right row.
    const business = await businessForCustomer(sb, customerId, sub.id);
    if (business) {
      await applySubscriptionToBusiness(sb, business, hydrated, stripe);
      return business.id;
    }
    return null;
  }

  // ---- customer.subscription.trial_will_end -------------------------
  // Fires ~3 days before a trial ends (Stripe's fixed default). The ONE
  // reminder providers get is the 7-day email from
  // /api/cron/provider-reminders, stamped on the row. This handler is a
  // safety net only: it sends the same email if (and only if) the cron
  // never did, then stamps the row so nobody gets two.
  if (event.type === "customer.subscription.trial_will_end") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const audience = (sub.metadata?.audience ?? "") as string;
    const trialEnd = sub.trial_end
      ? new Date(sub.trial_end * 1000)
      : sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000)
        : new Date();
    const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const stamp = new Date().toISOString();

    if (audience === "expert") {
      const { data: expert } = await sb
        .from("experts")
        .select("id, full_name, email, billing_exempt, free_period_reminder_sent_at")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (expert && !expert.billing_exempt && !expert.free_period_reminder_sent_at) {
        await sb.from("experts").update({ free_period_reminder_sent_at: stamp } as never).eq("id", expert.id);
        void sendTrialEndingReminder({
          role: "expert",
          to: expert.email,
          contactName: expert.full_name ?? "there",
          daysLeft,
          trialEndDate: trialEnd,
          portalUrl: `${appOrigin()}/expert/billing`,
        });
      }
      return null;
    }
    if (audience === "vendor") {
      const { data: vendor } = await sb
        .from("vendors")
        .select("id, contact_name, contact_email, billing_email, billing_plan, free_period_reminder_sent_at")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (vendor && !vendor.free_period_reminder_sent_at) {
        await sb.from("vendors").update({ free_period_reminder_sent_at: stamp } as never).eq("id", vendor.id);
        void sendTrialEndingReminder({
          role: "partner",
          to: vendor.billing_email ?? vendor.contact_email,
          contactName: vendor.contact_name ?? "there",
          daysLeft,
          trialEndDate: trialEnd,
          portalUrl: `${appOrigin()}/vendor/account`,
          rate: vendor.billing_plan,
        });
      }
      return null;
    }
    return null;
  }

  // ---- invoice.paid / invoice.payment_failed ------------------------
  const paidEvent = event.type === "invoice.paid" || event.type === "invoice.payment_succeeded";
  if (paidEvent || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
    if (!customerId) return null;
    const memberId = await memberIdForCustomer(sb, customerId);
    if (!memberId) return null;

    if (event.type === "invoice.payment_failed") {
      await sb.from("members").update({ subscription_status: "past_due" }).eq("id", memberId);
    }

    // Sales tracker — MONTH-WISE payments. Every successful charge (first
    // payment AND each renewal) appends to the month sheet named for its
    // date ("September 2026"), Masterclass-tracker style. Best-effort,
    // env-gated, deduped by the webhook's per-event idempotency.
    if (
      paidEvent &&
      (invoice.amount_paid ?? 0) > 0 &&
      process.env.SALES_TRACKER_WEBHOOK_URL
    ) {
      try {
        const { data: payer } = await sb
          .from("members")
          .select("first_name, last_name, email, practice_name, tier, subscription_interval")
          .eq("id", memberId)
          .maybeSingle();
        const paidAt = new Date();
        await fetch(process.env.SALES_TRACKER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "payment",
            month: paidAt.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            date: paidAt.toISOString(),
            name: [payer?.first_name, payer?.last_name].filter(Boolean).join(" "),
            email: payer?.email ?? "",
            practice: payer?.practice_name ?? "",
            description: `${payer?.tier ?? "founding"} membership, ${payer?.subscription_interval === "year" ? "annual" : "monthly"}`,
            amount: (invoice.amount_paid ?? 0) / 100,
            currency: (invoice.currency ?? "usd").toUpperCase(),
            invoiceId: invoice.id ?? "",
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        console.error("[stripe webhook] payment-tracker append failed:", err);
      }
    }

    // Meta Purchase for a summit-trial member: the FIRST paid invoice is
    // the real conversion (value = what was collected). The event id is
    // the invoice id, so the browser cannot duplicate it and Stripe
    // retries dedupe on stripe_events. Only ever fires for amount > 0.
    if (paidEvent && (invoice.amount_paid ?? 0) > 0) {
      try {
        const subIdForInvoice =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id ?? null;
        if (subIdForInvoice) {
          const subForInvoice = await stripe.subscriptions.retrieve(subIdForInvoice);
          if (subForInvoice.metadata?.offer === "summit_trial" && subForInvoice.metadata?.channel === "meta_ads") {
            const { data: payer } = await sb
              .from("members")
              .select("email, first_name, last_name")
              .eq("id", memberId)
              .maybeSingle();
            if (payer?.email) {
              const { sendMetaEvent } = await import("@/lib/meta");
              await sendMetaEvent("Purchase", {
                eventId: `inv_${invoice.id}`,
                email: payer.email,
                firstName: payer.first_name,
                lastName: payer.last_name,
                value: (invoice.amount_paid ?? 0) / 100,
                currency: invoice.currency ?? "usd",
                contentName: "summit_trial_first_payment",
              });
            }
          }
        }
      } catch (err) {
        console.error("[stripe webhook] summit first-payment purchase report failed:", err);
      }
    }

    // Referral revenue attribution (admin-only analytics). On a real
    // payment, add what this member paid to their referral_signups row so
    // admin can see how much each referred member has paid. Safe from
    // double-counting: the whole webhook de-dupes on stripe_events (top of
    // this file), so each invoice.paid is processed exactly once. $0 trial
    // invoices simply add nothing.
    if (paidEvent) {
      const amountPaid = invoice.amount_paid ?? 0;
      if (amountPaid > 0) {
        const { data: member } = await sb
          .from("members")
          .select("referral_code_id")
          .eq("id", memberId)
          .maybeSingle();
        if (member?.referral_code_id) {
          // Fetch the current total, add this invoice, write it back.
          // (referral_signups is unique per (code_id, member_id).)
          const { data: signup } = await sb
            .from("referral_signups")
            .select("id, revenue_cents")
            .eq("code_id", member.referral_code_id)
            .eq("member_id", memberId)
            .maybeSingle();
          if (signup) {
            await sb
              .from("referral_signups")
              .update({
                revenue_cents: (signup.revenue_cents ?? 0) + amountPaid,
                currency: invoice.currency ?? null,
                last_payment_at: new Date().toISOString(),
              })
              .eq("id", signup.id);
          }
        }
      }
    }
    // invoice.paid is otherwise a confirmation; subscription.updated also
    // fires and carries the canonical state, so we don't double-write here.
    return memberId;
  }

  return null;
}

