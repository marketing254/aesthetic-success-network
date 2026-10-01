import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { SUMMIT, eventsDb, type EventRegistrationRow } from "@/lib/events/summit";
import { summitEnabledOr404 } from "@/lib/api/summitGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/summit/status?session_id=cs_…
 *
 * Polled by the confirmation page while Stripe finishes. Verified the
 * same way /welcome is: the Checkout Session is retrieved with the
 * SECRET key and only a session that belongs to this event and is
 * complete reveals anything. `queued` = the registration reached the
 * team's sheet, so Zoom's email is on its way.
 */
const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

export async function GET(req: Request) {
  const summitGate = summitEnabledOr404();
  if (summitGate) return summitGate;
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  if (!SESSION_ID_RE.test(sessionId)) return NextResponse.json({ state: "invalid" });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.event_id !== SUMMIT.eventId || session.metadata?.offer !== "summit_trial") {
      return NextResponse.json({ state: "invalid" });
    }
    // $0 trial → "no_payment_required"; a paid session → "paid". Both count.
    const paid =
      (session.payment_status === "paid" || session.payment_status === "no_payment_required") &&
      session.status === "complete";
    if (!paid) return NextResponse.json({ state: session.status === "expired" ? "invalid" : "processing" });

    const regId = session.metadata?.registration_id ?? "";
    const { data } = await eventsDb().from("event_registrations").select("status, sheet_synced_at").eq("id", regId).maybeSingle();
    const reg = data as Pick<EventRegistrationRow, "status" | "sheet_synced_at"> | null;
    return NextResponse.json({ state: "paid", queued: !!reg?.sheet_synced_at });
  } catch {
    return NextResponse.json({ state: "invalid" });
  }
}
