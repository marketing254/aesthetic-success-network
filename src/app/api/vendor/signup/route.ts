import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { notifySignup } from "@/lib/email/teamNotify";
import { forwardVendorToKit } from "@/lib/kit";
import { clientIp, hashIp } from "@/lib/security/hashIp";
import { insertNotification } from "@/lib/api/notifications";
import { appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/signup
 *
 * Receives a vendor application from the public WaitlistSection
 * embedded on /partners (or the homepage form) and:
 *   1. Validates the minimum required fields
 *   2. Inserts a row into vendor_applications (status='pending_review')
 *   3. Generates a magic-link token + URL (vendors can sign in immediately;
 *      the team reviews their application asynchronously)
 *   4. Logs an email_event row for the magic link
 *   5. Sends the magic-link email via the existing Resend/Gmail transport
 *   6. Returns the application reference id
 *
 * Errors are returned with safe, user-facing messages. Internal errors are
 * logged with a console.error tagged "[vendor:signup]" so they're easy to
 * spot in Vercel logs.
 */

type ApplicationPayload = {
  companyName: string;
  category?: string;
  website?: string;
  description?: string;
  memberOffer?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  secondaryEmail?: string;
  secondaryPhone?: string;
  signatureName?: string;
  signatureTitle?: string;
  agreedToTerms: boolean;
  confirmedAuthority: boolean;
  contactRole?: string;
  alsoExpert?: boolean;
  smsConsent?: boolean;
  smsConsentText?: string | null;
  smsConsentAt?: string | null;
  planId?: string;
  source?: string;
  hotlineEmail?: string;
  calendarLink?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function asString(v: unknown, max: number = Infinity): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) return undefined;
  return trimmed;
}



function validate(body: unknown): { ok: true; data: ApplicationPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const companyName = asString(b.companyName, 200);
  if (!companyName || companyName.length < 2) {
    return { ok: false, error: "Company name is required." };
  }

  const contactName = asString(b.contactName, 200);
  if (!contactName || contactName.length < 2) {
    return { ok: false, error: "Contact name is required." };
  }

  const contactEmail = asString(b.contactEmail, 254)?.toLowerCase();
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "A valid contact email is required." };
  }

  const agreedToTerms = b.agreedToTerms === true;
  const confirmedAuthority = b.confirmedAuthority === true;
  if (!agreedToTerms || !confirmedAuthority) {
    return {
      ok: false,
      error: "Please confirm both agreement checkboxes before submitting.",
    };
  }

  const smsConsent = b.smsConsent === true;
  const smsConsentText = smsConsent ? (asString(b.smsConsentText, 500) ?? null) : null;
  const smsConsentAt = smsConsent ? (asString(b.smsConsentAt, 64) ?? new Date().toISOString()) : null;

  return {
    ok: true,
    data: {
      companyName,
      category: asString(b.category, 120),
      website: asString(b.website, 500),
      description: asString(b.description, 2000),
      memberOffer: asString(b.memberOffer, 500),
      alsoExpert: b.alsoExpert === true,
      contactName,
      contactEmail,
      contactPhone: asString(b.contactPhone, 32),
      secondaryEmail: asString(b.secondaryEmail, 254)?.toLowerCase(),
      secondaryPhone: asString(b.secondaryPhone, 32),
      signatureName: asString(b.signatureName, 200),
      signatureTitle: asString(b.signatureTitle, 200),
      contactRole: asString(b.contactRole, 120),
      agreedToTerms,
      confirmedAuthority,
      smsConsent,
      smsConsentText,
      smsConsentAt,
      planId: asString(b.planId, 60) ?? "founding",
      source: asString(b.source, 60) ?? "vendor-signup-form",
      hotlineEmail: asString(b.hotlineEmail, 254)?.toLowerCase(),
      calendarLink: asString(b.calendarLink, 500),
    },
  };
}

export async function POST(req: Request) {
  // 1. Parse + validate
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = validate(json);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  // Rate-limit by IP + email to suppress signup spam.
  const ip = clientIp(req);
  const rl = await checkRateLimit(`vendor-signup:${ip}:${data.contactEmail}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  // 2. Insert into vendor_applications + vendors at the same time.
  //    Both rows live from day one so the portal has data to show as
  //    soon as the vendor signs in. The vendors row starts in
  //    status='pending_review' and verified=false — team flips them to
  //    approved/verified after review.
  let applicationId: string;
  let vendorId: string;
  try {
    const supabase = getSupabaseAdmin();
    const ipHash = hashIp(clientIp(req)).slice(0, 32);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // Create the vendors row first so the application can FK into it.
    const { data: vendorRow, error: vendorErr } = await supabase
      .from("vendors")
      .insert({
        company_name: data.companyName,
        display_name: data.companyName,
        category: data.category ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone ?? null,
        billing_email: data.contactEmail,
        hotline_email: data.hotlineEmail ?? data.contactEmail,
        calendar_link: data.calendarLink ?? null,
        plan_id: data.planId,
        status: "pending_review",
        verified: false,
        agreement_signed_at: new Date().toISOString(),
        agreement_version: "v1.0",
      })
      .select("id")
      .single();

    if (vendorErr) {
      if (vendorErr.code === "23505") {
        return NextResponse.json(
          {
            error:
              "We already have a partner under this email. Sign in instead, or contact partners@aestheticsuccessnetwork.com.",
          },
          { status: 409 },
        );
      }
      console.error("[vendor:signup] vendors insert failed:", vendorErr);
      return NextResponse.json(
        { error: "Could not save your application. Please try again." },
        { status: 500 },
      );
    }
    vendorId = vendorRow.id;

    const { data: appRow, error: appErr } = await supabase
      .from("vendor_applications")
      .insert({
        company_name: data.companyName,
        category: data.category ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone ?? null,
        secondary_email: data.secondaryEmail ?? null,
        secondary_phone: data.secondaryPhone ?? null,
        signature_name: data.signatureName ?? null,
        signature_title: data.signatureTitle ?? null,
        contact_role: data.contactRole ?? null,
        agreement_version: "v1.0",
        agreed_to_terms: data.agreedToTerms,
        confirmed_authority: data.confirmedAuthority,
        member_offer: data.memberOffer ?? null,
        also_expert: data.alsoExpert ?? false,
        sms_consent_at: data.smsConsentAt ?? null,
        sms_consent_text: data.smsConsentText ?? null,
        plan_id: data.planId,
        source: data.source,
        hotline_email: data.hotlineEmail ?? data.contactEmail,
        calendar_link: data.calendarLink ?? null,
        status: "pending_review",
        vendor_id: vendorId,
        ip_hash: ipHash,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (appErr) {
      console.error("[vendor:signup] application insert failed:", appErr);
      // Best-effort cleanup of orphan vendor row.
      await supabase.from("vendors").delete().eq("id", vendorId);
      return NextResponse.json(
        { error: "Could not save your application. Please try again." },
        { status: 500 },
      );
    }
    applicationId = appRow.id;
  } catch (err) {
    console.error("[vendor:signup] supabase not reachable:", err);
    return NextResponse.json(
      { error: "Application service is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  // 3. Pre-create the Supabase auth user for this email so they can sign in
  //    later via magic link. With shouldCreateUser:false on /vendor/login,
  //    only emails that exist in auth.users can receive a magic link — this
  //    is how we lock the portal to actual applicants.
  //
  //    If the user already exists (e.g. duplicate application attempt), the
  //    createUser call returns an "already registered" error — we ignore it
  //    and continue, since the user can still sign in.
  try {
    const supabase = getSupabaseAdmin();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: data.contactEmail,
      email_confirm: true, // Skip the "confirm your email" step. Magic-link verifies the address anyway.
      user_metadata: {
        application_id: applicationId,
        company: data.companyName,
        user_type: "vendor",
      },
    });
    if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
      console.error("[vendor:signup] auth user create failed:", createErr);
      // Not a hard fail — the application is saved. We'll surface a softer
      // error so the team can fix it manually.
    }
    // Link auth_user_id NOW so the portal middleware's own-row check resolves
    // this vendor on their very first /vendor navigation (before requireVendor
    // ever runs). On "already registered" we page for the existing user id.
    let authUserId = created?.user?.id ?? null;
    if (!authUserId) {
      for (let page = 1; page <= 5; page += 1) {
        const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const u = (list?.users ?? []).find(
          (x) => (x.email ?? "").toLowerCase() === data.contactEmail.toLowerCase(),
        );
        if (u) { authUserId = u.id; break; }
        if ((list?.users ?? []).length < 200) break;
      }
    }
    if (authUserId) {
      await supabase.from("vendors").update({ auth_user_id: authUserId }).eq("id", vendorId);
    }
  } catch (err) {
    console.error("[vendor:signup] auth user create threw:", err);
  }

  // 4. Auto-send the first magic-link email so the applicant can sign in
  //    immediately. The /vendor/applied confirmation page tells them
  //    "we sent you a link" — this is the call that makes that true.
  //    Uses the anon-key client (not service role) because signInWithOtp
  //    isn't an admin method; it triggers Supabase Auth's regular email
  //    flow (subject to the custom SMTP configured in the dashboard).
  let magicLinkSent = false;
  try {
    const origin =
      req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const supabase = await createServerSupabase();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: data.contactEmail,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/vendor&role=vendor`,
        shouldCreateUser: false, // we just pre-created above
      },
    });
    if (otpErr) {
      console.error("[vendor:signup] magic-link send failed:", otpErr);
    } else {
      magicLinkSent = true;
    }
  } catch (err) {
    console.error("[vendor:signup] magic-link send threw:", err);
  }

  // 5. Audit log for the application receipt (best-effort) + admin alert
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("auth_audit").insert({
      event: "vendor_application_submitted",
      email: data.contactEmail,
      user_type: "vendor",
      ip_hash: hashIp(clientIp(req)).slice(0, 32),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      metadata: { application_id: applicationId, source: data.source, magic_link_sent: magicLinkSent },
    });
    await supabase.from("email_events").insert({
      template: "vendor_magic_link",
      recipient: data.contactEmail,
      provider: "supabase_auth",
      status: magicLinkSent ? "queued" : "failed",
      subject: "Sign in to your partner portal",
      metadata: { trigger: "signup", application_id: applicationId },
    });
    // Broadcast to the admin team — show up in everyone's bell.
    await insertNotification(supabase, {
      audience: "admin",
      admin_id: null,
      kind: "new_vendor_application",
      title: `New partner application: ${data.companyName}`,
      body: `${data.contactName} (${data.contactEmail}) just applied.${data.memberOffer ? ` Member offer: "${data.memberOffer}".` : ""}${data.alsoExpert ? " Also an individual expert." : ""} Review when ready.`,
      link: "/admin/vendors?filter=pending_review",
      metadata: { vendor_id: vendorId, application_id: applicationId },
    });
  } catch (err) {
    console.error("[vendor:signup] audit/email log failed:", err);
  }

  // Email the team the full application detail — no admin-panel trip needed.
  void notifySignup({
    role: "partner",
    name: data.contactName,
    email: data.contactEmail,
    adminLink: appUrl("/admin/vendors?filter=pending_review"),
    fields: [
      { label: "Company", value: data.companyName },
      { label: "Category", value: data.category },
      { label: "Website", value: data.website },
      { label: "What they do", value: data.description },
      { label: "Exclusive member offer", value: data.memberOffer },
      { label: "Contact name", value: data.contactName },
      { label: "Contact email", value: data.contactEmail },
      { label: "Contact phone", value: data.contactPhone },
      { label: "Secondary email", value: data.secondaryEmail },
      { label: "Secondary phone", value: data.secondaryPhone },
      { label: "Signer", value: data.signatureName },
      { label: "Signer title", value: data.signatureTitle },
      { label: "Also an individual expert?", value: data.alsoExpert ? "Yes" : "No" },
      { label: "Booking / calendar link", value: data.calendarLink },
      { label: "Agreed to terms", value: data.agreedToTerms ? "Yes" : "No" },
      { label: "Authorized to commit company", value: data.confirmedAuthority ? "Yes" : "No" },
      { label: "SMS consent", value: data.smsConsent ? "Yes" : "No" },
      { label: "Plan", value: data.planId },
      { label: "Source", value: data.source },
    ],
  });

  forwardVendorToKit({
    contactEmail: data.contactEmail,
    contactName: data.contactName,
    companyName: data.companyName,
    category: data.category,
    website: data.website,
    contactPhone: data.contactPhone,
    source: data.source,
    pageUrl: req.headers.get("referer"),
  });

  return NextResponse.json({
    success: true,
    applicationId,
    magicLinkSent,
    status: "pending_review",
    message: magicLinkSent
      ? "Application received. Check your email; we sent a sign-in link to your inbox. Click it to access your partner portal. Our team will review your application within 5 business days."
      : "Application received. Head to the partner portal sign-in page to request a magic-link email. Our team will review your application within 5 business days.",
  });
}
