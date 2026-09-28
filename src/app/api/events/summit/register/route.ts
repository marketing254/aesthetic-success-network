import { NextResponse, after } from "next/server";
import { requireMember } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { SUMMIT, markEntitled, pushRegistrationToSheet, eventsDb, summitOpen, type EventRegistrationRow } from "@/lib/events/summit";
import { summitEnabledOr404 } from "@/lib/api/summitGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The EXISTING-MEMBER path for the summit. No checkout, no second
 * subscription: a signed-in member whose subscription is active or
 * trialing is entitled to the event by virtue of that membership.
 *
 *   GET  — who is signed in and where their summit registration stands
 *          (drives the "Already a member?" card on /summit). Never 401s:
 *          "not signed in" is the normal answer on a public page.
 *   POST — register the signed-in, PAID member. Idempotent per email.
 *
 * The entitlement check is done here on the server against the members
 * row; the Zoom registration is then handed to n8n exactly like the
 * paid-checkout path.
 */

const PHONE_RE = /^[+()\d][\d\s().-]{5,39}$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function memberEntitlement(memberId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("members")
    .select("id, email, first_name, last_name, phone, practice_name, subscription_status, stripe_subscription_id")
    .eq("id", memberId)
    .maybeSingle();
  const paid = !!data?.stripe_subscription_id && (data.subscription_status === "active" || data.subscription_status === "trialing");
  return { member: data, paid };
}

export async function GET() {
  const guard = await requireMember();
  if (!guard.ok) return NextResponse.json({ ok: true, signedIn: false });
  const summitGate = summitEnabledOr404();
  if (summitGate) return summitGate;

  try {
    const { member, paid } = await memberEntitlement(guard.memberId);
    const { data } = await eventsDb()
      .from("event_registrations")
      .select("status, zoom_registered_at")
      .eq("event_id", SUMMIT.eventId)
      .eq("email", guard.email)
      .maybeSingle();
    const reg = data as Pick<EventRegistrationRow, "status" | "zoom_registered_at"> | null;
    return NextResponse.json({
      ok: true,
      signedIn: true,
      paid,
      firstName: member?.first_name ?? guard.firstName,
      lastName: member?.last_name ?? "",
      email: guard.email,
      phone: member?.phone ?? "",
      practiceName: member?.practice_name ?? "",
      registration: reg ? { status: reg.status } : null,
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/events/summit/register" });
  }
}

export async function POST(req: Request) {
  const route = "POST /api/events/summit/register";
  const guard = await requireMember();
  if (!guard.ok) return guard.response;
  const summitGate = summitEnabledOr404();
  if (summitGate) return summitGate;

  if (!summitOpen()) {
    return NextResponse.json({ error: "Registration for this summit has closed." }, { status: 410 });
  }

  const rl = await checkRateLimit(`summit-register:${guard.memberId}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError.badRequest();
  }

  const phone = str(body.phone, 40);
  const practiceWebsiteName = str(body.practiceWebsiteName, 200);
  const speakerQuestion = str(body.speakerQuestion, 1000) || null;
  if (!PHONE_RE.test(phone)) return apiError.validation("Please enter a valid mobile phone number.", route);
  if (practiceWebsiteName.length < 2) return apiError.validation("Please enter your practice website and name.", route);

  try {
    const { member, paid } = await memberEntitlement(guard.memberId);
    if (!member) return apiError.forbidden(route);
    if (!paid) {
      // Signed in but unpaid: they need the trial checkout like anyone
      // else. The page sends them to the form; no Zoom registration here.
      return NextResponse.json(
        { error: "Your membership isn't active yet. Start the free trial below to register.", reason: "payment_required" },
        { status: 402 },
      );
    }

    const ev = eventsDb();
    const { data: reg, error } = await ev
      .from("event_registrations")
      .upsert(
        {
          event_id: SUMMIT.eventId,
          member_id: member.id,
          email: member.email.toLowerCase(),
          first_name: member.first_name || guard.firstName || "Member",
          last_name: member.last_name || "",
          phone,
          practice_website_name: practiceWebsiteName,
          speaker_question: speakerQuestion,
          utm: { source: "member_portal", campaign: SUMMIT.campaign },
        },
        { onConflict: "event_id,email" },
      )
      .select("id, status")
      .single();
    if (error || !reg) return serverError(error ?? new Error("upsert failed"), { route });

    if (reg.status === "zoom_registered") {
      return NextResponse.json({ ok: true, status: "zoom_registered", message: "You're already registered. Your Zoom link was emailed to you." });
    }

    // Verified paid member → entitled now; the sheet append (which can take
    // a few seconds at Google's end) runs AFTER the response is sent, so the
    // button answers immediately. markEntitled only moves pending rows, so a
    // duplicate click cannot double-register.
    await markEntitled(reg.id, "existing_member", { memberId: member.id });
    after(() => pushRegistrationToSheet(reg.id));
    return NextResponse.json({ ok: true, status: "entitled" });
  } catch (err) {
    return serverError(err, { route });
  }
}
