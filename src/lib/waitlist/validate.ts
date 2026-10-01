// Members are the only ones who use this waitlist validator. Vendors
// and experts apply inline via the WaitlistSection on /partners and
// /experts respectively, which posts to /api/vendor/signup or
// /api/expert/signup (separate routes from this one). The role field
// here is kept for future use but every signup today resolves to
// "member".
export type WaitlistRole = "member";

export type WaitlistPayload = {
  role: WaitlistRole;
  fullName: string;
  email: string;
  practiceName?: string;
  phone?: string;
  cityState?: string;
  message?: string;
  // ASN form fields (migration 0069): split name, role, locations, challenge, agreement.
  firstName?: string;
  lastName?: string;
  practiceRole?: string;
  locations?: string;
  challenge?: string;
  agreementAccepted?: boolean;
  agreementAcceptedAt?: string | null;
  source?: string;
  utm?: Record<string, string>;
  /** Referral code from `?ref=CODE`. Validated server-side before being
   *  stamped onto the members row. */
  ref?: string;
  // SMS consent — captured verbatim for TCPA/CASL audit purposes.
  smsConsent?: boolean;
  smsConsentText?: string | null;
  smsConsentAt?: string | null;
};

export type ValidationResult =
  | { ok: true; data: WaitlistPayload }
  | { ok: false; error: string; field?: keyof WaitlistPayload };

// ---------------------------------------------------------------------
// Shared input rules. Every route that checks an email, URL, phone or
// promo/referral code imports these instead of keeping its own copy, so
// the limits cannot drift between endpoints.
// ---------------------------------------------------------------------

/** Work-email shape check (length capped separately by MAX_EMAIL_LEN). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Absolute http(s) URL only (what we STORE). */
export const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
/** What people may TYPE: a domain with or without the scheme. */
export const LOOSE_URL_RE = /^(https?:\/\/)?(localhost|([a-z0-9-]+\.)+[a-z]{2,})(:\d+)?([/?#]\S*)?$/i;

/**
 * Turn whatever was typed into a storable URL: trims, adds https:// when
 * the scheme is missing ("www.clinic.com" -> "https://www.clinic.com"),
 * and returns null when it is not a web address at all (javascript:,
 * data:, mailto:, plain words). Empty input returns "".
 */
export function normalizeWebUrl(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  if (!t) return "";
  if (!LOOSE_URL_RE.test(t)) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return URL_RE.test(withScheme) ? withScheme : null;
}
/** Loose phone: leading +, ( or digit, then 4-39 digits/spaces/punctuation. */
export const PHONE_RE = /^[+()\d][\d\s().-]{4,39}$/;
/**
 * Promo and referral codes. Checked BEFORE any `.ilike()` so `%` / `_`
 * wildcards can never reach the query; callers prefer `.eq()` on the
 * upper-cased value.
 */
export const CODE_RE = /^[A-Z0-9-]{4,16}$/i;

export const MAX_EMAIL_LEN = 254;
export const MAX_URL_LEN = 500;
export const MAX_PHONE_LEN = 32;

/** Trimmed string, or "" for anything that is not a string. */
export function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Trimmed string truncated to `max` characters. */
export function asStringMax(v: unknown, max: number): string {
  return asString(v).slice(0, max);
}

/** True when the trimmed string is longer than `max`. */
export function tooLong(v: unknown, max: number): boolean {
  return asString(v).length > max;
}

/** Lower-cased, trimmed email, or null when it fails EMAIL_RE / length. */
export function normalizeEmail(v: unknown): string | null {
  const email = asString(v).toLowerCase();
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) return null;
  return email;
}

/**
 * Upper-cased, trimmed promo/referral code, or null when it fails CODE_RE.
 * Use the result with `.eq("code", …)`; never pass raw input to `.ilike()`.
 */
export function normalizeCode(v: unknown): string | null {
  const code = asString(v).toUpperCase();
  if (!code || !CODE_RE.test(code)) return null;
  return code;
}

export function validateWaitlist(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be JSON." };
  }
  const b = body as Record<string, unknown>;

  // Anything coming in resolves to "member" — vendors don't use the waitlist.
  // We still accept legacy `role: "vendor"` payloads to avoid breaking older
  // clients; they get silently coerced to member.
  void asString(b.role);
  const role: WaitlistRole = "member";

  const fullName = asString(b.fullName);
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Enter your full name.", field: "fullName" };
  }

  const email = asString(b.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
    return { ok: false, error: "Use a valid work email.", field: "email" };
  }

  const practiceName = asString(b.practiceName) || undefined;
  if (practiceName && practiceName.length > 160) {
    return { ok: false, error: "Practice name is too long.", field: "practiceName" };
  }

  const phone = asString(b.phone) || undefined;
  if (phone && phone.length > 32) {
    return { ok: false, error: "Phone number is too long.", field: "phone" };
  }

  const cityState = asString(b.cityState) || undefined;
  if (cityState && cityState.length > 120) {
    return { ok: false, error: "City/state field is too long.", field: "cityState" };
  }

  const message = asString(b.message) || undefined;
  if (message && message.length > 2000) {
    return { ok: false, error: "Message is too long. Keep it under 2000 characters.", field: "message" };
  }

  const firstName = asString(b.firstName).slice(0, 80) || undefined;
  const lastName = asString(b.lastName).slice(0, 80) || undefined;
  const practiceRole = asString(b.practiceRole).slice(0, 120) || undefined;
  const locations = asString(b.locations).slice(0, 20) || undefined;
  const challenge = asString(b.challenge) || undefined;
  if (challenge && challenge.length > 2000) {
    return { ok: false, error: "Keep your challenge under 2000 characters.", field: "challenge" };
  }
  const agreementAccepted = b.agreementAccepted === true;
  const agreementAcceptedAt = agreementAccepted
    ? asString(b.agreementAcceptedAt) || new Date().toISOString()
    : null;

  const source = asString(b.source) || "landing";
  const utmRaw = b.utm;
  const utm =
    utmRaw && typeof utmRaw === "object" && !Array.isArray(utmRaw)
      ? (utmRaw as Record<string, string>)
      : undefined;

  const smsConsent = b.smsConsent === true;
  const smsConsentText = smsConsent ? (asString(b.smsConsentText) || null) : null;
  const smsConsentAt = smsConsent ? (asString(b.smsConsentAt) || new Date().toISOString()) : null;

  // Referral-code shape check (CODE_RE) so the value is safe for a `.eq()`
  // lookup and can never carry an ilike wildcard.
  const refValid = normalizeCode(b.ref) ?? undefined;

  return {
    ok: true,
    data: {
      role,
      fullName,
      email,
      practiceName,
      phone,
      cityState,
      message,
      firstName,
      lastName,
      practiceRole,
      locations,
      challenge,
      agreementAccepted,
      agreementAcceptedAt,
      source,
      utm,
      ref: refValid,
      smsConsent,
      smsConsentText,
      smsConsentAt,
    },
  };
}
