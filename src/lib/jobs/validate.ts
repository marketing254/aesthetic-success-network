import {
  isEmploymentType,
  isJobRole,
  isPayUnit,
  isPostFormat,
  isWorkplace,
  type JobEmploymentType,
  type JobPayUnit,
  type JobPostFormat,
  type JobRole,
  type JobWorkplace,
} from "./constants";

/**
 * One validator for every write path: the member form, and the admin
 * "edit before approving" path. Sharing it is what stops a post being
 * approved into a shape the form would have rejected (the admin edit
 * exists to fix typos and missing pay, not to bypass the rules).
 *
 * Mirrors the CHECK constraints in 0061_job_board.sql. The DB is the
 * real guarantee; this exists to return a message a human can act on
 * instead of a Postgres constraint name.
 */

export type JobInput = {
  practice_name: string;
  role: JobRole;
  role_other: string | null;
  employment_type: JobEmploymentType;
  location: string;
  workplace: JobWorkplace;
  // null only when post_format is "banner" — see validateJobInput.
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: JobPayUnit;
  description: string | null;
  requirements: string | null;
  apply_email: string | null;
  apply_url: string | null;
  start_date: string | null;
  start_flexible: boolean;
  post_format: JobPostFormat;
  banner_path: string | null;
  banner_alt: string | null;
};

export type ValidationResult =
  | { ok: true; value: JobInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Upper bounds that catch a fat-fingered extra zero rather than a real
// salary. $2,000/hour and $5m/year are not offers we need to support.
const PAY_CEILING: Record<JobPayUnit, number> = {
  hour: 2_000,
  day: 10_000,
  year: 5_000_000,
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    // Tolerate "$45,000" and "45,000" — a member typing money into a
    // number field will include the separators they'd write by hand.
    const parsed = Number(v.replace(/[$,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function validateJobInput(body: Record<string, unknown>): ValidationResult {
  const practiceName = str(body.practice_name);
  if (practiceName.length < 2 || practiceName.length > 160) {
    return { ok: false, error: "Practice name must be 2–160 characters." };
  }

  const role = body.role;
  if (!isJobRole(role)) return { ok: false, error: "Choose a role from the list." };

  // "Other" without a description would land on the board as a job
  // called "Other", which helps nobody searching.
  const roleOther = str(body.role_other) || null;
  if (role === "other" && !roleOther) {
    return { ok: false, error: "Tell us the role title when you choose Other." };
  }
  if (roleOther && roleOther.length > 80) {
    return { ok: false, error: "Role title must be 80 characters or fewer." };
  }

  const employmentType = body.employment_type;
  if (!isEmploymentType(employmentType)) {
    return { ok: false, error: "Choose an employment type." };
  }

  const location = str(body.location);
  if (location.length < 2 || location.length > 160) {
    return { ok: false, error: "Add a location: city and state, or region." };
  }

  const workplace = body.workplace;
  if (!isWorkplace(workplace)) {
    return { ok: false, error: "Choose onsite, hybrid or remote." };
  }

  // Which of the two posting paths this is. Anything unrecognised is a
  // client that's out of step with the enum, not a user error to explain.
  // Determined before pay/description below because banner posts get a
  // different rule for both: optional, not required.
  const postFormat = body.post_format === undefined ? "detailed" : body.post_format;
  if (!isPostFormat(postFormat)) {
    return { ok: false, error: "Choose how you want to post this job." };
  }
  const isBanner = postFormat === "banner";

  // Pay is required on a DETAILED post by design: this is the field
  // most likely to be argued about, so the message says why rather than
  // just "required". A BANNER post may leave it out: the graphic is
  // expected to carry it instead (see 0064_banner_pay_description_optional.sql
  // for the schema side of this and the tradeoff it accepts).
  const payUnit = body.pay_unit;
  if (!isPayUnit(payUnit)) {
    return { ok: false, error: "Choose whether the pay is per hour, per day or per year." };
  }
  const payMinRaw = body.pay_min;
  const payMaxRaw = body.pay_max;
  const payOmitted =
    isBanner && (payMinRaw === undefined || payMinRaw === "") && (payMaxRaw === undefined || payMaxRaw === "");
  const payMin = payOmitted ? null : num(payMinRaw);
  const payMax = payOmitted ? null : num(payMaxRaw);
  if (!payOmitted) {
    if (payMin === null || payMax === null) {
      return {
        ok: false,
        error: isBanner
          ? "Give both ends of the pay range, or leave both blank."
          : "Pay range is required on every ASN post: candidates skip ads that hide it. A range is fine.",
      };
    }
    if (payMin < 0 || payMax < 0) return { ok: false, error: "Pay can't be negative." };
    if (payMax < payMin) {
      return { ok: false, error: "The top of the range can't be lower than the bottom." };
    }
    if (payMax > PAY_CEILING[payUnit]) {
      return { ok: false, error: "That pay figure looks wrong: check the amount and the unit." };
    }
  }

  // Description is required for a DETAILED post, and that is the point:
  // Google reads none of an image, and neither does the JobPosting
  // structured data that gets the post into Google for Jobs. A BANNER
  // post may leave it blank, accepting that its listing then relies on
  // a synthesized fallback for both of those instead of the member's
  // own words: see src/lib/jobs/jsonLd.ts.
  const descriptionRaw = str(body.description);
  const description = isBanner && !descriptionRaw ? null : descriptionRaw;
  if (description !== null && (description.length < 30 || description.length > 8000)) {
    return {
      ok: false,
      error: isBanner
        ? "That summary is too short or too long: two or three sentences, or leave it blank."
        : "Job description must be 30–8000 characters.",
    };
  }

  const requirements = str(body.requirements) || null;
  if (requirements && requirements.length > 4000) {
    return { ok: false, error: "What you're looking for must be 4000 characters or fewer." };
  }

  // How to apply: either channel is fine, but one is mandatory. A post
  // nobody can reply to wastes the promotion slot it takes up.
  const applyEmail = str(body.apply_email).toLowerCase() || null;
  const applyUrl = str(body.apply_url) || null;
  if (!applyEmail && !applyUrl) {
    return { ok: false, error: "Add an application email or a link: applicants go straight to you." };
  }
  if (applyEmail && (!EMAIL_RE.test(applyEmail) || applyEmail.length > 254)) {
    return { ok: false, error: "That application email doesn't look right." };
  }
  if (applyUrl && (!URL_RE.test(applyUrl) || applyUrl.length > 500)) {
    return { ok: false, error: "Paste a full https:// application link." };
  }

  // Banner fields. banner_path is written by the upload route, not typed
  // by anyone: it arrives here already stored, and the check is that a
  // banner post actually has one.
  const bannerPath = str(body.banner_path) || null;
  const bannerAlt = str(body.banner_alt) || null;
  if (isBanner) {
    if (!bannerPath) {
      return { ok: false, error: "Upload your job banner before publishing." };
    }
    if (bannerPath.length > 400) {
      return { ok: false, error: "That banner couldn't be saved: try uploading it again." };
    }
    // Required, not nice-to-have: without it a screen reader gets nothing
    // from the post at all, and we lose a piece of indexable text on a
    // page whose main content is an image.
    if (!bannerAlt || bannerAlt.length < 5 || bannerAlt.length > 300) {
      return {
        ok: false,
        error: "Describe the banner in a line (5 to 300 characters): it's what screen readers and search engines see.",
      };
    }
  } else if (bannerPath || bannerAlt) {
    // Switching back to the written format must not leave a stale image
    // attached to the post.
    return { ok: false, error: "Remove the banner, or switch this post back to Upload a banner." };
  }

  const startFlexible = body.start_flexible === true;
  let startDate = str(body.start_date) || null;
  if (startFlexible) startDate = null;
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "Start date must be a valid date." };
  }
  if (startDate && Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())) {
    return { ok: false, error: "Start date must be a valid date." };
  }

  return {
    ok: true,
    value: {
      practice_name: practiceName,
      role,
      role_other: role === "other" ? roleOther : null,
      employment_type: employmentType,
      location,
      workplace,
      pay_min: payMin,
      pay_max: payMax,
      pay_unit: payUnit,
      description,
      requirements,
      apply_email: applyEmail,
      apply_url: applyUrl,
      start_date: startDate,
      start_flexible: startFlexible,
      post_format: postFormat,
      banner_path: isBanner ? bannerPath : null,
      banner_alt: isBanner ? bannerAlt : null,
    },
  };
}
