import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { SIGNUP_CHECKOUT_COOKIE, verifyCheckoutToken } from "@/lib/auth/guards";
import WelcomeView, { type WelcomeState } from "@/components/ads/WelcomeView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /welcome — the paid-ads thank-you page.
 *
 * SERVER-VERIFIED: this page renders "payment confirmed" ONLY after
 * retrieving the Checkout Session from Stripe with our secret key and
 * seeing payment_status = paid. The URL carries nothing but an opaque
 * cs_… id — a direct visit, a guessed id, or a refresh can't fake a
 * membership, trigger a duplicate welcome email (webhook + onboarding
 * are idempotent), or emit a Purchase event (that fires server-side
 * from the verified webhook, deduped by event id).
 *
 * noindex,nofollow per the campaign brief.
 */
export const metadata: Metadata = {
  title: "Welcome to Aesthetic Success Network",
  description: "Your Aesthetic Success Network membership is confirmed.",
  robots: { index: false, follow: false },
};

const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; preview?: string; plan?: string }>;
}) {
  const { session_id: sessionId, preview, plan: previewPlan } = await searchParams;

  // DEV-ONLY design preview (never compiled into a production behavior:
  // the NODE_ENV check makes this branch unreachable on the live site).
  // localhost:3000/welcome?preview=1        → monthly confirmation
  // localhost:3000/welcome?preview=1&plan=annual → annual confirmation
  if (preview === "1" && process.env.NODE_ENV === "development") {
    return (
      <WelcomeView
        state="paid"
        plan={previewPlan === "annual" ? "founding_annual" : "founding_monthly"}
        sessionId={null}
        metaEventId={null}
        sameBrowser={false}
      />
    );
  }

  let state: WelcomeState = "invalid";
  let plan: "founding_monthly" | "founding_annual" = "founding_monthly";
  let metaEventId: string | null = null;
  let sameBrowser = false;

  if (sessionId && SESSION_ID_RE.test(sessionId)) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const memberId = session.metadata?.member_id ?? null;
      if (memberId && session.metadata?.channel === "meta_ads") {
        if (session.payment_status === "paid" && session.status === "complete") {
          state = "paid";
          metaEventId = session.metadata?.meta_event_id ?? null;
        } else if (session.status === "expired") {
          state = "invalid";
        } else {
          state = "processing";
        }
        if (session.metadata?.plan === "founding_annual") plan = "founding_annual";

        // Is this the browser that started the checkout? (signed HttpOnly
        // cookie) — controls whether the client attempts auto sign-in.
        const jar = await cookies();
        const cookieMemberId = verifyCheckoutToken(jar.get(SIGNUP_CHECKOUT_COOKIE)?.value);
        sameBrowser = !!cookieMemberId && cookieMemberId === memberId;
      }
    } catch {
      state = "invalid";
    }
  }

  return (
    <WelcomeView
      state={state}
      plan={plan}
      sessionId={state !== "invalid" ? (sessionId as string) : null}
      metaEventId={metaEventId}
      sameBrowser={sameBrowser}
    />
  );
}
