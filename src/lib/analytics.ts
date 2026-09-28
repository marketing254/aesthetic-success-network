"use client";

/**
 * GA4 event helper — the missing half of our analytics.
 *
 * GoogleAnalytics.tsx loads gtag and tracks page views; until now NO
 * conversion events existed anywhere, so every GA4 report showed
 * "Key events: 0" and landing-page analysis was impossible.
 *
 * Funnel events (mark each as a KEY EVENT in GA4 Admin → Events):
 *   sign_up         — a member account was created (params.method says
 *                     which flow: organic | referral | meta_ads)
 *   begin_checkout  — a Stripe checkout was opened
 *   purchase        — a membership subscription was confirmed
 *
 * Rules:
 *   - Silent no-op when gtag isn't loaded (dev, preview, blockers).
 *   - Never throws — analytics must never break a signup or payment.
 *   - No PII in params (GA4 policy + our own).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", name, params ?? {});
  } catch {
    /* never let analytics break the flow */
  }
}

/**
 * Fire an event at most once per browser session (survives re-renders
 * and refreshes of confirmation pages, so a page reload can't double-
 * count a purchase).
 */
export function trackEventOnce(key: string, name: string, params?: Record<string, unknown>): void {
  try {
    const storageKey = `asn_ga_${key}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    /* storage unavailable — fall through and fire anyway */
  }
  trackEvent(name, params);
}
