"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Status = "idle" | "busy" | "done";

export type ExpertFormDefaults = {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
};

/**
 * Expert application form (ASN design). Posts to DMN's POST /api/expert/signup.
 *
 * Field mapping (see src/lib/expert/validate.ts and the route):
 *   first + last        -> fullName (required)
 *   email               -> email (required)
 *   phone               -> phone (optional)
 *   company             -> companyName (optional)
 *   topics              -> topics (required; the server also uses it as specialty)
 *   bio                 -> bio (required)
 *   booking             -> bookingLink (optional, full https URL)
 *   sample              -> sampleLink (optional, full https URL)
 *   courses             -> paidCourses
 *   own checkbox        -> contentOwnershipConfirmed (required)
 *   terms checkbox      -> agreementAccepted (required) + agreementAcceptedAt
 *   consideredFounding  -> always false: founding experts are internal only
 *   source              -> "experts-page" (or the value passed in)
 * The route answers { ok, id } or { ok, duplicate, message } or { error, field }.
 */
export default function ExpertForm({
  defaultValues,
  apiEndpoint = "/api/expert/signup",
  source = "experts-page",
}: {
  defaultValues?: ExpertFormDefaults;
  apiEndpoint?: string;
  source?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [thanksMsg, setThanksMsg] = useState<string | null>(null);
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
    const nowIso = new Date().toISOString();

    const payload = {
      fullName: [s("first"), s("last")].filter(Boolean).join(" "),
      firstName: s("first"),
      lastName: s("last"),
      email: s("email"),
      phone: s("phone") || undefined,
      companyName: s("company") || undefined,
      topics: s("topics"),
      bio: s("bio"),
      bookingLink: s("booking") || undefined,
      sampleLink: s("sample") || undefined,
      paidCourses: s("courses") || undefined,
      contentOwnershipConfirmed: fd.get("own") === "on",
      agreementAccepted: fd.get("terms") === "on",
      agreementAcceptedAt: nowIso,
      consideredFounding: false,
      alsoPartner: false,
      smsConsent: false,
      source,
      utm: { form: "asn-experts-page" },
    };

    try {
      const res = await fetch(apiEndpoint, {
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
        setError(body.error ?? "Could not submit your application. Please try again in a moment.");
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
      setError("Something went wrong sending your application. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="thanks" ref={thanksRef}>
        <h3>Application received.</h3>
        <p>
          {thanksMsg ??
            "Thanks! Our team reviews every expert for fit, and we'll be in touch soon."}
        </p>
      </div>
    );
  }

  return (
    <form className="netform" id="applyForm" noValidate onSubmit={onSubmit}>
      {error && (
        <div className="formerror" role="alert">
          {error}
        </div>
      )}
      <div className="frow">
        <div className="field">
          <label htmlFor="x-first">First name</label>
          <input
            id="x-first"
            name="first"
            required
            autoComplete="given-name"
            defaultValue={defaultValues?.firstName}
          />
        </div>
        <div className="field">
          <label htmlFor="x-last">Last name</label>
          <input
            id="x-last"
            name="last"
            required
            autoComplete="family-name"
            defaultValue={defaultValues?.lastName}
          />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="x-email">Email</label>
          <input
            id="x-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            defaultValue={defaultValues?.email}
          />
        </div>
        <div className="field">
          <label htmlFor="x-phone">Phone (optional)</label>
          <input id="x-phone" type="tel" name="phone" autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="x-company">Company or practice (optional)</label>
          <input
            id="x-company"
            name="company"
            autoComplete="organization"
            defaultValue={defaultValues?.company}
          />
      </div>
      <div className="field">
        <label htmlFor="x-topics">Your topics / areas of expertise (3 to 4)</label>
        <input
          id="x-topics"
          name="topics"
          required
          placeholder="e.g. med spa operations, team & injector hiring, aesthetic marketing"
        />
      </div>
      <div className="field">
        <label htmlFor="x-bio">Short bio + title / credentials</label>
        <textarea id="x-bio" name="bio" required maxLength={2000} />
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="x-booking">Booking link (Calendly / Cal.com)</label>
          <input id="x-booking" type="url" name="booking" placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor="x-courses">Have paid courses to offer?</label>
          <select id="x-courses" name="courses" defaultValue="">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
            <option>Maybe later</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="x-sample">Sample recording or content (link, optional)</label>
        <input id="x-sample" type="url" name="sample" placeholder="https://" />
      </div>
      <label className="check">
        <input type="checkbox" name="own" required /> I confirm the content I share is mine to
        publish to members.
      </label>
      <label className="check">
        <input type="checkbox" name="terms" required /> I have read and agree to the{" "}
        <Link href="/agreement/provider">Provider Agreement</Link> (
        <a href="/agreements/asn-provider-agreement.pdf" target="_blank" rel="noopener noreferrer">
          PDF
        </a>
        ).
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Submitting…" : "Submit application"}
      </button>
      <div className="formnote">
        Curated bench &middot; We review every expert for fit and reply personally. Headshots are
        added in your expert portal after approval.
      </div>
    </form>
  );
}
