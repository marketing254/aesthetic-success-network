import "server-only";
import { createHash } from "node:crypto";

/**
 * Meta (Facebook/Instagram) Conversions API — SERVER-SIDE purchase
 * reporting for the paid-ads channel.
 *
 * Security & correctness rails:
 *   - Only ever called from server code (webhook / verified-session
 *     routes). The browser can never fabricate a server Purchase.
 *   - The caller passes an eventId minted at checkout-session creation;
 *     the browser Pixel (if configured) fires the same id, so Meta
 *     de-duplicates and a purchase is never double-counted.
 *   - Email is SHA-256 hashed (lowercased, trimmed) per Meta's spec —
 *     raw PII never leaves our server unhashed.
 *   - Fully no-op when the env isn't configured, and NEVER throws:
 *     ad measurement must never break payment processing.
 *
 * Env (server-side):
 *   META_PIXEL_ID           — the Pixel/dataset id (digits)
 *   META_CAPI_ACCESS_TOKEN  — Conversions API system-user token
 */

const GRAPH_VERSION = "v21.0";

function pixelId(): string | null {
  const id = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return id && /^\d{5,20}$/.test(id) ? id : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type MetaPurchaseInput = {
  eventId: string;
  email: string;
  value: number;
  currency: string;
  contentName: string;
  eventSourceUrl?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * Report a confirmed Purchase to Meta. Call ONLY after the server has
 * verified payment (webhook / secret-key session retrieval). Returns
 * true when the event was accepted, false otherwise — callers must not
 * treat false as an error worth failing the request over.
 */
export async function sendMetaPurchase(input: MetaPurchaseInput): Promise<boolean> {
  return sendMetaEvent("Purchase", input);
}

/**
 * Report a server-verified standard event. Used for Purchase (paid) and
 * StartTrial ($0 trial — which must NEVER be reported as a Purchase or
 * carry the renewal amount as collected revenue). Same rails as above:
 * server-only, hashed PII, event id dedupe, no-op when unconfigured.
 */
export async function sendMetaEvent(
  eventName: "Purchase" | "StartTrial",
  input: MetaPurchaseInput,
): Promise<boolean> {
  const id = pixelId();
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!id || !token) return false; // Not configured yet — silent no-op.

  // Derive fbc from a raw fbclid when the _fbc cookie wasn't present
  // (Meta's documented reconstruction format).
  const fbc =
    input.fbc ||
    (input.fbclid ? `fb.1.${Date.now()}.${input.fbclid}` : null);

  const userData: Record<string, unknown> = {
    em: [sha256(input.email)],
  };
  if (input.firstName) userData.fn = [sha256(input.firstName)];
  if (input.lastName) userData.ln = [sha256(input.lastName)];
  if (input.fbp) userData.fbp = input.fbp;
  if (fbc) userData.fbc = fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: {
          value: input.value,
          currency: input.currency.toUpperCase(),
          content_name: input.contentName,
        },
      },
    ],
    // TEMPORARY testing hook: when META_CAPI_TEST_EVENT_CODE is set (e.g.
    // TEST39618 from Events Manager → Test events), server events route to
    // the Test Events debug view. UNSET the env var after verification —
    // events sent with a test code do NOT count toward real campaign data.
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // Never let a slow Graph API hold a webhook open.
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[meta capi] ${eventName} rejected:`, res.status, text.slice(0, 300));
      return false;
    }
    // One line per accepted event so Vercel logs show the send happened
    // (event name, our dedupe id, value) — no PII.
    const accepted = (await res.json().catch(() => null)) as { events_received?: number } | null;
    console.info(`[meta capi] ${eventName} accepted`, {
      eventId: input.eventId,
      value: input.value,
      eventsReceived: accepted?.events_received ?? null,
      testCode: !!process.env.META_CAPI_TEST_EVENT_CODE,
    });
    return true;
  } catch (err) {
    console.error(`[meta capi] ${eventName} send failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}
