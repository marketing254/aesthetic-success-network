import {
  payUnitLabel,
  roleLabel,
  type JobPayUnit,
} from "./constants";

/**
 * Formatting shared by the public board, the member portal and the emails,
 * so a pay range reads identically wherever it appears. Client-safe.
 */

/**
 * "$45 to $55 an hour" — the spoken form, not "$45.00-$55.00/hr".
 * Collapses to "$120,000 a year" when min and max are equal, because a
 * range with the same number on both sides looks like a bug to a reader.
 *
 * min/max are nullable because a banner post is allowed to skip pay
 * (see 0064_banner_pay_description_optional.sql): that's the ONLY
 * case null should reach this function; a detailed post's pay is still
 * required at the schema level. Returns a phrase rather than "$NaN" or
 * a misleading "$0" for that case.
 */
export function formatPay(
  min: number | null,
  max: number | null,
  unit: JobPayUnit | string,
): string {
  if (min === null || max === null) return "Pay not listed: see the banner";

  const money = (n: number) =>
    // Hourly and daily rates carry cents when they have them ($22.50);
    // salaries never do, and "$120,000.00" reads like a typo.
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: unit === "year" ? 0 : Number.isInteger(n) ? 0 : 2,
    }).format(n);

  const suffix =
    unit === "hour" ? "an hour" : unit === "day" ? "a day" : unit === "year" ? "a year" : payUnitLabel(String(unit));

  return min === max ? `${money(min)} ${suffix}` : `${money(min)} to ${money(max)} ${suffix}`;
}

/** "Posted 2 days ago" / "Posted today". */
export function postedAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Just posted";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently posted";
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Posted a month ago" : `Posted ${months} months ago`;
}

/** "Nurse injector (RN/NP) · Glow Aesthetics · Austin, TX" — for <title> and emails. */
export function jobHeadline(job: {
  role: string;
  role_other?: string | null;
  practice_name: string;
  location: string;
}): string {
  return `${roleLabel(job.role, job.role_other)} · ${job.practice_name} · ${job.location}`;
}

/**
 * Days left before a live post auto-expires. Negative means the cron
 * hasn't swept it yet: callers should treat <= 0 as expired.
 */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - now.getTime()) / 86_400_000);
}

/**
 * Public URL for a job banner.
 *
 * `job-banners` is a public bucket, so this is a plain deterministic URL
 * with no signing round trip: which matters because it renders on the
 * public job page and inside the crawlable HTML.
 *
 * Returns null when the env var is missing rather than emitting a
 * half-formed URL, so a misconfigured environment shows no banner
 * instead of a broken image on a page carrying our name.
 */
export function bannerPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/job-banners/${path}`;
}
