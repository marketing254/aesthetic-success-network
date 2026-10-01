"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { locationOptions, memberRoles } from "@/lib/content";

type Status = "idle" | "busy" | "done";

const ROLE_OTHER = "Other aesthetic practice";

/**
 * "Not ready yet" waitlist form (home page). Posts to DMN's POST /api/waitlist.
 *
 * Field mapping (ASN field -> DMN payload, see src/lib/waitlist/validate.ts
 * and src/app/api/waitlist/route.ts):
 *   first + last            -> fullName (required, 2 to 120 chars)
 *   email                   -> email (required)
 *   mobile                  -> phone (optional)
 *   practice                -> practiceName (optional)
 *   role (+ roleOther)      -> practiceRole
 *   locations               -> locations
 *   challenge (textarea)    -> challenge
 *   terms checkbox          -> agreementAccepted + agreementAcceptedAt
 *   role                    -> "member" (the only waitlist role in DMN)
 *   source                  -> "landing"
 *   ?ref=CODE on the URL    -> ref (referral attribution, validated server-side)
 * The route answers { ok, id } or { ok, duplicate, message } or { error, field }.
 */
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
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const fullName = [s("first"), s("last")].filter(Boolean).join(" ");
    const ref = new URLSearchParams(window.location.search).get("ref") ?? undefined;
    const nowIso = new Date().toISOString();

    const practiceRole =
      s("role") === ROLE_OTHER && s("roleOther") ? `${ROLE_OTHER}: ${s("roleOther")}` : s("role");

    const payload = {
      role: "member",
      fullName,
      firstName: s("first"),
      lastName: s("last"),
      email: s("email"),
      phone: s("mobile") || undefined,
      practiceName: s("practice") || undefined,
      practiceRole: practiceRole || undefined,
      locations: s("locations") || undefined,
      challenge: s("challenge") || undefined,
      agreementAccepted: fd.get("terms") === "on",
      agreementAcceptedAt: nowIso,
      source: "landing",
      utm: { form: "asn-home-waitlist" },
      ...(ref ? { ref } : {}),
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
      {error && (
        <div className="formerror" role="alert">
          {error}
        </div>
      )}
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
          <select id="wl-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Select</option>
            {memberRoles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wl-loc">Locations</label>
          <select id="wl-loc" name="locations" defaultValue="">
            <option value="">Select</option>
            {locationOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
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
        <textarea id="wl-chal" name="challenge" maxLength={2000} />
      </div>
      <label className="check">
        <input type="checkbox" name="terms" required /> I agree to the{" "}
        <Link href="/agreement/member">Member Agreement</Link>, the{" "}
        <Link href="/legal/refund">Refund &amp; Cancellation Policy</Link> and the{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>.
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Saving your spot…" : "Join the waitlist"}
      </button>
      <div className="formnote">
        No payment today &middot; No spam &middot; We&rsquo;ll only contact you about your
        founding spot.
      </div>
    </form>
  );
}
