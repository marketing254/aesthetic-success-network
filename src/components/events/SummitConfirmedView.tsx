"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { initMetaPixel, trackMeta } from "@/components/ads/metaPixel";
import { trackEventOnce } from "@/lib/analytics";

export type ConfirmedState = "paid" | "processing" | "invalid";

const DEFAULT_EVENT = { dateLabel: "Date to be announced", timeLabel: "Time to be announced" };

/**
 * Summit thank-you page body. The join link is deliberately absent: Zoom
 * emails it to the registrant. This page confirms the trial and shows
 * whether the registration has reached the team's sheet (from which n8n
 * registers them in Zoom).
 */
export default function SummitConfirmedView({
  state,
  sessionId,
  metaEventId,
  sameBrowser,
  event = DEFAULT_EVENT,
}: {
  state: ConfirmedState;
  sessionId: string | null;
  metaEventId: string | null;
  sameBrowser: boolean;
  /** Event facts from the env-driven SUMMIT constants (placeholders until scheduled). */
  event?: { dateLabel: string; timeLabel: string };
}) {
  const [queued, setQueued] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const fired = useRef(false);

  // A $0 trial is NOT a purchase: fire StartTrial (value 0), never Purchase.
  useEffect(() => {
    if (state !== "paid" || !metaEventId || fired.current) return;
    fired.current = true;
    try {
      const key = `asn_trial_${metaEventId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* dedupe by event id still holds */
    }
    initMetaPixel();
    trackMeta("PageView");
    trackMeta("StartTrial", { value: 0, currency: "USD", content_name: "summit_trial", predicted_ltv: 49 }, metaEventId);
    trackEventOnce(`summit_${metaEventId}`, "trial_start", { method: "summit_embedded", value: 0, currency: "USD" });
  }, [state, metaEventId]);

  // Same-browser auto sign-in (server re-verifies session + signed cookie).
  useEffect(() => {
    if (state !== "paid" || !sameBrowser || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ads/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (!cancelled) setSignedIn(!!body.ok);
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, sameBrowser, sessionId]);

  // Poll the Zoom registration state (and, while processing, payment).
  useEffect(() => {
    if (state === "invalid" || !sessionId) return;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/events/summit/status?session_id=${encodeURIComponent(sessionId)}`);
        const body = (await res.json().catch(() => ({}))) as { state?: string; queued?: boolean };
        if (state === "processing" && body.state === "paid") {
          window.location.reload();
          return true;
        }
        if (body.queued) {
          setQueued(true);
          return true;
        }
      } catch {
        /* keep polling */
      }
      return attempts >= 40;
    };
    void tick();
    const timer = setInterval(async () => {
      if (await tick()) clearInterval(timer);
    }, 4000);
    return () => clearInterval(timer);
  }, [state, sessionId]);

  return (
    <>
      <header className="event-header container">
        <Link href="/summit" aria-label="ASN summit">
          <Image src="/asn-logo-full-white.png" alt="Aesthetic Success Network" className="asn-logo" width={194} height={62} priority />
        </Link>
      </header>

      <main className="container" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 80 }}>
        <div className="signup-card" style={{ borderTop: "4px solid #d1a03a" }}>
          {state === "paid" && (
            <div className="success-card">
              <span className="tick">✓</span>
              <h3>Your trial is active. You&apos;re in.</h3>
              <p>
                <b>$0 charged today.</b> Your 30-day Aesthetic Success Network trial has started. Your first billing date and the $49/month renewal were shown at checkout, and you can cancel from your portal at any time before then.
              </p>
              <p>
                <b>Summit access.</b>{" "}
                {queued
                  ? "You're on the list for the summit. Zoom will email your personal join link within a few minutes; check your spam folder if it doesn't appear. Please don't forward it, it's unique to you."
                  : "We're registering you for the summit now. Zoom will email your personal join link within a few minutes."}
              </p>
              <p style={{ fontSize: 13 }}>
                {event.dateLabel} · {event.timeLabel}
              </p>
              <div className="divider" />
              <p>
                <b>Your ASN portal.</b>{" "}
                {signedIn
                  ? "You're signed in on this device."
                  : "A sign-in code will be emailed whenever you sign in; there is no password to remember."}
              </p>
              <Link className="button primary" href="/dashboard" style={{ width: "100%" }}>
                Open my member portal ↗
              </Link>
              <p style={{ fontSize: 12, marginTop: 14 }}>
                Questions? Reply to your confirmation email or write to founding@aestheticsuccessnetwork.com.
              </p>
            </div>
          )}

          {state === "processing" && (
            <div className="success-card">
              <h3>Confirming your trial…</h3>
              <p>Stripe is finishing up. This page updates on its own within a few seconds.</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="success-card">
              <h3>We couldn&apos;t find that registration</h3>
              <p>This link may have expired or been copied incompletely. Start again from the summit page, or email founding@aestheticsuccessnetwork.com and we&apos;ll sort it out.</p>
              <Link className="button primary" href="/summit" style={{ width: "100%" }}>
                Back to the summit page ↗
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="event-footer container">
        <Image src="/asn-logo-full-white.png" alt="Aesthetic Success Network" width={160} height={52} />
        <p>{event.dateLabel} · Aesthetic Success Network · Powered by Business of Aesthetics</p>
        <nav className="site-links" aria-label="Legal">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/refund">Cancellation</Link>
          <Link href="/agreement/member">Member Agreement</Link>
        </nav>
      </footer>
    </>
  );
}
