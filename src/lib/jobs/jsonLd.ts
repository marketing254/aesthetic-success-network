import { employmentLabel, roleLabel } from "./constants";
import { jobTextToHtml } from "./richText";
import type { JobPostsRow } from "@/lib/supabase/types";

/**
 * schema.org JobPosting markup — the reason a member's vacancy shows up
 * in Google for Jobs rather than only on our own board.
 *
 * The spec calls this "the single highest value hour of work in the
 * build", and it earns that by being free distribution on top of the
 * group: every approved post becomes an entry in the biggest job search
 * surface there is, at no marginal cost to us.
 *
 * Google's required properties are title, description, datePosted,
 * hiringOrganization and jobLocation (or jobLocationType for remote).
 * validThrough is strongly recommended and we always have it, because
 * every post carries a 30-day expiry. Omitting it is what makes boards
 * accumulate stale listings in Google long after they're dead.
 *
 * Two deliberate choices:
 *  - hiringOrganization is the PRACTICE, never the network (ASN). Google
 *    wants the employer; naming ourselves would be misrepresentation and
 *    gets postings dropped.
 *  - directApply is false. Applications go to the practice by email or
 *    their own link — a seeker cannot complete an application on our
 *    page, and claiming otherwise is exactly what Google penalises.
 */

/**
 * Absolute origin for JobPosting URLs. Always the canonical `www` host:
 * a bare domain or a preview URL here would split Google's index.
 */
// Kept local (not imported from lib/stripe) so this module stays free of the Stripe SDK.
const CANONICAL_ORIGIN = "https://www.aestheticsuccessnetwork.com";
const SITE = canonicalSite();

function canonicalSite(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, "");
  // Bare domain (no scheme) → https://www.<domain>
  if (!/^https?:\/\//i.test(raw)) return `https://www.${raw.replace(/^www\./i, "")}`;
  return raw;
}

/** schema.org employmentType vocabulary — not our internal values. */
const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  temporary: "TEMPORARY",
  contract: "CONTRACTOR",
};

const UNIT_SCHEMA: Record<string, string> = {
  hour: "HOUR",
  day: "DAY",
  year: "YEAR",
};

/**
 * Split free-text "Austin, TX" into locality + region. Members type this
 * by hand, so anything unparseable falls back to putting the whole
 * string in addressLocality — a partial address Google can still use,
 * rather than dropping the property and failing validation.
 */
function splitLocation(location: string): { locality: string; region?: string } {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { locality: parts[0], region: parts[parts.length - 1] };
  }
  return { locality: location.trim() };
}

/**
 * Plain text → the HTML string Google expects in `description`.
 *
 * Shared with the public page via lib/jobs/richText.ts so a bullet list
 * renders as <ul><li> in BOTH places. Markup that doesn't match what a
 * visitor sees is exactly what gets a posting dropped from Google for
 * Jobs, so these two must never drift apart.
 */
const toHtml = jobTextToHtml;

type JobForJsonLd = Pick<
  JobPostsRow,
  | "slug"
  | "practice_name"
  | "role"
  | "role_other"
  | "employment_type"
  | "location"
  | "workplace"
  | "pay_min"
  | "pay_max"
  | "pay_unit"
  | "description"
  | "requirements"
  | "approved_at"
  | "expires_at"
  | "start_date"
  | "apply_url"
  | "id"
>;

export function jobPostingJsonLd(job: JobForJsonLd): Record<string, unknown> {
  const title = roleLabel(job.role, job.role_other);
  const { locality, region } = splitLocation(job.location);
  const remote = job.workplace === "remote";

  // A banner post may have no typed description (0061). description is a
  // REQUIRED JobPosting property, so this can never be omitted the way
  // baseSalary below can be — a synthesized line beats either dropping a
  // required field or letting `null` interpolate into crawlable content
  // as the literal string "null".
  const descriptionSource =
    job.description ??
    `${title} at ${job.practice_name} in ${job.location}. See the banner image on this page for the full listing.`;
  const description = toHtml(
    job.requirements
      ? `${descriptionSource}\n\nWhat we're looking for\n\n${job.requirements}`
      : descriptionSource,
  );

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    identifier: {
      "@type": "PropertyValue",
      name: "Aesthetic Success Network",
      value: job.id,
    },
    datePosted: job.approved_at,
    validThrough: job.expires_at,
    employmentType: EMPLOYMENT_TYPE_SCHEMA[job.employment_type] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.practice_name,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: locality,
        ...(region ? { addressRegion: region } : {}),
        addressCountry: "US",
      },
    },
    // baseSalary is OPTIONAL in the schema, unlike description above —
    // omitted entirely for a banner post with no pay (0061), rather than
    // emitted with a null value. Google treats a present-but-malformed
    // property worse than an absent optional one.
    ...(job.pay_min !== null && job.pay_max !== null
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: {
              "@type": "QuantitativeValue",
              // A true range where we have one; a single value when the
              // member gave the same number twice. Google accepts either.
              ...(job.pay_min === job.pay_max
                ? { value: job.pay_min }
                : { minValue: job.pay_min, maxValue: job.pay_max }),
              unitText: UNIT_SCHEMA[job.pay_unit] ?? "HOUR",
            },
          },
        }
      : {}),
    // We host the ad; the practice receives the application.
    directApply: false,
    url: `${SITE}/jobs/${job.slug}`,
  };

  if (remote) {
    // For a fully remote role Google wants the TELECOMMUTE marker AND a
    // country restriction — without the latter it treats the posting as
    // open worldwide, which no US aesthetic practice means.
    data.jobLocationType = "TELECOMMUTE";
    data.applicantLocationRequirements = {
      "@type": "Country",
      name: "USA",
    };
  }

  if (job.start_date) {
    data.jobStartDate = job.start_date;
  }

  return data;
}

/** Breadcrumb for the job page: Home → Aesthetic practice jobs → this role. */
export function jobBreadcrumbJsonLd(job: Pick<JobPostsRow, "slug" | "role" | "role_other" | "location">) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Aesthetic practice jobs", item: `${SITE}/jobs` },
      {
        "@type": "ListItem",
        position: 3,
        name: `${roleLabel(job.role, job.role_other)}, ${job.location}`,
        item: `${SITE}/jobs/${job.slug}`,
      },
    ],
  };
}

/** Human-readable employment label, re-exported so pages import one module. */
export { employmentLabel };
