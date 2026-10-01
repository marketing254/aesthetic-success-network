import { NextResponse } from "next/server";
import { MEMBER_LAUNCH_ENABLED, MEMBER_LAUNCH_MESSAGE } from "@/lib/launch";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateWaitlist } from "@/lib/waitlist/validate";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { sendWaitlistConfirmationEmail } from "@/lib/waitlist/confirmationEmail";
import { forwardWaitlistToKit } from "@/lib/kit";
import type { WaitlistPayload } from "@/lib/waitlist/validate";
import { clientIp, hashIp } from "@/lib/security/hashIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


async function sendConfirmation(signup: WaitlistPayload, referenceId: string, submittedAt: string) {
  try {
    const result = await sendWaitlistConfirmationEmail({ signup, referenceId, submittedAt });
    if (!result.sent) {
      console.info("[waitlist] confirmation email not sent", {
        reason: result.reason,
        role: signup.role,
        referenceId,
      });
    }
  } catch (err) {
    console.error("[waitlist] confirmation email failed:", err);
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = validateWaitlist(json);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: 400 });
  }

  // Pull the form's extra context out of utm so we can forward it to Kit.
  // The waitlist UI bundles locations + challenge into utm to keep the
  // validate schema lean. "other" free-text wins when present.
  const utm = result.data.utm ?? {};
  const numberOfLocations = utm.locations ?? null;
  const biggestChallenge =
    (utm.biggest_challenge_other && utm.biggest_challenge_other.trim()) ||
    utm.biggest_challenge ||
    null;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`${ip}:${result.data.email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[waitlist] supabase not configured:", err);
    return NextResponse.json(
      { error: "Waitlist temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const payload = {
    role: result.data.role,
    email: result.data.email,
    full_name: result.data.fullName,
    practice_name: result.data.practiceName ?? null,
    phone: result.data.phone ?? null,
    city_state: result.data.cityState ?? null,
    message: result.data.message ?? null,
    first_name: result.data.firstName ?? null,
    last_name: result.data.lastName ?? null,
    practice_role: result.data.practiceRole ?? null,
    locations: result.data.locations ?? null,
    challenge: result.data.challenge ?? null,
    agreement_accepted: result.data.agreementAccepted ?? false,
    agreement_accepted_at: result.data.agreementAcceptedAt ?? null,
    source: result.data.source ?? "landing",
    utm: result.data.utm ?? null,
    ip_hash: hashIp(ip).slice(0, 32),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    sms_consent_at: result.data.smsConsentAt ?? null,
    sms_consent_text: result.data.smsConsentText ?? null,
  };

  const { data, error } = await supabase
    .from("waitlist_signups")
    .insert(payload)
    .select("id, role, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          message: "You are already on the list. We will be in touch as soon as we open the doors.",
        },
        { status: 200 },
      );
    }
    console.error("[waitlist] insert failed:", error);
    return NextResponse.json(
      { error: "Could not save your spot. Please try again or email hello@aestheticsuccessnetwork.com." },
      { status: 500 },
    );
  }

  if (MEMBER_LAUNCH_ENABLED) await sendConfirmation(result.data, data.id, data.created_at);

  forwardWaitlistToKit({
    email: result.data.email,
    fullName: result.data.fullName,
    practiceName: result.data.practiceName,
    phone: result.data.phone,
    numberOfLocations,
    biggestChallenge,
    source: result.data.source,
    pageUrl: req.headers.get("referer"),
  });

  return NextResponse.json({ ok: true, id: data.id, role: data.role, createdAt: data.created_at });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("waitlist_counts")
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[waitlist] count read failed:", err);
    return NextResponse.json(
      { total: 0, members: 0, last_24h: 0 },
      { status: 200 },
    );
  }
}
