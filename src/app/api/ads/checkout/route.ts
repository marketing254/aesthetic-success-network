import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { SIGNUP_CHECKOUT_COOKIE, signCheckoutToken } from "@/lib/auth/guards";
import {
  appOrigin,
  FOUNDING_MEMBER_CAP,
  getStripe,
  priceIdFor,
  type SubscriptionPlanKey,
} from "@/lib/stripe";
import { memberRoles } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ads/checkout — the Meta paid-ads one-page purchase.
 *
 * Creates (or reuses) the member account and returns an EMBEDDED Stripe
 * Checkout client secret. Card fields render inside Stripe's iframe —
 * card data never touches our origin, our DOM, or our JavaScript, so
 * nothing readable exists in the console/network/application tabs.
 *
 * Server-authoritative by design:
 *   - The client sends only a plan KEY; the server maps it to the Stripe
 *     Price. A tampered request cannot change the amount charged.
 *   - Activation NEVER happens here — only the signed Stripe webhook (or
 *     a secret-key session retrieval on /welcome) flips the member to
 *     paid. The browser's success callback is not trusted.
 *   - The private 3-month promo system is deliberately unreachable from
 *     this route: no promo input is read, no trial is ever attached.
 *   - Rate-limited per IP+email; idempotent for repeat submissions
 *     (same email reuses the member row + Stripe customer, and an
 *     already-subscribed member is refused with a sign-in pointer).
 */

const PLAN_KEYS = ["founding_monthly", "founding_annual"] as const;
type AdsPlan = (typeof PLAN_KEYS)[number];

/** Role options come from the shared ASN vocabulary (src/lib/content.ts). */
const ROLES = memberRoles as readonly string[];

/** Version stamp for the agreement the checkbox covers. */
const MEMBER_AGREEMENT_VERSION = "2026-08";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Payload = {
  firstName: string;
  lastName: string;
  email: string;
  practiceName: string;
  role: string;
  plan: AdsPlan;
  agreementAccepted: boolean;
  utm: Partial<Record<"source" | "medium" | "campaign" | "content" | "term", string>>;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  landingUrl: string | null;
  /** Abandoned-registration resume token — may carry a one-month-free grant. */
  resumeToken: string | null;
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parsePayload(json: unknown): { ok: true; data: Payload } | { ok: false; error: string } {
  if (!json || typeof json !== "object") return { ok: false, error: "Invalid request." };
  const b = json as Record<string, unknown>;

  const firstName = str(b.firstName, 80);
  const lastName = str(b.lastName, 80);
  const email = str(b.email, 254).toLowerCase();
  const practiceName = str(b.practiceName, 120);
  const role = str(b.role, 60);
  const plan = b.plan;

  if (!firstName) return { ok: false, error: "Please enter your first name." };
  if (!lastName) return { ok: false, error: "Please enter your last name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid work email." };
  if (!practiceName) return { ok: false, error: "Please enter your practice name." };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: "Please select your role." };
  if (plan !== "founding_monthly" && plan !== "founding_annual") {
    return { ok: false, error: "Please choose monthly or annual billing." };
  }
  if (b.agreementAccepted !== true) {
    return { ok: false, error: "Please accept the Member Agreement to continue." };
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
      practiceName,
      role,
      plan,
      agreementAccepted: true,
      utm,
      fbclid: str(b.fbclid, 400) || null,
      fbp: str(b.fbp, 100) || null,
      fbc: str(b.fbc, 400) || null,
      landingUrl: str(b.landingUrl, 400) || null,
      resumeToken: str(b.resumeToken, 64) || null,
    },
  };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const route = "POST /api/ads/checkout";

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const parsed = parsePayload(json);
  if (!parsed.ok) return apiError.validation(parsed.error, route);
  const p = parsed.data;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`ads-checkout:${ip}:${p.email}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  const sb = getSupabaseAdmin();

  try {
    // ---- Founding cap (lifetime — cancellations never free a seat) ----
    const { count, error: countErr } = await sb
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("founding_member_locked", true);
    if (countErr) return serverError(countErr, { route, extra: { stage: "cap_count" } });
    if ((count ?? 0) >= FOUNDING_MEMBER_CAP) {
      return NextResponse.json(
        { error: "Founding seats are sold out. Email founding@aestheticsuccessnetwork.com and we'll help you join at the current rate." },
        { status: 409 },
      );
    }

    // ---- Member row: reuse by email (never duplicate an account) ------
    const { data: existing } = await sb
      .from("members")
      .select("id, status, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("email", p.email)
      .maybeSingle();

    if (
      existing?.stripe_subscription_id &&
      (existing.subscription_status === "active" || existing.subscription_status === "trialing")
    ) {
      // Existing paid member — do NOT double-charge. Send them to sign in.
      return NextResponse.json(
        {
          alreadyMember: true,
          error: "This email already has an active ASN membership. Sign in to your portal instead.",
        },
        { status: 409 },
      );
    }

    let memberId: string;
    if (existing) {
      memberId = existing.id;
      if (existing.status !== "active") {
        await sb.from("members").update({ status: "active" }).eq("id", memberId);
      }
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: p.firstName,
          last_name: p.lastName,
          email: p.email,
          practice_name: p.practiceName,
          practice_role: p.role,
          status: "active",
          tier: "founding",
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return serverError(insErr ?? new Error("insert returned nothing"), {
          route,
          extra: { stage: "members_insert" },
        });
      }
      memberId = inserted.id;
    }

    // Acquisition + agreement stamp. Best-effort separate update so the
    // flow keeps working in an environment where migration 0058 hasn't
    // run yet (columns are additive).
    try {
      await sb
        .from("members")
        .update({
          signup_channel: "meta_ads",
          utm_source: p.utm.source ?? null,
          utm_medium: p.utm.medium ?? null,
          utm_campaign: p.utm.campaign ?? null,
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
      /* migration 0058 not applied yet */
    }

    // Pre-create the auth user so the post-payment session mint and any
    // later OTP login both work. Existing-user errors are expected noise.
    try {
      await sb.auth.admin.createUser({
        email: p.email,
        email_confirm: true,
        user_metadata: { user_type: "member", member_id: memberId },
      });
    } catch {
      /* already registered */
    }

    // ---- Stripe: customer + EMBEDDED checkout session -----------------
    let stripe;
    let priceId: string;
    try {
      stripe = getStripe();
      priceId = priceIdFor(p.plan as SubscriptionPlanKey);
    } catch (err) {
      return serverError(err, { route, status: 503, extra: { stage: "stripe_init" } });
    }

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: p.email,
        name: `${p.firstName} ${p.lastName}`,
        metadata: { member_id: memberId },
      });
      customerId = customer.id;
      await sb.from("members").update({ stripe_customer_id: customerId }).eq("id", memberId);
    }

    // Abandoned-registration recovery: the email-3 one-month-free code is
    // applied SERVER-SIDE via the resume token (the code value never
    // travels through the browser, and it never appears on /start).
    // Single use, must match this buyer's email, expires 48h after email
    // 3 — recoveryGrantForCheckout enforces all three. An expired/invalid
    // token simply falls through to the normal $29 checkout (per SPEC:
    // it must never fail the checkout).
    let recovery: { rowId: string; code: string } | null = null;
    if (p.resumeToken) {
      try {
        const { recoveryGrantForCheckout } = await import("@/lib/abandoned");
        recovery = await recoveryGrantForCheckout(p.resumeToken, p.email);
      } catch (err) {
        console.error("[ads:checkout] recovery grant lookup failed:", err);
      }
    }

    // One event id shared by the server Conversions API call and the
    // browser Pixel so Meta de-duplicates the Purchase.
    const metaEventId = randomUUID();
    const interval = p.plan === "founding_annual" ? "year" : "month";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // "embedded_page" = Stripe's Embedded Checkout (renders in an iframe
      // on our page; card data stays entirely on Stripe's origin).
      ui_mode: "embedded_page",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Public paid-ads offer only: no promotion codes, no trials — the
      // private 3-month arrangement is structurally impossible here.
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      subscription_data: {
        // Recovery grant: one month free, then the founding rate — the
        // ONLY trial this page can ever attach, and only via a valid
        // personal email-3 code.
        ...(recovery ? { trial_period_days: 30 } : {}),
        metadata: {
          member_id: memberId,
          plan: p.plan,
          billing_interval: interval,
          tier: "founding",
          founding_member: "true",
          early_member: "false",
          channel: "meta_ads",
        },
      },
      metadata: {
        member_id: memberId,
        plan: p.plan,
        tier: "founding",
        channel: "meta_ads",
        // Auto sign-in on /welcome only for an account THIS checkout
        // created; an existing unpaid account signs in by emailed code.
        auto_login: existing ? "false" : "true",
        meta_event_id: metaEventId,
        ...(recovery ? { recovery_row_id: recovery.rowId, recovery_code: recovery.code } : {}),
        // Browser/network context for Conversions API match quality —
        // captured at purchase intent, replayed by the webhook.
        ...(p.fbp ? { meta_fbp: p.fbp } : {}),
        ...(p.fbc ? { meta_fbc: p.fbc.slice(0, 480) } : {}),
        ...(p.fbclid ? { meta_fbclid: p.fbclid.slice(0, 480) } : {}),
        ...(p.landingUrl ? { landing_url: p.landingUrl.slice(0, 480) } : {}),
        client_ip: ip.slice(0, 45),
        client_ua: (req.headers.get("user-agent") ?? "").slice(0, 480),
      },
      return_url: `${appOrigin()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.client_secret) {
      return serverError(new Error("Embedded checkout session missing client_secret"), {
        route,
        extra: { stage: "session_create" },
      });
    }

    // Audit trail for the new-account path.
    if (!existing) {
      try {
        await sb.from("auth_audit").insert({
          event: "signup_new",
          email: p.email,
          user_type: "member",
          metadata: { member_id: memberId, source: "meta_ads" },
        });
      } catch {
        /* best-effort */
      }
    }

    const response = NextResponse.json({ ok: true, clientSecret: session.client_secret });
    // Same signed pay-first cookie the organic flow uses: it scopes the
    // /welcome auto-login to THIS browser. HttpOnly — script can't read it.
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
