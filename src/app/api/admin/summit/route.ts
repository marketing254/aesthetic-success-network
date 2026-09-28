import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { SUMMIT, eventsDb, type EventRegistrationRow } from "@/lib/events/summit";
import { summitEnabled } from "@/lib/api/summitGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/summit — every summit form submission, paid or not.
 *
 * The summit page writes an event_registrations row the moment the form
 * is submitted (before Stripe opens), so people who stop at payment are
 * recorded too. This endpoint returns all of them with a plain-English
 * stage, so the admin page can show "started but not paid" next to the
 * people who did pay. Zoom's own result (Registered / join link) lives in
 * the registrants Google Sheet that n8n updates; the database records up
 * to "sent to the sheet". Admin-only.
 */

export type SummitStage = "not_paid" | "paid_sheet_pending" | "paid_sheet_failed" | "queued_for_zoom";

export type SummitAdminRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  practice: string | null;
  speaker_question: string | null;
  created_at: string;
  entitled_at: string | null;
  entitled_via: "trial_checkout" | "existing_member" | null;
  status: EventRegistrationRow["status"];
  stage: SummitStage;
  stage_label: string;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  landing_url: string | null;
  sheet_synced_at: string | null;
  zoom_error: string | null;
  zoom_attempts: number;
  stripe_session_id: string | null;
};

function stageFor(r: EventRegistrationRow): { stage: SummitStage; label: string } {
  if (r.status === "pending_payment") return { stage: "not_paid", label: "Started · not paid" };
  if (r.sheet_synced_at) return { stage: "queued_for_zoom", label: "Paid · sent to Zoom sheet" };
  if (r.zoom_error) return { stage: "paid_sheet_failed", label: "Paid · sheet failed (alert sent)" };
  return { stage: "paid_sheet_pending", label: "Paid · sending to sheet" };
}

function sourceFor(utm: Record<string, string>): string {
  const src = (utm.source ?? "").toLowerCase();
  const campaign = utm.campaign ?? "";
  if (src === "meta" || src === "facebook" || src === "instagram" || src === "fb" || src === "ig") {
    return campaign === SUMMIT.campaign ? "Summit ad (Meta)" : `Meta · ${campaign || "no campaign"}`;
  }
  if (src) return `${utm.source}${campaign ? ` · ${campaign}` : ""}`;
  return "Direct link";
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  // Admin console (not the public summit API): instead of a 404 the page
  // gets `enabled:false` and renders "No event configured" until
  // SUMMIT_ENABLED=true. No query runs while the feature is off.
  const enabled = summitEnabled();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      event: null,
      rows: [],
      counts: { total: 0, not_paid: 0, paid: 0, failed: 0, new_trials: 0, existing_members: 0 },
    });
  }
  try {
    const { data, error } = await eventsDb()
      .from("event_registrations")
      .select("*")
      .eq("event_id", SUMMIT.eventId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;

    const rows: SummitAdminRow[] = ((data ?? []) as EventRegistrationRow[]).map((r) => {
      const utm = (r.utm ?? {}) as Record<string, string>;
      const { stage, label } = stageFor(r);
      return {
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        practice: r.practice_website_name,
        speaker_question: r.speaker_question,
        created_at: r.created_at,
        entitled_at: r.entitled_at,
        entitled_via: r.entitled_via,
        status: r.status,
        stage,
        stage_label: label,
        source: sourceFor(utm),
        utm_source: utm.source ?? null,
        utm_medium: utm.medium ?? null,
        utm_campaign: utm.campaign ?? null,
        utm_content: utm.content ?? null,
        landing_url: r.landing_url,
        sheet_synced_at: r.sheet_synced_at,
        zoom_error: r.zoom_error,
        zoom_attempts: r.zoom_attempts ?? 0,
        stripe_session_id: r.stripe_session_id,
      };
    });

    const counts = {
      total: rows.length,
      not_paid: rows.filter((r) => r.stage === "not_paid").length,
      paid: rows.filter((r) => r.stage !== "not_paid").length,
      failed: rows.filter((r) => r.stage === "paid_sheet_failed").length,
      new_trials: rows.filter((r) => r.entitled_via === "trial_checkout").length,
      existing_members: rows.filter((r) => r.entitled_via === "existing_member").length,
    };

    return NextResponse.json({
      enabled: true,
      rows,
      counts,
      event: { id: SUMMIT.eventId, title: SUMMIT.title, date: SUMMIT.dateLabel, webinarId: SUMMIT.zoomWebinarId },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/summit" });
  }
}
