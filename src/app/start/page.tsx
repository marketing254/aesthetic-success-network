import type { Metadata } from "next";
import AdsLandingView from "@/components/ads/AdsLandingView";

/**
 * /start — the dedicated Meta paid-ads purchase page.
 *
 * Fully static: no DB reads, no dynamic APIs — campaign parameters
 * (?creative=, utm_*, fbclid) are read client-side, so every ad click is
 * served straight from the CDN edge cache regardless of query string.
 * An ad traffic spike therefore cannot touch the database at all until
 * a buyer actually submits the form.
 *
 * noindex: this is a paid-traffic conversion page, not organic content —
 * keeping it out of Google avoids duplicate-content competition with the
 * main homepage. (The Meta ad crawler does not require indexability.)
 */
export const metadata: Metadata = {
  title: "Join Aesthetic Success Network",
  description:
    "Join Aesthetic Success Network for expert kits, written practice support, vetted partners, tools and member offers.",
  robots: { index: false, follow: false },
};

export default function AdsStartPage() {
  return <AdsLandingView />;
}
