import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateExpertApplication } from "@/lib/expert/validate";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { sendExpertConfirmationEmail } from "@/lib/waitlist/confirmationEmail";
import { notifySignup } from "@/lib/email/teamNotify";
import type { ExpertApplicationPayload } from "@/lib/expert/validate";
import { clientIp, hashIp } from "@/lib/security/hashIp";
import { appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


async function sendConfirmation(
  application: ExpertApplicationPayload,
  referenceId: string,
  submittedAt: string,
) {
  try {
    const result = await sendExpertConfirmationEmail({
      application,
      referenceId,
      submittedAt,
    });
    if (!result.sent) {
      console.info("[expert] confirmation email not sent", {
        reason: result.reason,
        referenceId,
      });
    }
  } catch (err) {
    console.error("[expert] confirmation email failed:", err);
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = validateExpertApplication(json);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit(`expert:${ip}:${result.data.email}`);
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
      { error: "Application service temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  const payload = {
    email: result.data.email,
    full_name: result.data.fullName,
    phone: result.data.phone ?? null,
    company_name: result.data.companyName ?? null,
    specialty: result.data.specialty,
    topics: result.data.topics ?? null,
    first_name: result.data.firstName ?? null,
    last_name: result.data.lastName ?? null,
    bio: result.data.bio ?? null,
    sample_link: result.data.sampleLink ?? null,
    paid_courses: result.data.paidCourses ?? null,
    content_ownership_confirmed: result.data.contentOwnershipConfirmed ?? false,
    website: result.data.website ?? null,
    booking_link: result.data.bookingLink ?? null,
    source: result.data.source ?? "landing",
    utm: result.data.utm ?? null,
    ip_hash: hashIp(ip).slice(0, 32),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    agreement_accepted: result.data.agreementAccepted,
    agreement_accepted_at: result.data.agreementAcceptedAt ?? null,
    also_partner: result.data.alsoPartner ?? false,
    company_offer: result.data.companyOffer ?? null,
    considered_founding: result.data.consideredFounding ?? false,
    sms_consent: result.data.smsConsent ?? false,
    sms_consent_text: result.data.smsConsentText ?? null,
    sms_consent_at: result.data.smsConsentAt ?? null,
  };

  const { data, error } = await supabase
    .from("expert_applications")
    .insert(payload)
    .select("id, created_at")
    .single();

  if (error) {
    // Duplicate email — treat as success so the applicant sees a
    // friendly confirmation instead of an error. Admin sees the prior
    // application row.
    if (error.code === "23505") {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          message:
            "We already have your application. The team will be in touch as we work through reviews.",
        },
        { status: 200 },
      );
    }
    console.error("[expert] insert failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not save your application. Please try again or email hello@aestheticsuccessnetwork.com.",
      },
      { status: 500 },
    );
  }

  await sendConfirmation(result.data, data.id, data.created_at);

  // Alert the team — full applicant detail, no admin-panel trip needed.
  void notifySignup({
    role: "expert",
    name: result.data.fullName,
    email: result.data.email,
    submittedAt: data.created_at,
    adminLink: appUrl("/admin/experts?filter=new"),
    fields: [
      { label: "Full name", value: result.data.fullName },
      { label: "Email", value: result.data.email },
      { label: "Phone", value: result.data.phone },
      { label: "Teaches / coaches on", value: result.data.specialty },
      { label: "Topics they'd record", value: result.data.topics },
      { label: "Website", value: result.data.website },
      { label: "Booking link", value: result.data.bookingLink },
      { label: "Also list company as partner?", value: result.data.alsoPartner ? "Yes" : "No" },
      { label: "Company name", value: result.data.companyName },
      { label: "Company offer to practices", value: result.data.companyOffer },
      { label: "Expert Agreement accepted", value: result.data.agreementAccepted ? "Yes" : "No" },
      { label: "Consider as Founding Expert", value: result.data.consideredFounding ? "Yes" : "No" },
      { label: "SMS consent", value: result.data.smsConsent ? "Yes" : "No" },
      { label: "Source", value: result.data.source ?? "landing" },
    ],
  });

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}
