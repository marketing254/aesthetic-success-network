"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Google Analytics 4 loader + SPA page-view tracker.
 *
 * Reads the measurement ID from NEXT_PUBLIC_GA_ID. When the env var is
 * missing (local dev, preview builds without it set), the component
 * renders nothing — so analytics never fires unless production has the
 * ID configured.
 *
 * Fixes over the original version (found via the 90-day GA4 export):
 *   1. ADMIN NOISE — /admin* sessions (the team's own console use) were
 *      the #4 "landing page" in reports. GA now never loads on /admin.
 *   2. SPA NAVIGATION — gtag's initial `config` records one page view;
 *      Next.js client-side navigations never sent another, which
 *      under-counted inner pages and produced "(not set)" landing rows.
 *      A pathname listener now reports every route change.
 *
 * CSP: middleware allowlists googletagmanager.com (script-src) and
 * google-analytics.com (connect-src + img-src).
 */
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const firstRender = useRef(true);

  // SPA route-change page views. The initial load is reported by the
  // `config` call below, so skip the first run to avoid double-counting.
  useEffect(() => {
    if (!gaId || isAdmin) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      window.gtag?.("event", "page_view", {
        page_path: pathname,
        page_location: window.location.href,
      });
    } catch {
      /* analytics must never break navigation */
    }
  }, [pathname, gaId, isAdmin]);

  if (!gaId || isAdmin) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        // The dataLayer + gtag bootstrap. Mirrors the snippet Google
        // hands out, just templated with our measurement ID.
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
