import { CV_ACCEPTED_EXT, CV_ACCEPTED_MIME, CV_MAX_BYTES } from "./constants";

/**
 * Validator for a job application.
 *
 * Same contract as validateJobInput: one validator shared by every write
 * path, mirroring the CHECK constraints in 0063_job_applications.sql. The
 * DB is the real guarantee; this exists so the applicant gets a sentence
 * they can act on instead of a Postgres constraint name.
 *
 * Note what is NOT validated here: the CV file itself. A File/Blob can't
 * be checked in a shared module that both the browser form and the route
 * import, so validateCvFile() below takes the already-extracted name/size/type
 * and is called from both sides.
 */

export type ApplicationInput = {
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  copy_to_applicant: boolean;
};

export type ApplicationValidationResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Deliberately loose. International formats vary wildly and a practice
// would rather receive "+94 77 123 4567" than lose the applicant to a
// regex that only understands US numbers.
const PHONE_RE = /^[+()\d][\d\s().-]{4,39}$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateApplicationInput(
  body: Record<string, unknown>,
): ApplicationValidationResult {
  const fullName = str(body.full_name);
  if (fullName.length < 2 || fullName.length > 160) {
    return { ok: false, error: "Add your full name." };
  }

  const email = str(body.email).toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "That email doesn't look right: the practice replies to this address." };
  }

  // Optional, but say why it's worth giving. Most aesthetic practices phone
  // first, so an applicant who leaves it blank is quietly worse off.
  const phone = str(body.phone) || null;
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: "That phone number doesn't look right." };
  }

  const message = str(body.message) || null;
  if (message && message.length > 4000) {
    return { ok: false, error: "Your message must be 4000 characters or fewer." };
  }

  return {
    ok: true,
    value: {
      full_name: fullName,
      email,
      phone,
      message,
      copy_to_applicant: body.copy_to_applicant === true,
    },
  };
}

export type CvCheck = { ok: true } | { ok: false; error: string };

/**
 * Check an uploaded CV by name, size and reported type.
 *
 * Extension AND mime are both checked, and neither is trusted alone: the
 * browser's reported type is client-supplied and easy to spoof, while an
 * extension alone would let through a renamed executable. Requiring both
 * to be on the list is not real content sniffing, but it is the level of
 * care appropriate for a file that only ever gets emailed as an
 * attachment and served from a private bucket via signed URL.
 */
export function validateCvFile(file: {
  name: string;
  size: number;
  type: string;
}): CvCheck {
  if (!file.name || file.size <= 0) {
    return { ok: false, error: "That file looks empty: try attaching it again." };
  }
  if (file.size > CV_MAX_BYTES) {
    return { ok: false, error: "Your CV must be under 10MB." };
  }
  const lower = file.name.toLowerCase();
  const extOk = CV_ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
  const mimeOk = (CV_ACCEPTED_MIME as readonly string[]).includes(file.type);
  if (!extOk || !mimeOk) {
    return { ok: false, error: "Attach your CV as a PDF or Word document." };
  }
  if (file.name.length > 255) {
    return { ok: false, error: "That filename is too long: rename it and try again." };
  }
  return { ok: true };
}

/**
 * Strip a user-supplied filename down to something safe to put in a
 * storage path and an email attachment header.
 *
 * The stored object name is generated from ids, never from this: but
 * the original filename is kept on the row and re-used as the attachment
 * name, so it still has to be harmless. Path separators and control
 * characters go; everything else collapses to a conservative set.
 */
export function safeCvFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "cv";
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 120);
  return cleaned || "cv.pdf";
}

/** File extension for the stored object, lowercase, dot included. */
export function cvExtension(name: string): string {
  const lower = name.toLowerCase();
  const match = CV_ACCEPTED_EXT.find((ext) => lower.endsWith(ext));
  return match ?? ".pdf";
}
