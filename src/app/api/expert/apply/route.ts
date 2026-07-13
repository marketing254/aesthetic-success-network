import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, hashIp, isValidEmail, userAgent } from "@/lib/forms/request";
import { notifyTeam, sendExpertConfirmation } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_RE = /^https?:\/\/.+/i;

/**
 * POST /api/expert/apply — expert application (experts page form).
 * Inserts into expert_applications with status "new" for admin review.
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
  const company = asString(b.company);
  const topics = asString(b.topics);
  const bio = asString(b.bio);
  const bookingLink = asString(b.bookingLink);
  const paidCourses = asString(b.paidCourses);
  const sampleLink = asString(b.sampleLink);
  const contentOwnershipConfirmed = b.contentOwnershipConfirmed === true;
  const agreementAccepted = b.agreementAccepted === true;
  const source = asString(b.source) || "experts-page";

  if (firstName.length < 1 || firstName.length > 80 || lastName.length < 1 || lastName.length > 80) {
    return NextResponse.json({ error: "Enter your first and last name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Use a valid email address.", field: "email" }, { status: 400 });
  }
  if (!contentOwnershipConfirmed) {
    return NextResponse.json(
      { error: "Please confirm the content you share is yours to publish." },
      { status: 400 },
    );
  }
  if (!agreementAccepted) {
    return NextResponse.json({ error: "Please agree to the expert terms." }, { status: 400 });
  }
  if (bookingLink && !URL_RE.test(bookingLink)) {
    return NextResponse.json(
      { error: "Booking link must start with http:// or https://.", field: "bookingLink" },
      { status: 400 },
    );
  }
  if (sampleLink && !URL_RE.test(sampleLink)) {
    return NextResponse.json(
      { error: "Sample link must start with http:// or https://.", field: "sampleLink" },
      { status: 400 },
    );
  }
  for (const [val, max] of [
    [phone, 32],
    [company, 160],
    [topics, 400],
    [bio, 3000],
    [bookingLink, 400],
    [sampleLink, 400],
    [paidCourses, 40],
  ] as const) {
    if (val.length > max) {
      return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
    }
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`xp:${ip}:${email}`);
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
    console.error("[expert] supabase not configured:", err);
    return NextResponse.json(
      { error: "Applications are temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("expert_applications")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email,
      phone: phone || null,
      company: company || null,
      topics: topics || null,
      bio: bio || null,
      booking_link: bookingLink || null,
      paid_courses: paidCourses || null,
      sample_link: sampleLink || null,
      content_ownership_confirmed: contentOwnershipConfirmed,
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
      // Already applied — treat as success, never leak internals.
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message:
          "We already have your application. Our team reviews every expert for fit, and we'll be in touch soon.",
      });
    }
    console.error("[expert] insert failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not submit your application. Please try again or email hello@aestheticsuccessnetwork.com.",
      },
      { status: 500 },
    );
  }

  await sendExpertConfirmation(email, firstName);
  await notifyTeam("New expert application", [
    ["Name", `${firstName} ${lastName}`],
    ["Email", email],
    ["Phone", phone],
    ["Company", company],
    ["Topics", topics],
    ["Bio", bio],
    ["Booking link", bookingLink],
    ["Paid courses", paidCourses],
    ["Sample link", sampleLink],
  ]);

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}
