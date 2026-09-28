import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * ASN summit (placeholder). There is no ASN summit yet: every constant below
 * is env/placeholder driven (SUMMIT_ENABLED, SUMMIT_EVENT_ID default
 * "asn-summit-tbd"), the page is not linked or in the sitemap, and the
 * /summit routes 404 unless SUMMIT_ENABLED === "true". The code paths stay so
 * a future event only needs env values and copy.
 *
 * The flow, in one line: verified entitlement → one "Pending" row in the
 * team's Google Sheet → n8n's sheet trigger registers the person in Zoom
 * and writes the join link back → Zoom emails them.
 *
 * The rule this module enforces: the sheet row (and therefore the Zoom
 * registration) is only ever written by the SERVER after the Stripe
 * webhook confirmed the trial subscription, or after a signed-in
 * member's active subscription was verified in the database. Nothing
 * the browser sends can create that row.
 */

/** True only when the team has switched the summit on (SUMMIT_ENABLED=true). */
export const SUMMIT_ENABLED = process.env.SUMMIT_ENABLED === "true";

const env = (name: string): string => (process.env[name] ?? "").trim();
const EVENT_ID = env("SUMMIT_EVENT_ID") || "asn-summit-tbd";

export const SUMMIT = {
  /** Stable event id; also the value stored in event_registrations.event_id. */
  eventId: EVENT_ID,
  title: env("SUMMIT_TITLE") || "ASN Summit (date to be announced)",
  subtitle: env("SUMMIT_SUBTITLE") || "A live session for aesthetic practice owners",
  dateLabel: env("SUMMIT_DATE_LABEL") || "Date to be announced",
  timeLabel: env("SUMMIT_TIME_LABEL") || "Time to be announced",
  /** ISO start. Placeholder far in the future until an event is scheduled. */
  startsAt: env("SUMMIT_STARTS_AT") || "2099-01-01T19:00:00-05:00",
  zoomWebinarId: env("SUMMIT_ZOOM_WEBINAR_ID"),
  /** The Stripe offer for this campaign: $0 for 30 days, then $49/month. */
  plan: "founding_monthly" as const,
  trialDays: 30,
  /** utm_campaign the ads use for this event; defaults to the event id. */
  campaign: env("SUMMIT_CAMPAIGN") || EVENT_ID,
  /** Registrations close when the event ends. Placeholder until scheduled. */
  closesAt: env("SUMMIT_CLOSES_AT") || "2099-01-01T21:00:00-05:00",
} as const;

export type RegistrationStatus =
  | "pending_payment"
  | "entitled"
  | "zoom_requested"
  | "zoom_registered"
  | "zoom_failed";

export type EventRegistrationRow = {
  id: string;
  event_id: string;
  member_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  practice_website_name: string | null;
  country: string | null;
  speaker_question: string | null;
  /** Renamed from rida_member_interest in migration 0065. */
  event_member_interest: string | null;
  utm: Record<string, string>;
  landing_url: string | null;
  status: RegistrationStatus;
  entitled_via: "trial_checkout" | "existing_member" | null;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  entitled_at: string | null;
  zoom_webinar_id: string | null;
  zoom_registrant_id: string | null;
  zoom_join_url: string | null;
  zoom_requested_at: string | null;
  zoom_registered_at: string | null;
  zoom_attempts: number;
  zoom_error: string | null;
  confirmation_sent_at: string | null;
  sheet_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

/** event_registrations is post-typegen → untyped client (same escape hatch as lib/abandoned.ts). */
export function eventsDb(): SupabaseClient {
  return getSupabaseAdmin() as unknown as SupabaseClient;
}

/** Registrations are open only when the summit is switched on and not yet closed. */
export function summitOpen(now: Date = new Date()): boolean {
  if (!SUMMIT_ENABLED) return false;
  return now.getTime() < new Date(SUMMIT.closesAt).getTime();
}

// ---------------------------------------------------------------------
// Sheet hand-off. Same pattern as the sales tracker: an Apps Script web
// app on the registrants spreadsheet accepts a JSON POST and appends
// one row. The shared secret keeps random posts out of the sheet.
//
//   SUMMIT_SHEET_WEBHOOK_URL   Apps Script /exec URL
//   SUMMIT_SHEET_SECRET        must equal SECRET in the Apps Script
// ---------------------------------------------------------------------

/** One sheet row. Column names must match the Registrants sheet headers exactly. */
export function sheetRowFor(reg: EventRegistrationRow): Record<string, string> {
  const utm = reg.utm ?? {};
  return {
    Registration_ID: reg.id,
    Registered_At: reg.entitled_at ?? new Date().toISOString(),
    Event_ID: reg.event_id,
    "First name": reg.first_name,
    "Last Name": reg.last_name,
    "Email address": reg.email,
    Phone: reg.phone ?? "",
    "Practice Website and Name": reg.practice_website_name ?? "",
    Country: reg.country ?? "",
    "Speaker Question": reg.speaker_question ?? "",
    "ASN member interest": reg.event_member_interest ?? "",
    Member_ID: reg.member_id ?? "",
    Entitled_Via: reg.entitled_via ?? "",
    Member_Status: reg.entitled_via === "trial_checkout" ? "trialing" : "active",
    Status: "Pending",
    utm_source: utm.source ?? "",
    utm_medium: utm.medium ?? "",
    utm_campaign: utm.campaign ?? SUMMIT.campaign,
    utm_content: utm.content ?? "",
    utm_term: utm.term ?? "",
  };
}

/**
 * Append the entitled registration to the sheet. Idempotent on our side
 * (sheet_synced_at is set once) and on the Apps Script side (it skips a
 * Registration_ID it has already seen). Never throws: a sheet outage
 * must not break the Stripe webhook — the row stays `entitled` with
 * sheet_synced_at null and the ops alert goes out so a person can add
 * them by hand.
 */
export async function pushRegistrationToSheet(registrationId: string): Promise<boolean> {
  const sb = eventsDb();
  const { data } = await sb.from("event_registrations").select("*").eq("id", registrationId).maybeSingle();
  const reg = data as EventRegistrationRow | null;
  if (!reg || reg.status === "pending_payment") return false;
  if (reg.sheet_synced_at) return true;

  const url = process.env.SUMMIT_SHEET_WEBHOOK_URL;
  const secret = process.env.SUMMIT_SHEET_SECRET;
  const fail = async (why: string) => {
    await sb.from("event_registrations").update({ zoom_error: why.slice(0, 900), zoom_attempts: reg.zoom_attempts + 1 }).eq("id", registrationId);
    try {
      const { sendSummitFailureAlert } = await import("@/lib/email/summitEmails");
      await sendSummitFailureAlert({ registrationId, email: reg.email, name: `${reg.first_name} ${reg.last_name}`.trim(), error: why });
    } catch {
      /* alert is best-effort */
    }
    return false;
  };

  if (!url || !secret) return fail("SUMMIT_SHEET_WEBHOOK_URL / SUMMIT_SHEET_SECRET not configured");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "summit_registration", secret, row: sheetRowFor(reg) }),
      signal: AbortSignal.timeout(10000),
      redirect: "follow", // Apps Script /exec answers with a 302 to the result
    });
    const text = (await res.text().catch(() => "")).trim();
    if (!res.ok || !/^ok/i.test(text)) return fail(`sheet append: ${res.status} ${text.slice(0, 200)}`);
    await sb
      .from("event_registrations")
      .update({ status: "zoom_requested", sheet_synced_at: new Date().toISOString(), zoom_requested_at: new Date().toISOString(), zoom_webinar_id: SUMMIT.zoomWebinarId || null, zoom_error: null })
      .eq("id", registrationId);
    return true;
  } catch (err) {
    return fail(`sheet unreachable: ${err instanceof Error ? err.message.slice(0, 300) : "unknown"}`);
  }
}

/**
 * Mark a registration ENTITLED (payment verified or existing member) and
 * push it to the sheet. Called from the Stripe webhook and the member
 * route. Safe to call repeatedly: only a pending row is moved, so a
 * replayed webhook cannot create a second sheet row.
 */
export async function entitleRegistration(
  registrationId: string,
  via: "trial_checkout" | "existing_member",
  extra: { memberId?: string | null; stripeSessionId?: string | null; stripeSubscriptionId?: string | null } = {},
): Promise<void> {
  await markEntitled(registrationId, via, extra);
  await pushRegistrationToSheet(registrationId);
}

/** Flip a pending row to entitled without touching the sheet (the caller pushes). */
export async function markEntitled(
  registrationId: string,
  via: "trial_checkout" | "existing_member",
  extra: { memberId?: string | null; stripeSessionId?: string | null; stripeSubscriptionId?: string | null } = {},
): Promise<void> {
  const sb = eventsDb();
  await sb
    .from("event_registrations")
    .update({
      status: "entitled",
      entitled_via: via,
      entitled_at: new Date().toISOString(),
      ...(extra.memberId ? { member_id: extra.memberId } : {}),
      ...(extra.stripeSessionId ? { stripe_session_id: extra.stripeSessionId } : {}),
      ...(extra.stripeSubscriptionId ? { stripe_subscription_id: extra.stripeSubscriptionId } : {}),
    })
    .eq("id", registrationId)
    .eq("status", "pending_payment");
}
