import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  memberIdForCustomer,
  businessForCustomer,
  applySubscriptionToMember,
  applySubscriptionToBusiness,
} from "@/lib/billing";
import {
  sendMemberSubscriptionConfirmedEmail,
  sendTrialEndingReminder,
  notifyTeam,
} from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
]);

type Audience = "member" | "expert" | "partner";

function audienceOf(metadata: Stripe.Metadata | null | undefined): Audience | null {
  const a = metadata?.audience;
  return a === "member" || a === "expert" || a === "partner" ? a : null;
}

async function journal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  event: Stripe.Event,
  audience: Audience | null,
  ref: { memberId?: string | null; expertApplicationId?: string | null; partnerApplicationId?: string | null },
) {
  await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    audience,
    member_id: ref.memberId ?? null,
    expert_application_id: ref.expertApplicationId ?? null,
    partner_application_id: ref.partnerApplicationId ?? null,
    payload: event as unknown as Record<string, unknown>,
  });
}

async function applyToWhoeverOwnsCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  sub: Stripe.Subscription,
  fallbackMemberId?: string | null,
): Promise<{ audience: Audience | null; memberId?: string | null; expertApplicationId?: string | null; partnerApplicationId?: string | null }> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const memberId = await memberIdForCustomer(supabase, customerId, fallbackMemberId);
  if (memberId) {
    await applySubscriptionToMember(supabase, memberId, sub, stripe);
    return { audience: "member", memberId };
  }
  const ref = await businessForCustomer(supabase, customerId);
  if (ref) {
    await applySubscriptionToBusiness(supabase, ref, sub, stripe);
    return {
      audience: ref.table === "expert_applications" ? "expert" : "partner",
      expertApplicationId: ref.table === "expert_applications" ? ref.id : null,
      partnerApplicationId: ref.table === "partner_applications" ? ref.id : null,
    };
  }
  return { audience: null };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe:webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = getSupabaseAdmin();

  // Idempotency: Stripe retries on any non-2xx, so a duplicate delivery
  // of an already-processed event id is a normal, expected occurrence.
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const audience = audienceOf(session.metadata);
        if (session.mode !== "subscription" || !session.subscription) {
          await journal(supabase, event, audience, {});
          break;
        }
        const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ["default_payment_method", "items.data.price"],
        });

        if (audience === "member") {
          const memberId = session.metadata?.member_id ?? null;
          if (memberId) {
            await applySubscriptionToMember(supabase, memberId, sub, stripe);
            const { data: member } = await supabase
              .from("members")
              .select("email, first_name, tier")
              .eq("id", memberId)
              .maybeSingle();
            if (member?.email) {
              await sendMemberSubscriptionConfirmedEmail(
                member.email as string,
                (member.first_name as string) ?? "",
                `${(member.tier as string) ?? "founding"} plan`,
              );
              void notifyTeam("Member subscription started", [
                ["Member", member.email as string],
                ["Plan", session.metadata?.plan ?? ""],
              ]);
            }
            await journal(supabase, event, "member", { memberId });
          } else {
            await journal(supabase, event, "member", {});
          }
        } else {
          // Expert/partner "upgrade" checkout (manual Growth→Standard or
          // annual pre-pay) — trial-start uses a SetupIntent, not Checkout.
          const ref = await applyToWhoeverOwnsCustomer(supabase, stripe, sub);
          await journal(supabase, event, ref.audience, ref);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const fallbackMemberId = sub.metadata?.member_id ?? null;
        const ref = await applyToWhoeverOwnsCustomer(supabase, stripe, sub, fallbackMemberId);
        await journal(supabase, event, ref.audience, ref);
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const audience = audienceOf(sub.metadata);
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (audience === "expert" || audience === "partner") {
          const table = audience === "expert" ? "expert_applications" : "partner_applications";
          const emailCol = audience === "expert" ? "email" : "contact_email";
          const nameCol = audience === "expert" ? "full_name" : "contact_name";
          const { data: row } = await supabase
            .from(table)
            .select(`id, ${emailCol}, ${nameCol}`)
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (row) {
            const email = (row as Record<string, unknown>)[emailCol] as string;
            const name = (row as Record<string, unknown>)[nameCol] as string;
            await sendTrialEndingReminder({ role: audience, to: email, name, daysLeft: 3 });
          }
        }
        await journal(supabase, event, audience, {});
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const memberId = await memberIdForCustomer(supabase, customerId);
          if (memberId) {
            await supabase.from("members").update({ subscription_status: "past_due" }).eq("id", memberId);
            await journal(supabase, event, "member", { memberId });
            break;
          }
          const ref = await businessForCustomer(supabase, customerId);
          if (ref) {
            await supabase.from(ref.table).update({ subscription_status: "past_due" }).eq("id", ref.id);
            await journal(supabase, event, ref.table === "expert_applications" ? "expert" : "partner", {
              expertApplicationId: ref.table === "expert_applications" ? ref.id : null,
              partnerApplicationId: ref.table === "partner_applications" ? ref.id : null,
            });
            break;
          }
        }
        await journal(supabase, event, null, {});
        break;
      }

      case "invoice.paid": {
        // Canonical subscription_status is set by subscription.updated,
        // which also fires around every payment. Just journal for audit.
        await journal(supabase, event, null, {});
        break;
      }

      default:
        await journal(supabase, event, null, {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Deliberately NOT journaled on failure — Stripe will retry this
    // exact event id until a handler run succeeds and journals it.
    console.error(`[stripe:webhook] handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
