"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  code: string;
  fullName: string;
  email: string;
  practiceName: string | null;
};

/**
 * The accept step of the founding-invite flow. Calls
 * POST /api/founding/[code]/accept, which creates a Stripe Checkout
 * Session for the Founding plan and returns its URL — the actual
 * `members` row is only created once /welcome verifies payment
 * (see src/app/welcome/page.tsx), so nobody gets portal access without
 * paying first.
 */
export default function FoundingAcceptView({ code, fullName, email, practiceName }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Re-validate the invite right before showing the form — catches a
  // second tab that already accepted, or a link that expired since the
  // page was first opened.
  useEffect(() => {
    let active = true;
    fetch(`/api/founding/${code}/prepare`, { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((body: { ok?: boolean; error?: string }) => {
        if (!active) return;
        if (body.ok === false) {
          setError(body.error ?? "This invite is no longer valid.");
          setLocked(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [code]);

  const onAccept = async () => {
    if (!agreed) {
      setError("Please agree to the Member Agreement to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/founding/${code}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementAccepted: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !body.ok || !body.url) {
        setError(body.error ?? "Could not start checkout. Please try again in a moment.");
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="invite-box">
      <span className="kicker">Your details</span>
      <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7 }}>
        <div>
          <b>Name:</b> {fullName}
        </div>
        <div>
          <b>Email:</b> {email}
        </div>
        {practiceName ? (
          <div>
            <b>Practice:</b> {practiceName}
          </div>
        ) : null}
        <div>
          <b>Plan:</b> Founding &mdash; $49/mo, locked for life while active
        </div>
      </div>

      <div className="invite-agreement">
        <p>
          By accepting, you agree to the{" "}
          <Link href="/member-agreement" target="_blank">
            Member Agreement
          </Link>
          , the{" "}
          <Link href="/refund-policy" target="_blank">
            Refund &amp; Cancellation Policy
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          You&rsquo;ll be sent to a secure Stripe Checkout page to enter payment details. Your
          $49/mo founding rate is locked for as long as your membership stays active, backed by a
          30-day money-back guarantee.
        </p>
      </div>

      {error && (
        <div className="formerror" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={agreed}
          disabled={locked}
          onChange={(e) => setAgreed(e.target.checked)}
        />{" "}
        I agree to the Member Agreement, Refund &amp; Cancellation Policy and Privacy Policy.
      </label>

      <button
        className="btn bronze"
        type="button"
        disabled={busy || locked}
        onClick={onAccept}
        style={{ marginTop: 18 }}
      >
        {busy ? "Starting checkout…" : "Accept & continue to secure payment"}
      </button>
      {!locked && (
        <div className="formnote">No charge until you complete payment on the next screen.</div>
      )}
    </div>
  );
}
