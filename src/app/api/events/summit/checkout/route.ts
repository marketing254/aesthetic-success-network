import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { SIGNUP_CHECKOUT_COOKIE, signCheckoutToken } from "@/lib/auth/guards";
import { appOrigin, getStripe, priceIdFor } from "@/lib/stripe";
import { SUMMIT, eventsDb, summitOpen } from "@/lib/events/summit";
import { summitEnabledOr404 } from "@/lib/api/summitGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/events/summit/checkout — the ASN summit signup (SUMMIT_ENABLED only).
 *
 * Same shape and the same rails as /api/ads/checkout (server-mapped
 * price, no promo input, embedded Stripe, webhook-only activation), with
 * three differences:
 *
 *   1. The offer is the campaign's $0 → 30-day trial → $29/month. The
 *      trial is attached SERVER-SIDE from SUMMIT.trialDays; the browser
 *      cannot ask for it, lengthen it, or swap the plan.
 *   2. The Zoom registration questions are collected here and stored on
 *      an event_registrations row in `pending_payment`. Nothing is sent
 *      to Zoom from this route — only the Stripe webhook (verified
 *      payment) can move the row forward.
 *   3. An email that already has an active membership is refused here
 *      and pointed at the signed-in registration path, so a member is
 *      never charged twice for the event.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d][\d\s().-]{5,39}$/;
const MEMBER_AGREEMENT_VERSION = "2026-08";

type Payload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  practiceWebsiteName: string;
  speakerQuestion: string | null;
  agreementAccepted: true;
  utm: Partial<Record<"source" | "medium" | "campaign" | "content" | "term", string>>;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  landingUrl: string | null;
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parse(json: unknown): { ok: true; data: Payload } | { ok: false; error: string } {
  if (!json || typeof json !== "object") return { ok: false, error: "Invalid request." };
  const b = json as Record<string, unknown>;
  const firstName = str(b.firstName, 80);
  const lastName = str(b.lastName, 80);
  const email = str(b.email, 254).toLowerCase();
  const phone = str(b.phone, 40);
  const practiceWebsiteName = str(b.practiceWebsiteName, 200);
  const speakerQuestion = str(b.speakerQuestion, 1000) || null;

  if (!firstName) return { ok: false, error: "Please enter your first name." };
  if (!lastName) return { ok: false, error: "Please enter your last name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!PHONE_RE.test(phone)) return { ok: false, error: "Please enter a valid mobile phone number." };
  if (practiceWebsiteName.length < 2) return { ok: false, error: "Please enter your practice website and name." };
  if (b.agreementAccepted !== true) {
    return { ok: false, error: "Please accept the Member Agreement and recurring billing terms to continue." };
  }

  const rawUtm = (b.utm && typeof b.utm === "object" ? b.utm : {}) as Record<string, unknown>;
  const utm: Payload["utm"] = {};
  for (const k of ["source", "medium", "campaign", "content", "term"] as const) {
    const v = str(rawUtm[k], 200);
    if (v) utm[k] = v;
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      email,
      phone,
      practiceWebsiteName,
      speakerQuestion,
      agreementAccepted: true,
      utm,
      fbclid: str(b.fbclid, 400) || null,
      fbp: str(b.fbp, 100) || null,
      fbc: str(b.fbc, 400) || null,
      landingUrl: str(b.landingUrl, 400) || null,
    },
  };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const summitGate = summitEnabledOr404();
  if (summitGate) return summitGate;
  const route = "POST /api/events/summit/checkout";

  if (!summitOpen()) {
    return NextResponse.json({ error: "Registration for this summit has closed." }, { status: 410 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const parsed = parse(json);
  if (!parsed.ok) return apiError.validation(parsed.error, route);
  const p = parsed.data;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`summit-checkout:${ip}:${p.email}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  const sb = getSupabaseAdmin();
  const ev = eventsDb();

  try {
    // ---- Existing paid member → no second subscription -----------------
    const { data: existing } = await sb
      .from("members")
      .select("id, status, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("email", p.email)
      .maybeSingle();

    if (
      existing?.stripe_subscription_id &&
      (existing.subscription_status === "active" || existing.subscription_status === "trialing")
    ) {
      return NextResponse.json(
        {
          alreadyMember: true,
          error: "This email already has an active ASN membership. Sign in and we'll register you for the summit at no charge.",
        },
        { status: 409 },
      );
    }

    // ---- Already registered for this event? Refuse BEFORE writing anything.
    // The registration row belongs to the person who paid; a later form
    // submission with the same email (typo, or someone else's address) must
    // not overwrite their details or create a second checkout.
    const { data: priorReg } = await ev
      .from("event_registrations")
      .select("status")
      .eq("event_id", SUMMIT.eventId)
      .eq("email", p.email)
      .maybeSingle();
    if (priorReg && (priorReg as { status: string }).status !== "pending_payment") {
      return NextResponse.json(
        { alreadyRegistered: true, error: "This email is already registered for the summit. Check your inbox for the Zoom link, or sign in to your portal." },
        { status: 409 },
      );
    }

    // ---- Member row (reuse by email, never duplicate) -------------------
    let memberId: string;
    if (existing) {
      memberId = existing.id;
      if (existing.status !== "active") await sb.from("members").update({ status: "active" }).eq("id", memberId);
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: p.firstName,
          last_name: p.lastName,
          email: p.email,
          phone: p.phone,
          practice_name: p.practiceWebsiteName,
          practice_role: "Other",
          status: "active",
          tier: "founding",
        })
        .select("id")
        .single();
      if (insErr || !inserted) return serverError(insErr ?? new Error("insert returned nothing"), { route, extra: { stage: "members_insert" } });
      memberId = inserted.id;
    }

    // Everything below is independent of everything else, so it runs at
    // once instead of one after another (this is what the visitor waits
    // on between "Continue" and the Stripe form appearing).
    let stripe;
    let priceId: string;
    try {
      stripe = getStripe();
      priceId = priceIdFor(SUMMIT.plan);
    } catch (err) {
      return serverError(err, { route, status: 503, extra: { stage: "stripe_init" } });
    }

    const metaUpdate = (async () => {
      try {
      await sb
        .from("members")
        .update({
          signup_channel: "meta_ads",
          utm_source: p.utm.source ?? null,
          utm_medium: p.utm.medium ?? null,
          utm_campaign: p.utm.campaign ?? SUMMIT.campaign,
          utm_content: p.utm.content ?? null,
          utm_term: p.utm.term ?? null,
          meta_fbclid: p.fbclid,
          meta_fbp: p.fbp,
          meta_fbc: p.fbc,
          agreement_version: MEMBER_AGREEMENT_VERSION,
          agreement_accepted_at: new Date().toISOString(),
        } as never)
        .eq("id", memberId);
      } catch {
        /* additive columns from 0058 — best effort */
      }
    })();

    const authUser = (async () => {
      try {
        await sb.auth.admin.createUser({
          email: p.email,
          email_confirm: true,
          user_metadata: { user_type: "member", member_id: memberId },
        });
      } catch {
        /* already registered */
      }
    })();

    const customerPromise = (async (): Promise<string> => {
      if (existing?.stripe_customer_id) return existing.stripe_customer_id;
      const customer = await stripe.customers.create({
        email: p.email,
        name: `${p.firstName} ${p.lastName}`,
        phone: p.phone,
        metadata: { member_id: memberId },
      });
      await sb.from("members").update({ stripe_customer_id: customer.id }).eq("id", memberId);
      return customer.id;
    })();

    // ---- Registration row: pending until the webhook says paid ---------
    // Insert-if-absent, never update: the first submission for an email
    // owns the row. A second submission (a typo, or someone else typing
    // this email) reuses the pending row untouched, so nobody can change
    // another person's name, phone or answers before they pay.
    const regPromise = (async () => {
      const { error: insErr } = await ev.from("event_registrations").upsert(
        {
          event_id: SUMMIT.eventId,
          member_id: memberId,
          email: p.email,
          first_name: p.firstName,
          last_name: p.lastName,
          phone: p.phone,
          practice_website_name: p.practiceWebsiteName,
          speaker_question: p.speakerQuestion,
          utm: { ...p.utm, campaign: p.utm.campaign ?? SUMMIT.campaign },
          landing_url: p.landingUrl,
        },
        { onConflict: "event_id,email", ignoreDuplicates: true },
      );
      if (insErr) return { data: null, error: insErr };
      return ev
        .from("event_registrations")
        .select("id, status")
        .eq("event_id", SUMMIT.eventId)
        .eq("email", p.email)
        .single();
    })();

    const [, , customerId, { data: reg, error: regErr }] = await Promise.all([metaUpdate, authUser, customerPromise, regPromise]);
    if (regErr || !reg) return serverError(regErr ?? new Error("registration upsert failed"), { route, extra: { stage: "registration_upsert" } });
    // Belt and braces for a race between the pre-check above and the upsert.
    if (reg.status !== "pending_payment") {
      return NextResponse.json(
        { alreadyRegistered: true, error: "You're already registered for the summit. Check your inbox for your Zoom link." },
        { status: 409 },
      );
    }

    // ---- Stripe: embedded trial checkout ------------------------------
    const metaEventId = randomUUID();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      subscription_data: {
        // The campaign offer, and the only place it is set: $0 today,
        // 30-day trial, then the founding monthly rate.
        trial_period_days: SUMMIT.trialDays,
        metadata: {
          member_id: memberId,
          plan: SUMMIT.plan,
          billing_interval: "month",
          tier: "founding",
          founding_member: "true",
          early_member: "false",
          channel: "meta_ads",
          offer: "summit_trial",
          event_id: SUMMIT.eventId,
          registration_id: reg.id,
        },
      },
      metadata: {
        member_id: memberId,
        plan: SUMMIT.plan,
        tier: "founding",
        channel: "meta_ads",
        offer: "summit_trial",
        // Auto sign-in on the thank-you page is allowed ONLY when this
        // checkout created the account. An existing (unpaid) account must
        // sign in with the emailed code — otherwise anyone who knows a
        // member's email could complete a $0 checkout and be logged in as
        // them. Server-written metadata; the browser cannot set it.
        auto_login: existing ? "false" : "true",
        event_id: SUMMIT.eventId,
        registration_id: reg.id,
        meta_event_id: metaEventId,
        ...(p.fbp ? { meta_fbp: p.fbp } : {}),
        ...(p.fbc ? { meta_fbc: p.fbc.slice(0, 480) } : {}),
        ...(p.fbclid ? { meta_fbclid: p.fbclid.slice(0, 480) } : {}),
        ...(p.landingUrl ? { landing_url: p.landingUrl.slice(0, 480) } : {}),
        client_ip: ip.slice(0, 45),
        client_ua: (req.headers.get("user-agent") ?? "").slice(0, 480),
      },
      return_url: `${appOrigin()}/summit/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.client_secret) {
      return serverError(new Error("Embedded checkout session missing client_secret"), { route, extra: { stage: "session_create" } });
    }

    await ev.from("event_registrations").update({ stripe_session_id: session.id }).eq("id", reg.id);

    if (!existing) {
      try {
        await sb.from("auth_audit").insert({
          event: "signup_new",
          email: p.email,
          user_type: "member",
          metadata: { member_id: memberId, source: "meta_ads", campaign: SUMMIT.campaign },
        });
      } catch {
        /* best-effort */
      }
    }

    const response = NextResponse.json({ ok: true, clientSecret: session.client_secret, metaEventId });
    response.cookies.set(SIGNUP_CHECKOUT_COOKIE, signCheckoutToken(memberId), {
      maxAge: 60 * 60 * 2,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    return serverError(err, { route });
  }
}
