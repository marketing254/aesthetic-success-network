import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DM_Sans, Libre_Caslon_Display } from "next/font/google";
import { getStripe } from "@/lib/stripe";
import { SIGNUP_CHECKOUT_COOKIE, verifyCheckoutToken } from "@/lib/auth/guards";
import { SUMMIT, SUMMIT_ENABLED } from "@/lib/events/summit";
import SummitConfirmedView, { type ConfirmedState } from "@/components/events/SummitConfirmedView";
import "../summit.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /summit/confirmed — the summit thank-you page.
 *
 * SERVER-VERIFIED like /welcome: "you're in" renders only after the
 * Checkout Session is retrieved with our secret key, belongs to this
 * event, and reports paid/complete. The Zoom join link is NEVER shown
 * here — it goes to the registrant's inbox only, so a shared URL cannot
 * leak a personal join link.
 */
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--summit-sans", display: "swap" });
const serif = Libre_Caslon_Display({ subsets: ["latin"], weight: "400", variable: "--summit-serif", display: "swap" });

export const metadata: Metadata = {
  title: "You're registered | ASN summit",
  robots: { index: false, follow: false },
};

const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

export default async function SummitConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; preview?: string }>;
}) {
  const { session_id: sessionId, preview } = await searchParams;
  if (!SUMMIT_ENABLED) notFound();
  const event = { dateLabel: SUMMIT.dateLabel, timeLabel: SUMMIT.timeLabel };

  if (preview === "1" && process.env.NODE_ENV === "development") {
    return (
      <div className={`summit ${sans.variable} ${serif.variable}`}>
        <SummitConfirmedView state="paid" sessionId={null} metaEventId={null} sameBrowser={false} event={event} />
      </div>
    );
  }

  let state: ConfirmedState = "invalid";
  let metaEventId: string | null = null;
  let sameBrowser = false;

  if (sessionId && SESSION_ID_RE.test(sessionId)) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const memberId = session.metadata?.member_id ?? null;
      if (memberId && session.metadata?.event_id === SUMMIT.eventId && session.metadata?.offer === "summit_trial") {
        // A $0 trial checkout completes with payment_status "no_payment_required"
        // (card saved, nothing collected today). Both mean the trial is live.
        const settled = session.payment_status === "paid" || session.payment_status === "no_payment_required";
        if (settled && session.status === "complete") {
          state = "paid";
          metaEventId = session.metadata?.meta_event_id ?? null;
        } else if (session.status === "expired") {
          state = "invalid";
        } else {
          state = "processing";
        }
        const jar = await cookies();
        const cookieMemberId = verifyCheckoutToken(jar.get(SIGNUP_CHECKOUT_COOKIE)?.value);
        sameBrowser = !!cookieMemberId && cookieMemberId === memberId;
      }
    } catch {
      state = "invalid";
    }
  }

  return (
    <div className={`summit ${sans.variable} ${serif.variable}`}>
      <SummitConfirmedView state={state} sessionId={sessionId ?? null} metaEventId={metaEventId} sameBrowser={sameBrowser} event={event} />
    </div>
  );
}
