"use client";

import { useEffect, useState } from "react";

export type CurrentMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  credential: string | null;
  email: string;
  phone: string | null;
  practice_name: string | null;
  practice_role: string | null;
  city: string | null;
  tier: string | null;
  status: string;
  joined_at: string | null;
  activated_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  card_brand: string | null;
  card_last4: string | null;
  founding_member_locked: boolean;
};

export type MemberMeResponse = {
  member: CurrentMember | null;
  viewedCount: number;
};

/**
 * Fetches `/api/member/me` once on mount. Returns the member row + a
 * loading flag. If the user isn't signed in, `member` stays null and
 * `loading` flips false.
 */
export function useCurrentMember() {
  const [member, setMember] = useState<CurrentMember | null>(null);
  const [viewedCount, setViewedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/me", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setMember(null);
          setLoading(false);
          return;
        }
        const body = (await res.json()) as MemberMeResponse;
        if (!active) return;
        setMember(body.member);
        setViewedCount(body.viewedCount);
      } catch {
        if (active) setMember(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { member, viewedCount, loading };
}
