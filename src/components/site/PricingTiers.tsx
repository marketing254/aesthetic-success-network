"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Member pricing cards for /pricing (ASN design). Founding open/closed comes
 * from DMN's GET /api/stripe/availability (founding only: ASN has no $99
 * "early" tier, EARLY_MEMBER_CAP is 0). Prices are the canon values:
 * Founding $49/mo or $490/yr for the first 100, then Standard $199/mo or
 * $1,990/yr. Every CTA starts the DMN signup flow at /join/member.
 */
type TierStat = { cap: number; taken: number; remaining: number; isOpen: boolean };

const FALLBACK: TierStat = { cap: 100, taken: 0, remaining: 100, isOpen: true };

function norm(v: Partial<TierStat> | undefined): TierStat {
  const cap = typeof v?.cap === "number" ? v.cap : FALLBACK.cap;
  const taken = typeof v?.taken === "number" ? v.taken : 0;
  const remaining = typeof v?.remaining === "number" ? v.remaining : Math.max(0, cap - taken);
  const isOpen = typeof v?.isOpen === "boolean" ? v.isOpen : remaining > 0;
  return { cap, taken, remaining, isOpen };
}

export default function PricingTiers() {
  const [founding, setFounding] = useState<TierStat | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    let active = true;
    fetch("/api/stripe/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { founding?: Partial<TierStat> }) => {
        if (active) setFounding(norm(d.founding));
      })
      .catch(() => {
        if (active) setFounding(FALLBACK);
      });
    return () => {
      active = false;
    };
  }, []);

  const open = founding?.isOpen ?? true;
  const annual = interval === "annual";
  const joinHref = `/join/member?interval=${interval}`;

  return (
    <>
      <div className="toggle" role="group" aria-label="Billing interval">
        <button type="button" className={!annual ? "on" : undefined} onClick={() => setInterval("monthly")}>
          Monthly
        </button>
        <button type="button" className={annual ? "on" : undefined} onClick={() => setInterval("annual")}>
          Annual <small>2 months free</small>
        </button>
      </div>

      <div className="pgrid pgrid--two">
        <div className={`pc${open ? " hot" : " closed"}`}>
          <div className={`badge${open ? "" : " muted"}`}>
            {open
              ? founding && founding.remaining < founding.cap
                ? `Founding · ${founding.remaining} of ${founding.cap} seats left`
                : "Founding · first 100 members"
              : "Founding · all 100 seats claimed"}
          </div>
          <div className="tier">Founding rate</div>
          <div className="price">
            {annual ? "$490" : "$49"}
            <span>{annual ? "/yr" : "/mo"}</span>
          </div>
          <div className="desc">
            {annual
              ? "Pay for 10 months, get 12, save $98/year. Locked while your membership stays active."
              : "Locked for as long as your membership stays active. Annual: $490/yr (two months free)."}
          </div>
          <ul>
            <li>The Expert Hotline: a written action plan in 2 to 3 business days</li>
            <li>The full resource library, new expert kits weekly</li>
            <li>Every member-only company deal</li>
            <li>Practice calculators and tools</li>
            <li>Monthly live AMAs and CE</li>
            <li>30-day money-back guarantee, cancel anytime</li>
          </ul>
          {open ? (
            <Link className="btn bronze" href={joinHref}>
              Claim your founding rate
            </Link>
          ) : (
            <div className="sub">The founding seats are all claimed. Standard membership is open.</div>
          )}
        </div>

        <div className={`pc${open ? "" : " hot"}`}>
          {!open && <div className="badge">Open now</div>}
          <div className="tier">Standard rate</div>
          <div className="price">
            {annual ? "$1,990" : "$199"}
            <span>{annual ? "/yr" : "/mo"}</span>
          </div>
          <div className="desc">
            {open
              ? "The rate once the founding 100 seats fill. Same membership, later price."
              : annual
                ? "Two months free on the annual plan. Same 30-day money-back guarantee."
                : "Same membership, same 30-day money-back guarantee. Annual: $1,990/yr."}
          </div>
          <ul>
            <li>Everything in the founding membership</li>
            <li>Same Hotline, library, company deals and live sessions</li>
            <li>30-day money-back guarantee, cancel anytime</li>
          </ul>
          {!open && (
            <Link className="btn bronze" href={joinHref}>
              Start your membership
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
