"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { challengeOptions, heardAboutOptions, locationOptions, memberRoles } from "@/lib/content";
import type { RefContext } from "@/lib/referralContext";
import { trackEvent } from "@/lib/analytics";

/**
 * Member signup (ASN design). Same three steps, the same fields and the SAME
 * /api/member/signup payload as DMN's MemberSignupFlow, rendered with the
 * ASN site classes (netform, field, btn) instead of MUI. Success continues
 * into the pay-first flow: /upgrade, then Stripe checkout.
 *
 *  - ?email= prefills the email, ?ref= and ?promo= ride through to /upgrade
 *  - ?resume= visits arrive with saved details (prefill) from the
 *    abandoned-registration email
 *  - the abandoned-registration capture fires on email blur, on Continue
 *    and on tab close, exactly as before
 */

export type SignupPrefill = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  practiceName: string | null;
};

const OTHER = "Other";

// Persisted verbatim server-side as the TCPA/CASL audit trail.
const SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from the Aesthetic Success Network, including hotline replies. Reply STOP to opt out.";

const STEPS = [
  { eyebrow: "Step 1 of 3", title: "First, about you.", sub: "Three short steps to reserve your founding spot. Nothing to pay today." },
  { eyebrow: "Step 2 of 3", title: "Your practice.", sub: "So the hotline replies fit your practice." },
  { eyebrow: "Step 3 of 3", title: "Almost in.", sub: "One optional question and one agreement, and your spot is reserved." },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function MemberSignupForm({
  refCtx = null,
  prefill = null,
}: {
  refCtx?: RefContext | null;
  prefill?: SignupPrefill | null;
}) {
  const params = useSearchParams();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? params.get("email") ?? "");
  const [roleLabel, setRoleLabel] = useState("");
  const [roleLabelOther, setRoleLabelOther] = useState("");
  const [practiceName, setPracticeName] = useState(prefill?.practiceName ?? "");
  const [locations, setLocations] = useState("");
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState("");
  const [challengeOther, setChallengeOther] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [heardAboutOther, setHeardAboutOther] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const stepValid =
    step === 0
      ? firstName.trim() !== "" && lastName.trim() !== "" && emailOk
      : step === 1
        ? practiceName.trim() !== "" && (roleLabel !== OTHER || roleLabelOther.trim() !== "")
        : agreed &&
          (challenge !== OTHER || challengeOther.trim() !== "") &&
          (heardAbout !== OTHER || heardAboutOther.trim() !== "");

  // Abandoned-registration capture (the server enforces the 30-day
  // one-sequence rule and skips paying members).
  const abandonSnapshot = useRef<string>("");
  const captureAbandon = useCallback(() => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return;
    const snap = JSON.stringify([em, firstName, lastName, practiceName, roleLabel]);
    if (abandonSnapshot.current === snap) return;
    abandonSnapshot.current = snap;
    try {
      void fetch("/api/ads/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          email: em,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          practiceName: practiceName.trim() || null,
          role: roleLabel === OTHER ? roleLabelOther.trim() || null : roleLabel || null,
          plan: params.get("interval") === "annual" ? "founding_annual" : "founding_monthly",
          utm: { ref: params.get("ref") ?? null, promo: params.get("promo") ?? null, source: "landing-join" },
        }),
      });
    } catch {
      /* capture must never affect the visitor */
    }
  }, [email, firstName, lastName, practiceName, roleLabel, roleLabelOther, params]);

  useEffect(() => {
    const onLeave = () => captureAbandon();
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [captureAbandon]);

  const go = (d: 1 | -1) => {
    setError(null);
    if (d === 1 && step === 0) captureAbandon();
    setStep((s) => Math.min(2, Math.max(0, s + d)));
  };

  const [done, setDone] = useState<string | null>(null);

  // Launch switch (NEXT_PUBLIC_MEMBER_LAUNCH_ENABLED):
  //   off  -> the signup goes to the waitlist only. No plan step, no
  //           payment, no portal access, no email.
  //   on   -> the same form creates the member (POST /api/member/signup,
  //           which also records the waitlist details) and continues to
  //           /upgrade for plan + Stripe checkout.
  const launchOn = process.env.NEXT_PUBLIC_MEMBER_LAUNCH_ENABLED === "true";
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const resolveOther = (v: string, other: string) => (v === OTHER ? other.trim() : v || undefined);
    try {
      const res = await fetch(launchOn ? "/api/member/signup" : "/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "member",
          fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          practiceName: practiceName.trim() || undefined,
          phone: phone.trim() || undefined,
          practiceRole: resolveOther(roleLabel, roleLabelOther),
          locations: locations || undefined,
          challenge: resolveOther(challenge, challengeOther),
          agreementAccepted: agreed,
          agreementAcceptedAt: new Date().toISOString(),
          smsConsent,
          smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
          smsConsentAt: smsConsent ? new Date().toISOString() : null,
          source: "landing-join",
          ref: params.get("ref") ?? undefined,
          utm: {
            form: "asn-member-signup",
            heard_about: resolveOther(heardAbout, heardAboutOther) ?? null,
            role_label: resolveOther(roleLabel, roleLabelOther) ?? null,
            locations: locations || null,
            biggest_challenge: resolveOther(challenge, challengeOther) ?? null,
            ref: params.get("ref") ?? null,
            promo: params.get("promo") ?? null,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; duplicate?: boolean; message?: string; error?: string; next?: string };
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Couldn't save your spot right now. Please try again.");
        setSubmitting(false);
        return;
      }
      trackEvent("sign_up", { method: params.get("ref") ? "referral" : "organic" });
      if (launchOn) {
        // Doors open: on to the plan picker and Stripe. Keep ?ref / ?promo.
        const next = new URL(data.next ?? "/upgrade", window.location.origin);
        for (const k of ["ref", "promo"]) {
          const v = params.get(k);
          if (v) next.searchParams.set(k, v);
        }
        window.location.assign(next.pathname + next.search);
        return;
      }
      setDone(data.duplicate && data.message ? data.message : "You're on the founding waitlist. We'll email you before the doors open, and you confirm before any charge.");
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const offerN = refCtx?.offerActive ? refCtx.offerMonths : 0;
  const s = STEPS[step]!;

  if (done) {
    return (
      <div className="thanks waitlist-thanks">
        <h3>You&rsquo;re on the list.</h3>
        <p>{done}</p>
      </div>
    );
  }

  return (
    <div className="netform signup" id="memberSignupForm">
      {refCtx && (
        <div className="signup-ref">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={refCtx.imageUrl ?? "/asn-app-icon-256.png"} alt="" width={44} height={44} />
          <div>
            <b>{refCtx.kind === "team" ? "A gift from the Aesthetic Success Network team" : `Invited by ${refCtx.name}`}</b>
            <span>
              {offerN > 0
                ? `Your first ${offerN === 1 ? "month is" : `${offerN} months are`} on us. Founding rate after that, locked while active.`
                : refCtx.tagline}
            </span>
          </div>
        </div>
      )}

      <span className="kicker">{s.eyebrow}</span>
      <h2 className="signup-title">{s.title}</h2>
      <p className="signup-sub">{s.sub}</p>

      {step === 0 && (
        <>
          <div className="frow">
            <div className="field">
              <label htmlFor="ms-first">First name</label>
              <input id="ms-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            </div>
            <div className="field">
              <label htmlFor="ms-last">Last name</label>
              <input id="ms-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ms-email">Work email</label>
            <input id="ms-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => captureAbandon()} autoComplete="email" required />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="field">
            <label htmlFor="ms-role">What best describes your role?</label>
            <select id="ms-role" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)}>
              <option value="">Select</option>
              {memberRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option>{OTHER}</option>
            </select>
          </div>
          {roleLabel === OTHER && (
            <div className="field">
              <label htmlFor="ms-role-other">Tell us your role</label>
              <input id="ms-role-other" value={roleLabelOther} onChange={(e) => setRoleLabelOther(e.target.value)} placeholder="e.g. Director of Operations" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="ms-practice">Practice name</label>
            <input id="ms-practice" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} autoComplete="organization" required />
          </div>
          <div className="frow">
            <div className="field">
              <label htmlFor="ms-loc">Number of locations</label>
              <select id="ms-loc" value={locations} onChange={(e) => setLocations(e.target.value)}>
                <option value="">Select</option>
                {locationOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ms-phone">Phone (optional)</label>
              <input id="ms-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="field">
            <label htmlFor="ms-chal">Biggest challenge right now?</label>
            <select id="ms-chal" value={challenge} onChange={(e) => setChallenge(e.target.value)}>
              <option value="">Select</option>
              {challengeOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {challenge === OTHER && (
            <div className="field">
              <label htmlFor="ms-chal-other">Describe your biggest challenge</label>
              <textarea id="ms-chal-other" value={challengeOther} onChange={(e) => setChallengeOther(e.target.value)} placeholder="e.g. Hiring and retaining injectors" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="ms-heard">How did you hear about us?</label>
            <select id="ms-heard" value={heardAbout} onChange={(e) => setHeardAbout(e.target.value)}>
              <option value="">Select</option>
              {heardAboutOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          {heardAbout === OTHER && (
            <div className="field">
              <label htmlFor="ms-heard-other">Tell us where you heard about us</label>
              <input id="ms-heard-other" value={heardAboutOther} onChange={(e) => setHeardAboutOther(e.target.value)} required />
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required /> I agree to the{" "}
            <Link href="/agreement/member" target="_blank" rel="noopener">
              Member Agreement
            </Link>{" "}
            (
            <a href="/agreements/asn-member-agreement.pdf" target="_blank" rel="noopener noreferrer">
              PDF
            </a>
            ) and to receive launch updates from ASN.
          </label>
          <label className="check">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} /> {SMS_CONSENT_TEXT}
          </label>
        </>
      )}

      {error && (
        <div className="formerror" role="alert">
          {error}
        </div>
      )}

      <div className="signup-actions">
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={() => go(-1)} disabled={submitting}>
            Back
          </button>
        )}
        <button
          type="button"
          className="btn bronze"
          disabled={!stepValid || submitting}
          onClick={() => (step === 2 ? void submit() : go(1))}
        >
          {submitting ? "Saving your spot..." : step === 2 ? "Reserve my founding spot" : "Continue"}
        </button>
      </div>
      <div className="formnote">
        Nothing to pay today &middot; We contact you before the doors open &middot; You confirm before any charge
      </div>
    </div>
  );
}
