"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Status = "idle" | "busy" | "done";

export const PARTNER_CATEGORIES = [
  "Injectables & pharmaceuticals",
  "Devices & equipment (lasers, energy-based)",
  "Skincare & product lines",
  "Practice-management software",
  "Marketing & growth",
  "Patient financing",
  "Staffing & HR",
  "Coaching & consulting",
  "Continuing education",
  "Accounting & CFO",
  "Other",
];

/**
 * Partner application form. Payload keys map 1:1 to POST /api/partner/apply.
 * The logo file is collected for later follow-up but not uploaded in this
 * phase (matches the launch scope — no storage bucket yet).
 */
export default function PartnerForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [thanksMsg, setThanksMsg] = useState<string | null>(null);
  const [category, setCategory] = useState("");
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
      companyName: String(fd.get("company") ?? ""),
      website: String(fd.get("website") ?? ""),
      contactName: String(fd.get("contact") ?? ""),
      contactRole: String(fd.get("role") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      category: String(fd.get("category") ?? ""),
      categoryOther: String(fd.get("categoryOther") ?? ""),
      description: String(fd.get("description") ?? ""),
      memberDeal: String(fd.get("deal") ?? ""),
      bookingLink: String(fd.get("booking") ?? ""),
      billingContact: String(fd.get("billing") ?? ""),
      agreementAccepted: fd.get("terms") === "on",
      source: "partners-page",
    };

    try {
      const res = await fetch("/api/partner/apply", {
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
          {thanksMsg ?? "Thanks! We review every partner for fit, and we'll be in touch soon."}
        </p>
      </div>
    );
  }

  return (
    <form className="netform" id="applyForm" noValidate onSubmit={onSubmit}>
      {error && <div className="formerror" role="alert">{error}</div>}
      <div className="frow">
        <div className="field">
          <label htmlFor="p-company">Company name</label>
          <input id="p-company" name="company" required autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="p-website">Website</label>
          <input id="p-website" type="url" name="website" placeholder="https://" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-contact">Contact name</label>
          <input id="p-contact" name="contact" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="p-role">Role</label>
          <input id="p-role" name="role" autoComplete="organization-title" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-email">Email</label>
          <input id="p-email" type="email" name="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="p-phone">Phone</label>
          <input id="p-phone" type="tel" name="phone" autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-cat">Category</label>
        <select
          id="p-cat"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select</option>
          {PARTNER_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {category === "Other" && (
        <div className="field">
          <label htmlFor="p-cat-other">Tell us your category</label>
          <input
            id="p-cat-other"
            name="categoryOther"
            required
            placeholder="e.g. medical equipment leasing, compliance consulting"
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="p-desc">Short company description</label>
        <textarea id="p-desc" name="description" />
      </div>
      <div className="field">
        <label htmlFor="p-deal">The member deal you&rsquo;ll offer (discount or exclusive benefit)</label>
        <textarea id="p-deal" name="deal" />
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-booking">Booking link</label>
          <input id="p-booking" type="url" name="booking" placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor="p-billing">Billing contact (after free period)</label>
          <input id="p-billing" name="billing" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-logo">Logo (optional)</label>
        <input id="p-logo" type="file" name="logo" accept="image/*" />
      </div>
      <label className="check">
        <input type="checkbox" name="terms" required /> I agree to the{" "}
        <Link href="/provider-agreement">five Partner commitments and the fee terms</Link> after
        month 6.
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Submitting…" : "Submit partner application"}
      </button>
      <div className="formnote">
        Limited per category &middot; We review every partner for fit and reply personally.
      </div>
    </form>
  );
}
