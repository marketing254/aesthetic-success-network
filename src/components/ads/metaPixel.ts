"use client";

/**
 * Meta Pixel — browser side of the paid-ads measurement. Loaded ONLY on
 * the /start and /welcome pages (never site-wide), and only when
 * NEXT_PUBLIC_META_PIXEL_ID is configured — everything is a silent no-op
 * until the Pixel id exists.
 *
 * The bootstrap below mirrors Meta's OFFICIAL snippet field-for-field
 * (callMethod check, queue, push, loaded, version). An earlier minimal
 * shim was missing those internals, which made fbevents.js classify our
 * standard events (PageView) as "Custom" in Events Manager.
 *
 * The confirmed Purchase is authoritative on the SERVER (Conversions API
 * from the Stripe webhook). The browser fires the same Purchase with the
 * same eventID purely for match quality — Meta de-duplicates on
 * (event_name, event_id).
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialized = false;

/** Inject the pixel loader once (official snippet semantics). */
export function initMetaPixel(): void {
  if (!PIXEL_ID || typeof window === "undefined" || initialized) return;
  initialized = true;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue.push(args);
      }
    } as Fbq;
    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const first = document.getElementsByTagName("script")[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  }
  window.fbq!("init", PIXEL_ID);
}

/** Track a standard event. No-op when the pixel isn't configured. */
export function trackMeta(
  event: "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase" | "StartTrial",
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  if (eventId) {
    window.fbq("track", event, params ?? {}, { eventID: eventId });
  } else {
    window.fbq("track", event, params ?? {});
  }
}

export const metaPixelConfigured = !!PIXEL_ID;
