import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, hashIp, isValidEmail, userAgent } from "@/lib/forms/request";
import { notifyTeam, sendExpertConfirmation, sendPartnerConfirmation } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_RE = /^https?:\/\/.+/i;

/**
 * POST /api/invite/[code]/accept — PUBLIC (the code is the credential).
 * The personalized-invite counterpart to /api/expert/apply and
 * /api/partner/apply: same destination tables, same "new" review status
 * (an invite is a head start into the normal queue, not a different
 * track), plus it marks the invite_links row consumed. `kind` comes
 * from the invite row itself, never from the client.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;

  const rl = checkRateLimit(`invite-accept:${clientIp(req)}:${code}`);
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
    console.error("[invite:accept] supabase not configured:", err);
    return NextResponse.json({ error: "Applications are temporarily unavailable." }, { status: 503 });
  }

  const { data: invite } = await supabase
    .from("invite_links")
    .select("id, kind, status, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  }
  if (invite.status === "revoked" || new Date(invite.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "This invite has expired or been revoked." }, { status: 410 });
  }

  const ip = clientIp(req);
  const ua = userAgent(req);

  if (invite.kind === "expert") {
    const firstName = asString(b.firstName);
    const lastName = asString(b.lastName);
    const email = asString(b.email).toLowerCase();
    const agreementAccepted = b.agreementAccepted === true;
    const contentOwnershipConfirmed = b.contentOwnershipConfirmed === true;

    if (firstName.length < 1 || lastName.length < 1) {
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
    const bookingLink = asString(b.bookingLink);
    const sampleLink = asString(b.sampleLink);
    if (bookingLink && !URL_RE.test(bookingLink)) {
      return NextResponse.json({ error: "Booking link must start with http:// or https://." }, { status: 400 });
    }
    if (sampleLink && !URL_RE.test(sampleLink)) {
      return NextResponse.json({ error: "Sample link must start with http:// or https://." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("expert_applications")
      .insert({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        email,
        phone: asString(b.phone) || null,
        company: asString(b.company) || null,
        topics: asString(b.topics) || null,
        bio: asString(b.bio) || null,
        booking_link: bookingLink || null,
        paid_courses: asString(b.paidCourses) || null,
        sample_link: sampleLink || null,
        content_ownership_confirmed: contentOwnershipConfirmed,
        agreement_accepted: agreementAccepted,
        agreement_accepted_at: new Date().toISOString(),
        source: "invite-link",
        ip_hash: hashIp(ip),
        user_agent: ua,
      })
      .select("id, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          message: "We already have your application. Our team reviews every expert for fit.",
        });
      }
      console.error("[invite:accept] expert insert failed:", error);
      return NextResponse.json({ error: "Could not submit your application. Please try again." }, { status: 500 });
    }

    await supabase
      .from("invite_links")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), expert_application_id: data.id })
      .eq("id", invite.id);

    await sendExpertConfirmation(email, firstName);
    void notifyTeam("New expert application (invite link)", [
      ["Name", `${firstName} ${lastName}`],
      ["Email", email],
    ]);

    return NextResponse.json({ ok: true, id: data.id });
  }

  // kind === "partner"
  const companyName = asString(b.companyName);
  const contactName = asString(b.contactName);
  const email = asString(b.email).toLowerCase();
  const agreementAccepted = b.agreementAccepted === true;

  if (companyName.length < 1) {
    return NextResponse.json({ error: "Enter your company name." }, { status: 400 });
  }
  if (contactName.length < 1) {
    return NextResponse.json({ error: "Enter a contact name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Use a valid email address.", field: "email" }, { status: 400 });
  }
  if (!agreementAccepted) {
    return NextResponse.json({ error: "Please agree to the Partner commitments and fee terms." }, { status: 400 });
  }
  const website = asString(b.website);
  const bookingLink = asString(b.bookingLink);
  if (website && !URL_RE.test(website)) {
    return NextResponse.json({ error: "Website must start with http:// or https://." }, { status: 400 });
  }
  if (bookingLink && !URL_RE.test(bookingLink)) {
    return NextResponse.json({ error: "Booking link must start with http:// or https://." }, { status: 400 });
  }

  const categoryOther = asString(b.categoryOther);
  const category = categoryOther ? `Other: ${categoryOther}` : asString(b.category);

  const { data, error } = await supabase
    .from("partner_applications")
    .insert({
      company_name: companyName,
      website: website || null,
      contact_name: contactName,
      contact_role: asString(b.contactRole) || null,
      contact_email: email,
      contact_phone: asString(b.phone) || null,
      category: category || null,
      description: asString(b.description) || null,
      member_deal: asString(b.memberDeal) || null,
      booking_link: bookingLink || null,
      billing_contact: asString(b.billingContact) || null,
      agreement_accepted: agreementAccepted,
      agreement_accepted_at: new Date().toISOString(),
      source: "invite-link",
      ip_hash: hashIp(ip),
      user_agent: ua,
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "We already have your application. We review every partner for fit.",
      });
    }
    console.error("[invite:accept] partner insert failed:", error);
    return NextResponse.json({ error: "Could not submit your application. Please try again." }, { status: 500 });
  }

  await supabase
    .from("invite_links")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), partner_application_id: data.id })
    .eq("id", invite.id);

  await sendPartnerConfirmation(email, contactName);
  void notifyTeam("New partner application (invite link)", [
    ["Company", companyName],
    ["Email", email],
  ]);

  return NextResponse.json({ ok: true, id: data.id });
}
