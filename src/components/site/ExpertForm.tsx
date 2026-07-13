"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Status = "idle" | "busy" | "done";

/**
 * Expert application form. Payload keys map 1:1 to POST /api/expert/apply.
 * The headshot file is collected for later follow-up but not uploaded in
 * this phase (matches the launch scope — no storage bucket yet).
 */
export default function ExpertForm() {
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
    const payload = {
      firstName: String(fd.get("first") ?? ""),
      lastName: String(fd.get("last") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      company: String(fd.get("company") ?? ""),
      topics: String(fd.get("topics") ?? ""),
      bio: String(fd.get("bio") ?? ""),
      bookingLink: String(fd.get("booking") ?? ""),
      paidCourses: String(fd.get("courses") ?? ""),
      sampleLink: String(fd.get("sample") ?? ""),
      contentOwnershipConfirmed: fd.get("own") === "on",
      agreementAccepted: fd.get("terms") === "on",
      source: "experts-page",
    };

    try {
      const res = await fetch("/api/expert/apply", {
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
      {error && <div className="formerror" role="alert">{error}</div>}
      <div className="frow">
        <div className="field">
          <label htmlFor="x-first">First name</label>
          <input id="x-first" name="first" required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="x-last">Last name</label>
          <input id="x-last" name="last" required autoComplete="family-name" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="x-email">Email</label>
          <input id="x-email" type="email" name="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="x-phone">Phone (optional)</label>
          <input id="x-phone" type="tel" name="phone" autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="x-company">Company or practice (optional)</label>
        <input id="x-company" name="company" autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="x-topics">Your topics / areas of expertise (3&ndash;4)</label>
        <input
          id="x-topics"
          name="topics"
          placeholder="e.g. injectables, practice marketing, staff training"
        />
      </div>
      <div className="field">
        <label htmlFor="x-bio">Short bio + title / credentials</label>
        <textarea id="x-bio" name="bio" />
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
      <div className="field">
        <label htmlFor="x-headshot">Headshot (optional)</label>
        <input id="x-headshot" type="file" name="headshot" accept="image/*" />
      </div>
      <label className="check">
        <input type="checkbox" name="own" required /> I confirm the content I share is mine to
        publish to members.
      </label>
      <label className="check">
        <input type="checkbox" name="terms" required /> I agree to the{" "}
        <Link href="/provider-agreement">expert terms</Link>.
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Submitting…" : "Submit application"}
      </button>
      <div className="formnote">
        Curated bench &middot; We review every expert for fit and reply personally.
      </div>
    </form>
  );
}
