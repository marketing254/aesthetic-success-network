import { isJobRole, type JobRole } from "./constants";

/**
 * Validator for the free job-seeker registration.
 *
 * Kept deliberately short. Every extra required field on this form is a
 * candidate who closes the tab, and the whole reason the form exists is
 * to capture the person: an email we hold beats a perfect profile we
 * never get. Name and email are required; everything else is optional
 * and asked because it makes the captured list worth something.
 */

export type SeekerInput = {
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  job_role_interest: JobRole | null;
};

export type SeekerValidationResult =
  | { ok: true; value: SeekerInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d][\d\s().-]{4,39}$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function splitName(fullName: string): { first: string; last: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: fullName.trim(), last: null };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export function validateSeekerInput(body: Record<string, unknown>): SeekerValidationResult {
  const fullName = str(body.full_name);
  if (fullName.length < 2 || fullName.length > 160) {
    return { ok: false, error: "Add your name." };
  }
  const { first, last } = splitName(fullName);

  const email = str(body.email).toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address: your sign-in code goes there." };
  }

  const phone = str(body.phone) || null;
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: "That phone number doesn't look right." };
  }

  const city = str(body.city) || null;
  if (city && city.length > 160) {
    return { ok: false, error: "City must be 160 characters or fewer." };
  }

  // Optional, but it is the single most useful thing on the captured
  // list: it turns "3,000 job seekers" into "412 hygienists in Texas",
  // which is a segment someone can actually email.
  const roleRaw = str(body.job_role_interest);
  let roleInterest: JobRole | null = null;
  if (roleRaw) {
    if (!isJobRole(roleRaw)) {
      return { ok: false, error: "Choose a role from the list." };
    }
    roleInterest = roleRaw;
  }

  return {
    ok: true,
    value: {
      first_name: first,
      last_name: last,
      email,
      phone,
      city,
      job_role_interest: roleInterest,
    },
  };
}
