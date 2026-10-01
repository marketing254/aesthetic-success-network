import { EMAIL_RE, MAX_EMAIL_LEN, asString, normalizeWebUrl } from "@/lib/waitlist/validate";

// Expert applications are reviewed by the ASN team, not auto-approved.
// Validation here mirrors the field set in WaitlistSection's expert
// branch, plus the consent audit shape used by the partner flow.

export type ExpertApplicationPayload = {
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  // Cross-role: expert who also wants their company listed as a partner.
  alsoPartner?: boolean;
  companyOffer?: string;
  specialty: string;
  topics?: string;
  // ASN application fields (migration 0069).
  firstName?: string;
  lastName?: string;
  bio?: string;
  sampleLink?: string;
  paidCourses?: string;
  contentOwnershipConfirmed?: boolean;
  website?: string;
  bookingLink?: string;
  source?: string;
  utm?: Record<string, string>;
  // Required acknowledgement — applicant ticked the binding
  // "I agree to the Expert Agreement" checkbox.
  agreementAccepted: boolean;
  agreementAcceptedAt?: string | null;
  // Optional consent to be reviewed as a Founding Expert.
  consideredFounding?: boolean;
  // Optional SMS opt-in. When checked, store text + timestamp verbatim
  // as TCPA / CASL evidence (matches the home form's pattern).
  smsConsent?: boolean;
  smsConsentText?: string | null;
  smsConsentAt?: string | null;
};

export type ValidationResult =
  | { ok: true; data: ExpertApplicationPayload }
  | { ok: false; error: string; field?: keyof ExpertApplicationPayload };

export function validateExpertApplication(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be JSON." };
  }
  const b = body as Record<string, unknown>;

  const fullName = asString(b.fullName);
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Enter your full name.", field: "fullName" };
  }

  const email = asString(b.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
    return { ok: false, error: "Use a valid work email.", field: "email" };
  }

  const phone = asString(b.phone) || undefined;
  if (phone && phone.length > 32) {
    return { ok: false, error: "Phone number is too long.", field: "phone" };
  }

  const companyName = asString(b.companyName) || undefined;
  if (companyName && companyName.length > 160) {
    return { ok: false, error: "Company name is too long.", field: "companyName" };
  }

  const topics = asString(b.topics) || undefined;
  if (topics && topics.length > 2000) {
    return {
      ok: false,
      error: "Topics list is too long. Keep it under 2000 characters.",
      field: "topics",
    };
  }

  // The ASN form asks for topics, not a separate specialty line. When no
  // specialty is sent, the topics line stands in for it.
  const specialty = (asString(b.specialty) || topics || "").slice(0, 240);
  if (specialty.length < 2) {
    return {
      ok: false,
      error: "Tell us your topics or areas of expertise.",
      field: "topics",
    };
  }

  const firstName = asString(b.firstName).slice(0, 80) || undefined;
  const lastName = asString(b.lastName).slice(0, 80) || undefined;
  const bio = asString(b.bio) || undefined;
  if (bio && bio.length > 2000) {
    return { ok: false, error: "Keep your bio under 2000 characters.", field: "bio" };
  }
  const sampleLinkRaw = asString(b.sampleLink);
  const sampleLinkNorm = normalizeWebUrl(sampleLinkRaw);
  if (sampleLinkRaw && (sampleLinkRaw.length > 500 || !sampleLinkNorm)) {
    return { ok: false, error: "Enter a web address for your sample link, e.g. www.yoursite.com/talk.", field: "sampleLink" };
  }
  const sampleLink = sampleLinkNorm || undefined;
  const paidCourses = asString(b.paidCourses).slice(0, 40) || undefined;
  const contentOwnershipConfirmed = b.contentOwnershipConfirmed === true;

  const websiteRaw = asString(b.website);
  const websiteNorm = normalizeWebUrl(websiteRaw);
  if (websiteRaw && (websiteRaw.length > 240 || !websiteNorm)) {
    return { ok: false, error: "Enter a web address for your website, e.g. www.yoursite.com.", field: "website" };
  }
  const website = websiteNorm || undefined;

  const bookingRaw = asString(b.bookingLink);
  const bookingNorm = normalizeWebUrl(bookingRaw);
  if (bookingRaw && (bookingRaw.length > 240 || !bookingNorm)) {
    return { ok: false, error: "Enter a web address for your booking link, e.g. calendly.com/you.", field: "bookingLink" };
  }
  const bookingLink = bookingNorm || undefined;

  const source = asString(b.source) || "landing";
  const utmRaw = b.utm;
  const utm =
    utmRaw && typeof utmRaw === "object" && !Array.isArray(utmRaw)
      ? (utmRaw as Record<string, string>)
      : undefined;

  const agreementAccepted = b.agreementAccepted === true;
  if (!agreementAccepted) {
    return {
      ok: false,
      error: "Please read and agree to the Expert Agreement.",
      field: "agreementAccepted",
    };
  }
  const agreementAcceptedAt =
    asString(b.agreementAcceptedAt) || new Date().toISOString();

  const alsoPartner = b.alsoPartner === true;
  const companyOffer = asString(b.companyOffer) || undefined;
  const consideredFounding = b.consideredFounding === true;

  const smsConsent = b.smsConsent === true;
  const smsConsentText = smsConsent ? asString(b.smsConsentText) || null : null;
  const smsConsentAt = smsConsent
    ? asString(b.smsConsentAt) || new Date().toISOString()
    : null;

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone,
      companyName,
      alsoPartner,
      companyOffer,
      specialty,
      topics,
      firstName,
      lastName,
      bio,
      sampleLink,
      paidCourses,
      contentOwnershipConfirmed,
      website,
      bookingLink,
      source,
      utm,
      agreementAccepted,
      agreementAcceptedAt,
      consideredFounding,
      smsConsent,
      smsConsentText,
      smsConsentAt,
    },
  };
}
