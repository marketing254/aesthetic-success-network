"use client";

import { useEffect } from "react";

/**
 * Records one view of a job page.
 *
 * "Views per post matters more than it sounds. It is the only evidence
 * we can give a member that posting here did anything." So it has to be
 * a number the member trusts, which means it should count people rather
 * than requests.
 *
 * Fired from the client on purpose: counting server renders would fold
 * in every crawler, preview fetch and uptime check, and inflate the one
 * number we're asking a member to believe. Deduplication per viewer per
 * day happens server-side on a unique index.
 *
 * Renders nothing and never blocks paint.
 */
export default function JobViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    // Referrer tells us whether the group post or Google is doing the
    // work — the single most useful thing to know when the owner asks
    // whether the promotion is worth the slot.
    let referrerKind = "direct";
    try {
      const ref = document.referrer;
      if (ref) {
        const host = new URL(ref).hostname.replace(/^www\./, "");
        if (host.includes("facebook") || host.includes("fb.")) referrerKind = "facebook";
        else if (host.includes("google")) referrerKind = "google";
        else if (host.endsWith("aestheticsuccessnetwork.com")) referrerKind = "internal";
        else referrerKind = "other";
      }
    } catch {
      // A malformed referrer isn't worth failing a view over.
    }

    const controller = new AbortController();
    void fetch(`/api/jobs/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerKind }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {
      // A dropped view is not worth surfacing to a job seeker.
    });

    return () => controller.abort();
  }, [slug]);

  return null;
}
