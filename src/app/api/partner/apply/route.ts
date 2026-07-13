import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp, hashIp, isValidEmail, userAgent } from "@/lib/forms/request";
import { notifyTeam, sendPartnerConfirmation } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_RE = /^https?:\/\/.+/i;

/**
 * POST /api/partner/apply — partner application (partners page form).
 * Inserts into partner_applications with status "new" for admin review.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;

  const companyName = asString(b.companyName);
  const website = asString(b.website);
  const contactName = asString(b.contactName);
  const contactRole = asString(b.contactRole);
  const email = asString(b.email).toLowerCase();
  const phone = asString(b.phone);
  const categoryRaw = asString(b.category);
  const categoryOther = asString(b.categoryOther);
  // "Other" + free text → store the specific answer.
  const category = categoryOther ? `Other: ${categoryOther}` : categoryRaw;
  const description = asString(b.description);
  const memberDeal = asString(b.memberDeal);
  const bookingLink = asString(b.bookingLink);
  const billingContact = asString(b.billingContact);
  const agreementAccepted = b.agreementAccepted === true;
  const source = asString(b.source) || "partners-page";

  if (companyName.length < 1 || companyName.length > 160) {
    return NextResponse.json({ error: "Enter your company name.", field: "companyName" }, { status: 400 });
  }
  if (contactName.length < 1 || contactName.length > 120) {
    return NextResponse.json({ error: "Enter a contact name.", field: "contactName" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Use a valid email address.", field: "email" }, { status: 400 });
  }
  if (!agreementAccepted) {
    return NextResponse.json(
      { error: "Please agree to the Partner commitments and fee terms." },
      { status: 400 },
    );
  }
  if (website && !URL_RE.test(website)) {
    return NextResponse.json(
      { error: "Website must start with http:// or https://.", field: "website" },
      { status: 400 },
    );
  }
  if (bookingLink && !URL_RE.test(bookingLink)) {
    return NextResponse.json(
      { error: "Booking link must start with http:// or https://.", field: "bookingLink" },
      { status: 400 },
    );
  }
  for (const [val, max] of [
    [website, 400],
    [contactRole, 120],
    [phone, 32],
    [categoryRaw, 80],
    [categoryOther, 120],
    [description, 3000],
    [memberDeal, 3000],
    [bookingLink, 400],
    [billingContact, 200],
  ] as const) {
    if (val.length > max) {
      return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
    }
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(`pt:${ip}:${email}`);
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
    console.error("[partner] supabase not configured:", err);
    return NextResponse.json(
      { error: "Applications are temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("partner_applications")
    .insert({
      company_name: companyName,
      website: website || null,
      contact_name: contactName,
      contact_role: contactRole || null,
      contact_email: email,
      contact_phone: phone || null,
      category: category || null,
      description: description || null,
      member_deal: memberDeal || null,
      booking_link: bookingLink || null,
      billing_contact: billingContact || null,
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
          "We already have your application. We review every partner for fit, and we'll be in touch soon.",
      });
    }
    console.error("[partner] insert failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not submit your application. Please try again or email hello@aestheticsuccessnetwork.com.",
      },
      { status: 500 },
    );
  }

  await sendPartnerConfirmation(email, contactName);
  await notifyTeam("New partner application", [
    ["Company", companyName],
    ["Website", website],
    ["Contact", `${contactName}${contactRole ? ` (${contactRole})` : ""}`],
    ["Email", email],
    ["Phone", phone],
    ["Category", category],
    ["Description", description],
    ["Member deal", memberDeal],
    ["Booking link", bookingLink],
    ["Billing contact", billingContact],
  ]);

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}
