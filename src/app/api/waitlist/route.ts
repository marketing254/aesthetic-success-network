import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, hashIp, isValidEmail, userAgent } from "@/lib/forms/request";
import { notifyTeam, sendWaitlistConfirmation } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/waitlist — founding waitlist signup (home page form).
 * Inserts into waitlist_signups. Duplicate email → friendly success.
 * GET  /api/waitlist — public counts (waitlist_counts view).
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;

  const firstName = asString(b.firstName);
  const lastName = asString(b.lastName);
  const email = asString(b.email).toLowerCase();
  const phone = asString(b.phone);
  const practiceName = asString(b.practiceName);
  const roleLabelRaw = asString(b.roleLabel);
  const roleLabelOther = asString(b.roleLabelOther);
  // "Other aesthetic practice" + free text → store the specific answer.
  const roleLabel = roleLabelOther ? `Other: ${roleLabelOther}` : roleLabelRaw;
  const locations = asString(b.locations);
  const challenge = asString(b.challenge);
  const agreementAccepted = b.agreementAccepted === true;
  const source = asString(b.source) || "landing";

  if (firstName.length < 1 || firstName.length > 80) {
    return NextResponse.json({ error: "Enter your first name.", field: "firstName" }, { status: 400 });
  }
  if (lastName.length < 1 || lastName.length > 80) {
    return NextResponse.json({ error: "Enter your last name.", field: "lastName" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Use a valid work email.", field: "email" }, { status: 400 });
  }
  if (phone.length > 32) {
    return NextResponse.json({ error: "Phone number is too long.", field: "phone" }, { status: 400 });
  }
  if (practiceName.length > 160) {
    return NextResponse.json({ error: "Practice name is too long.", field: "practiceName" }, { status: 400 });
  }
  if (roleLabelRaw.length > 80 || roleLabelOther.length > 120 || locations.length > 20) {
    return NextResponse.json({ error: "Invalid selection." }, { status: 400 });
  }
  if (challenge.length > 2000) {
    return NextResponse.json(
      { error: "Keep your challenge under 2000 characters.", field: "challenge" },
      { status: 400 },
    );
  }
  if (!agreementAccepted) {
    return NextResponse.json(
      { error: "Please agree to the Member Agreement to join the waitlist." },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`wl:${ip}:${email}`);
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

  const { data, error } = await supabase
    .from("waitlist_signups")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      practice_name: practiceName || null,
      practice_role: roleLabel || null,
      locations: locations || null,
      challenge: challenge || null,
      agreement_accepted: agreementAccepted,
      agreement_accepted_at: new Date().toISOString(),
      source,
      ip_hash: hashIp(ip),
      user_agent: userAgent(req),
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message:
          "You're already on the list. We'll be in touch as founding spots open, so keep an eye on your inbox.",
      });
    }
    console.error("[waitlist] insert failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not save your spot. Please try again or email hello@aestheticsuccessnetwork.com.",
      },
      { status: 500 },
    );
  }

  await sendWaitlistConfirmation(email, firstName, data.id, data.created_at);
  await notifyTeam("New waitlist signup", [
    ["Name", `${firstName} ${lastName}`],
    ["Email", email],
    ["Mobile", phone],
    ["Practice", practiceName],
    ["Role", roleLabel],
    ["Locations", locations],
    ["Challenge", challenge],
  ]);

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("waitlist_counts").select("*").single();
    if (error) throw error;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("[waitlist] count read failed:", err);
    return NextResponse.json({ total: 0, last_24h: 0 }, { status: 200 });
  }
}
