/**
 * The fixed vocabularies behind the job board.
 *
 * These mirror the enums in supabase/migrations/0061_job_board.sql exactly.
 * If you add a value here you MUST add it there too, or the insert fails at
 * the DB with a cryptic enum error. That coupling is deliberate: the spec's
 * reason for a fixed role list is that free text fragments the filters
 * instantly, and the only way to hold that line is to make it structural.
 *
 * Safe to import from client components — no server-only imports here.
 */

export const JOB_ROLES = [
  { value: "injector_rn_np", label: "Nurse injector (RN/NP)" },
  { value: "physician_assistant", label: "Physician assistant" },
  { value: "aesthetician", label: "Aesthetician / esthetician" },
  { value: "laser_technician", label: "Laser technician" },
  { value: "medical_director", label: "Medical director" },
  { value: "practice_manager", label: "Practice / clinic manager" },
  { value: "patient_coordinator", label: "Patient coordinator" },
  { value: "front_desk", label: "Front desk" },
  { value: "marketing_coordinator", label: "Marketing coordinator" },
  { value: "other", label: "Other" },
] as const;

export type JobRole = (typeof JOB_ROLES)[number]["value"];

export const JOB_EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "temporary", label: "Temporary or locum" },
  { value: "contract", label: "Contract" },
] as const;

export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number]["value"];

export const JOB_WORKPLACES = [
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export type JobWorkplace = (typeof JOB_WORKPLACES)[number]["value"];

export const JOB_PAY_UNITS = [
  { value: "hour", label: "per hour" },
  { value: "day", label: "per day" },
  { value: "year", label: "per year" },
] as const;

export type JobPayUnit = (typeof JOB_PAY_UNITS)[number]["value"];

export type JobStatus =
  | "draft"
  | "pending_review"
  | "live"
  | "rejected"
  | "expired"
  | "filled";

/** Days a post stays live before it auto-expires. */
export const JOB_LIVE_DAYS = 30;

/** Day the "renew in one click" email goes out, counted from approval. */
export const JOB_EXPIRY_WARNING_DAY = 25;

const ROLE_LABELS = new Map<string, string>(JOB_ROLES.map((r) => [r.value, r.label]));
const EMPLOYMENT_LABELS = new Map<string, string>(
  JOB_EMPLOYMENT_TYPES.map((t) => [t.value, t.label]),
);
const WORKPLACE_LABELS = new Map<string, string>(JOB_WORKPLACES.map((w) => [w.value, w.label]));
const PAY_UNIT_LABELS = new Map<string, string>(JOB_PAY_UNITS.map((u) => [u.value, u.label]));

/**
 * Display label for a role. `roleOther` is only consulted for the "other"
 * value — a stale free-text field on a post whose role was later changed
 * shouldn't leak into the listing.
 */
export function roleLabel(role: string, roleOther?: string | null): string {
  if (role === "other" && roleOther) return roleOther;
  return ROLE_LABELS.get(role) ?? "Aesthetic role";
}

export function employmentLabel(type: string): string {
  return EMPLOYMENT_LABELS.get(type) ?? type;
}

export function workplaceLabel(workplace: string): string {
  return WORKPLACE_LABELS.get(workplace) ?? workplace;
}

export function payUnitLabel(unit: string): string {
  return PAY_UNIT_LABELS.get(unit) ?? unit;
}

export function isJobRole(v: unknown): v is JobRole {
  return typeof v === "string" && ROLE_LABELS.has(v);
}

export function isEmploymentType(v: unknown): v is JobEmploymentType {
  return typeof v === "string" && EMPLOYMENT_LABELS.has(v);
}

export function isWorkplace(v: unknown): v is JobWorkplace {
  return typeof v === "string" && WORKPLACE_LABELS.has(v);
}

export function isPayUnit(v: unknown): v is JobPayUnit {
  return typeof v === "string" && PAY_UNIT_LABELS.has(v);
}

// =====================================================================
// Phase 2 — banner posts and applications.
// Same coupling rule as everything above: these mirror the enums in
// 0063_job_applications.sql and adding a value in one place without the
// other fails at the DB.
// =====================================================================

/**
 * How the member chose to write the post.
 *
 * `banner` does NOT mean "no text". The summary and every filterable
 * field are still required — see JOB_POST_FORMATS[].note and the SEO
 * comment in the migration. What the banner replaces is the long
 * rich-text description, which is the slow part of posting.
 */
export const JOB_POST_FORMATS = [
  {
    value: "detailed",
    label: "Write it out",
    minutes: "5–10 minutes",
    note: "You type the full job description. Best if you want the ad to read exactly your way.",
  },
  {
    value: "banner",
    label: "Upload a banner",
    minutes: "2–3 minutes",
    note: "Make a graphic in ChatGPT (or anything else), upload it, and fill in a few short fields.",
  },
] as const;

export type JobPostFormat = (typeof JOB_POST_FORMATS)[number]["value"];

export const JOB_APPLICATION_STATUSES = [
  { value: "submitted", label: "Submitted", applicantLabel: "Submitted", tone: "neutral" },
  { value: "viewed", label: "Viewed", applicantLabel: "Viewed by the practice", tone: "neutral" },
  { value: "shortlisted", label: "Shortlisted", applicantLabel: "Shortlisted", tone: "positive" },
  { value: "not_selected", label: "Not selected", applicantLabel: "Not selected", tone: "closed" },
  { value: "hired", label: "Hired", applicantLabel: "Hired", tone: "positive" },
] as const;

export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number]["value"];

/** CV upload limits. Mirrored by the cv_size_bytes CHECK in 0060. */
export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const CV_ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export const CV_ACCEPTED_EXT = [".pdf", ".doc", ".docx"] as const;

/** Banner upload limits. Kept small — this renders on a public page. */
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const BANNER_ACCEPTED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const BANNER_ACCEPTED_EXT = [".png", ".jpg", ".jpeg", ".webp"] as const;

const POST_FORMAT_LABELS = new Map<string, string>(
  JOB_POST_FORMATS.map((f) => [f.value, f.label]),
);
const APPLICATION_STATUS = new Map<string, (typeof JOB_APPLICATION_STATUSES)[number]>(
  JOB_APPLICATION_STATUSES.map((s) => [s.value, s]),
);

export function postFormatLabel(format: string): string {
  return POST_FORMAT_LABELS.get(format) ?? format;
}

/** Label the practice sees in their applicant list. */
export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUS.get(status)?.label ?? status;
}

/**
 * Label the APPLICANT sees. Split from the practice-facing label because
 * the two audiences read the same value differently — "Viewed" means
 * nothing to a candidate, "Viewed by the practice" does.
 */
export function applicationStatusApplicantLabel(status: string): string {
  return APPLICATION_STATUS.get(status)?.applicantLabel ?? status;
}

export function applicationStatusTone(status: string): "neutral" | "positive" | "closed" {
  return APPLICATION_STATUS.get(status)?.tone ?? "neutral";
}

export function isPostFormat(v: unknown): v is JobPostFormat {
  return typeof v === "string" && POST_FORMAT_LABELS.has(v);
}

export function isApplicationStatus(v: unknown): v is JobApplicationStatus {
  return typeof v === "string" && APPLICATION_STATUS.has(v);
}
