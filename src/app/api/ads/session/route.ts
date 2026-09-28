import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { SIGNUP_CHECKOUT_COOKIE, verifyCheckoutToken, isMemberPaid } from "@/lib/auth/guards";
import { getStripe } from "@/lib/stripe";
import { applySubscriptionToMember } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The paid-ads post-payment surface. Everything here is SERVER-VERIFIED
 * against Stripe with the secret key — the browser's word is never the
 * authority for anything.
 *
 *   GET  ?session_id=cs_…  → { state } for the thank-you page poller.
 *         "paid" | "processing" | "invalid". No PII is ever returned.
 *
 *   POST { session_id }    → establishes the member's portal session
 *         (true auto-login, no second sign-in) — but ONLY when:
 *           1. the Checkout Session exists, belongs to this app, and
 *              Stripe says it is PAID (retrieved server-side), AND
 *           2. this browser carries the signed HttpOnly checkout cookie
 *              for the SAME member that started the checkout.
 *         A stolen /welcome URL on another device fails check 2 and gets
 *         a normal sign-in prompt instead — the URL alone grants nothing.
 *
 * The POST also self-heals the webhook race: if Stripe says paid but the
 * member row hasn't been activated yet (webhook still in flight), it
 *  mirrors the subscription and queues the Day 0 welcome — both fully
 * idempotent with the webhook doing the same work a second later.
 */

const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

type VerifiedSession = {
  memberId: string;
  paid: boolean;
  plan: string;
  subscriptionId: string | null;
  /** Server-stamped at checkout creation: the account was created by that checkout. */
  autoLogin: boolean;
};

async function retrieveVerified(sessionId: string): Promise<VerifiedSession | null> {
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const memberId = session.metadata?.member_id;
    if (!memberId || session.metadata?.channel !== "meta_ads") return null;
    return {
      memberId,
      paid:
        (session.payment_status === "paid" ||
          // $0 summit-trial checkout: card saved, nothing due today.
          (session.payment_status === "no_payment_required" && session.metadata?.offer === "summit_trial")) &&
        session.status === "complete",
      plan: session.metadata?.plan ?? "founding_monthly",
      autoLogin: session.metadata?.auto_login === "true",
      subscriptionId:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null,
    };
  } catch {
    // Unknown/foreign session id — reveal nothing about why.
    return null;
  }
}

export async function GET(req: Request) {
  const route = "GET /api/ads/session";
  const rl = await checkRateLimit(`ads-verify:${clientIp(req)}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json({ state: "invalid" });
  }
  try {
    const verified = await retrieveVerified(sessionId);
    if (!verified) return NextResponse.json({ state: "invalid" });
    return NextResponse.json({ state: verified.paid ? "paid" : "processing" });
  } catch (err) {
    return serverError(err, { route });
  }
}

export async function POST(req: Request) {
  const route = "POST /api/ads/session";
  const rl = await checkRateLimit(`ads-session:${clientIp(req)}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  let body: { session_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!SESSION_ID_RE.test(sessionId)) return apiError.badRequest("Invalid session.", route);

  try {
    // 1. Stripe is the authority: the session must be PAID.
    const verified = await retrieveVerified(sessionId);
    if (!verified) return apiError.badRequest("Invalid session.", route);
    if (!verified.paid) {
      return NextResponse.json({ ok: false, state: "processing" }, { status: 409 });
    }

    // 2. Browser binding: the signed HttpOnly checkout cookie must name
    //    the SAME member. A pasted URL on another device stops here.
    const jar = await cookies();
    const cookieMemberId = verifyCheckoutToken(jar.get(SIGNUP_CHECKOUT_COOKIE)?.value);
    if (!cookieMemberId || cookieMemberId !== verified.memberId) {
      return NextResponse.json(
        { ok: false, state: "signin_required" },
        { status: 401 },
      );
    }

    // 2b. Identity binding: the cookie proves "this browser ran the
    //     checkout", not "this browser owns the email". The checkout
    //     routes reuse an existing (unpaid) member row when the email
    //     matches, so without this check anyone who knew a member's email
    //     could complete a checkout and be signed in as them. Only an
    //     account CREATED by this very checkout may be auto-signed-in;
    //     everyone else uses the emailed code. Payment/activation is
    //     unaffected either way (the webhook handles it).
    if (!verified.autoLogin) {
      return NextResponse.json({ ok: false, state: "signin_required" }, { status: 200 });
    }

    const sb = getSupabaseAdmin();
    const { data: member } = await sb
      .from("members")
      .select("id, email, status, subscription_status")
      .eq("id", verified.memberId)
      .maybeSingle();
    if (!member || member.status !== "active") {
      return apiError.forbidden(route);
    }

    // 3. Self-heal the webhook race — Stripe says paid, mirror it now so
    //    the portal opens immediately. Idempotent with the webhook.
    if (!isMemberPaid(member.subscription_status) && verified.subscriptionId) {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(verified.subscriptionId, {
          expand: ["default_payment_method", "items.data.price"],
        });
        await applySubscriptionToMember(sb, member.id, sub, stripe);
        const { onMemberActivated } = await import("@/lib/onboarding");
        await onMemberActivated(member.id); // insert-first dedup — never double-sends
      } catch (err) {
        console.error("[ads:session] activation self-heal failed (webhook will retry):", err);
      }
    }

    // 4. Mint the portal session server-side: generate a magic-link token
    //    and verify it on the cookie-bound client in one round trip. The
    //    token never travels to the browser — only the resulting HttpOnly
    //    session cookies do.
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: member.email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      // Auto-login unavailable — the member still owns the account; they
      // can use the normal email sign-in. Payment/activation unaffected.
      console.error("[ads:session] generateLink failed:", linkErr?.message);
      return NextResponse.json({ ok: false, state: "signin_required" }, { status: 200 });
    }

    const cookieClient = await createServerSupabase();
    const { data: otpData, error: otpErr } = await cookieClient.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (otpErr || !otpData?.user) {
      console.error("[ads:session] verifyOtp failed:", otpErr?.message);
      return NextResponse.json({ ok: false, state: "signin_required" }, { status: 200 });
    }

    // Link auth_user_id if this is the first session for the account.
    try {
      await sb
        .from("members")
        .update({ auth_user_id: otpData.user.id })
        .eq("id", member.id)
        .is("auth_user_id", null);
      await sb.from("auth_audit").insert({
        event: "ads_auto_login",
        email: member.email,
        user_id: otpData.user.id,
        user_type: "member",
        metadata: { member_id: member.id, via: "paid_ads_checkout" },
      });
    } catch {
      /* best-effort */
    }

    // Real session established — retire the pay-first cookie.
    const response = NextResponse.json({ ok: true, state: "signed_in", next: "/dashboard" });
    response.cookies.delete(SIGNUP_CHECKOUT_COOKIE);
    return response;
  } catch (err) {
    return serverError(err, { route });
  }
}
