"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { vendorCategories } from "@/lib/vendorData";

type Status = "idle" | "busy" | "done";

export type PartnerFormDefaults = {
  contactName?: string;
  email?: string;
  companyName?: string;
};

/**
 * Company application form (ASN design). Posts to DMN's POST /api/vendor/signup,
 * which creates the vendors + vendor_applications rows (status pending_review),
 * pre-creates the portal auth user and sends the sign-in link.
 *
 * Field mapping (see src/app/api/vendor/signup/route.ts):
 *   company             -> companyName (required)
 *   website             -> website (optional)
 *   contact             -> contactName (required) and signatureName
 *   role                -> signatureTitle (optional)
 *   email               -> contactEmail (required)
 *   phone               -> contactPhone (optional)
 *   category (+other)   -> category ("Other: ..." when Other is chosen)
 *   description         -> description (optional, up to 2000 chars)
 *   deal                -> memberOffer (optional, up to 500 chars)
 *   booking             -> calendarLink (optional)
 *   billing             -> secondaryEmail (optional billing contact email)
 *   role                -> contactRole (stored as contact_role)
 *   terms checkbox      -> agreedToTerms + confirmedAuthority (one ASN checkbox)
 *   planId              -> "founding" (the launch cohort ramp)
 *   source              -> "partners-page" (or the value passed in)
 * The route answers { success, applicationId, magicLinkSent, message } or { error }.
 */
export default function PartnerForm({
  defaultValues,
  apiEndpoint = "/api/vendor/signup",
  source = "partners-page",
}: {
  defaultValues?: PartnerFormDefaults;
  apiEndpoint?: string;
  source?: string;
}) {
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
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const cat = s("category");
    const categoryValue =
      cat === "Other" && s("categoryOther") ? `Other: ${s("categoryOther")}`.slice(0, 120) : cat;

    const payload = {
      companyName: s("company"),
      website: s("website") || undefined,
      contactName: s("contact"),
      contactEmail: s("email"),
      contactPhone: s("phone") || undefined,
      category: categoryValue || undefined,
      description: s("description") || undefined,
      memberOffer: s("deal") || undefined,
      calendarLink: s("booking") || undefined,
      secondaryEmail: s("billing") || undefined,
      signatureName: s("contact"),
      signatureTitle: s("role") || undefined,
      contactRole: s("role") || undefined,
      agreedToTerms: fd.get("terms") === "on",
      confirmedAuthority: fd.get("terms") === "on",
      alsoExpert: false,
      smsConsent: false,
      planId: "founding",
      source,
    };

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !(body.success || body.ok)) {
        setError(body.error ?? "Could not submit your application. Please try again in a moment.");
        setStatus("idle");
        return;
      }
      if (body.message) setThanksMsg(body.message);
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
          {thanksMsg ?? "Thanks! We review every company for fit, and we'll be in touch soon."}
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
          <label htmlFor="p-company">Company name</label>
          <input
            id="p-company"
            name="company"
            required
            autoComplete="organization"
            defaultValue={defaultValues?.companyName}
          />
        </div>
        <div className="field">
          <label htmlFor="p-website">Website</label>
          <input id="p-website" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} name="website" placeholder="www.yoursite.com" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-contact">Contact name</label>
          <input
            id="p-contact"
            name="contact"
            required
            autoComplete="name"
            defaultValue={defaultValues?.contactName}
          />
        </div>
        <div className="field">
          <label htmlFor="p-role">Role</label>
          <input id="p-role" name="role" autoComplete="organization-title" />
        </div>
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-email">Email</label>
          <input
            id="p-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            defaultValue={defaultValues?.email}
          />
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
          {vendorCategories.map((c) => (
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
        <textarea id="p-desc" name="description" maxLength={2000} />
      </div>
      <div className="field">
        <label htmlFor="p-deal">
          The member deal you&rsquo;ll offer (discount or exclusive benefit)
        </label>
        <textarea id="p-deal" name="deal" maxLength={500} />
      </div>
      <div className="frow">
        <div className="field">
          <label htmlFor="p-booking">Booking link</label>
          <input id="p-booking" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} name="booking" placeholder="www.yoursite.com" />
        </div>
        <div className="field">
          <label htmlFor="p-billing">Billing contact email</label>
          <input id="p-billing" type="email" name="billing" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="terms" required /> I am authorized to commit my company and I agree to the{" "}
        <Link href="/agreement/provider">Provider Agreement</Link> (
        <a href="/agreements/asn-provider-agreement.pdf" target="_blank" rel="noopener noreferrer">
          PDF
        </a>
        ).
      </label>
      <button className="btn bronze" type="submit" disabled={status === "busy"}>
        {status === "busy" ? "Submitting…" : "Submit company application"}
      </button>
      <div className="formnote">
        Limited per category &middot; We review every company for fit and reply personally. Logos
        are added in your company portal after you sign in.
      </div>
    </form>
  );
}
