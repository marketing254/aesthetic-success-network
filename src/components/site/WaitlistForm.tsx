"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Status = "idle" | "busy" | "done";

/**
 * Founding waitlist form (home page). Payload keys map 1:1 to
 * POST /api/waitlist — never rename one side without the other.
 */
const ROLE_OTHER = "Other aesthetic practice";

export default function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [thanksMsg, setThanksMsg] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const thanksRef = useRef<HTMLDivElement | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity?.();
      return;
    }
    setStatus("busy");
    setError(null);

    const fd = new FormData(form);
    const payload = {
      firstName: String(fd.get("first") ?? ""),
      lastName: String(fd.get("last") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("mobile") ?? ""),
      practiceName: String(fd.get("practice") ?? ""),
      roleLabel: String(fd.get("role") ?? ""),
      roleLabelOther: String(fd.get("roleOther") ?? ""),
      locations: String(fd.get("locations") ?? ""),
      challenge: String(fd.get("challenge") ?? ""),
      agreementAccepted: fd.get("terms") === "on",
      source: "landing",
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        duplicate?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Could not save your spot. Please try again in a moment.");
        setStatus("idle");
        return;
      }
      if (body.duplicate && body.message) setThanksMsg(body.message);
      setStatus("done");
      setTimeout(
        () => thanksRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        60,
      );
    } catch {
      setError("Something went wrong sending your details. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="thanks waitlist-thanks" ref={thanksRef}>
        <h3>You&rsquo;re on the list.</h3>
        <p>
          {thanksMsg ??
            "Thanks! We'll be in touch as founding spots open. Keep an eye on your inbox."}
        </p>
      </div>
    );
  }

  return (
    <form className="netform waitlist" id="waitlistForm" noValidate onSubmit={onSubmit}>
      {error && <div className="formerror" role="alert">{error}</div>}
      <div className="frow">
        <div className="field">
          <label htmlFor="wl-first">First name</label>
          <input id="wl-first" name="first" required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="wl-last">Last name</label>
          <input id="wl-last" name="last" required autoComplete="family-name" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wl-email">Email</label>
        <input id="wl-email" type="email" name="email" required autoComplete="email" />
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="wl-mobile">Mobile</label>
          <input id="wl-mobile" type="tel" name="mobile" autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="wl-practice">Practice name</label>
          <input id="wl-practice" name="practice" autoComplete="organization" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="wl-role">You are a&hellip;</label>
          <select
            id="wl-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Select</option>
            <option>Dermatologist</option>
            <option>Plastic surgeon</option>
            <option>Med spa owner</option>
            <option>Esthetician</option>
            <option>Injector</option>
            <option>{ROLE_OTHER}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="wl-loc">Locations</label>
          <select id="wl-loc" name="locations" defaultValue="">
            <option value="">Select</option>
            <option>1</option>
            <option>2–3</option>
            <option>4–9</option>
            <option>10+</option>
          </select>
        </div>
      </div>
      {role === ROLE_OTHER && (
        <div className="field">
          <label htmlFor="wl-role-other">Tell us about your practice</label>
          <input
            id="wl-role-other"
            name="roleOther"
            required
            placeholder="e.g. laser clinic, wellness spa, hair restoration"
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="wl-chal">Your biggest practice challenge right now</label>
        <textarea id="wl-chal" name="challenge" />
      </div>
      <label className="check">
        <input type="checkbox" name="terms" required /> I agree to the{" "}
        <Link href="/member-agreement">Member Agreement</Link>, the{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> and the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Saving your spot…" : "Join the founding waitlist"}
      </button>
      <div className="formnote">
        No payment today &middot; No spam &middot; We&rsquo;ll only contact you about your founding
        spot.
      </div>
    </form>
  );
}
