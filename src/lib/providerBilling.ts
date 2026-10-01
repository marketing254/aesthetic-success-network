/**
 * Provider billing model (experts and companies), owner decision 2026-10-02 (final).
 *
 *   Every free period starts on the member launch date (MEMBER_LAUNCH_DATE),
 *   so nobody is charged before members can join.
 *
 *   Founding expert (admin founding invite)
 *     12 months free, then $39 a month, flat, no increase.
 *   Website expert (applied at /experts)
 *     6 months free, then $39 a month, flat (the step after that is still
 *     to be decided by the owner; today it stays $39).
 *   Company, every kind (founding invite or website signup; all companies
 *   are founding companies)
 *     6 months free, then one of two plans chosen by the admin:
 *       ladder  $39 a month for 12 months, then $149 a month   (default)
 *       flat    $39 a month, no increase
 *
 *   A card is saved when the agreement is accepted. Stripe holds billing
 *   in `trialing` until the free period ends. One reminder goes out 7 days
 *   before the first charge. Cancelling before the first charge takes
 *   effect immediately with no charge; after the first charge, 30 days'
 *   written notice applies.
 *
 * Config:
 *   MEMBER_LAUNCH_DATE   ISO date the network opens to members
 *                        (e.g. 2027-01-15). While unset, billing gets a
 *                        PROVISIONAL free period of
 *                        PROVIDER_PROVISIONAL_FREE_MONTHS from today and
 *                        `scripts/stripe-sync-free-period.mjs` moves every
 *                        trial end to the real date once it is known.
 */

/** Free months for website experts and every company. */
export const PROVIDER_FREE_MONTHS = 6;
/** Free months for founding (admin-invited) experts. */
export const FOUNDING_EXPERT_FREE_MONTHS = 12;
/** Fallback free period (months from today) while MEMBER_LAUNCH_DATE is unset. */
export const PROVIDER_PROVISIONAL_FREE_MONTHS = 12;
/** Days a listing stays live after a failed charge before it is paused. */
export const PAYMENT_GRACE_DAYS = 7;
/** Written notice required to cancel after the first charge. */
export const CANCEL_NOTICE_DAYS = 30;
/** Days before the first charge that the single reminder email goes out. */
export const FIRST_CHARGE_REMINDER_DAYS = 7;

/** Company plan (founding_invites.pricing_plan / vendors.billing_plan, 0074). */
export type ProviderRate = "ladder" | "flat";

/** Launch rate ($39): experts always; companies for the first paid months. */
export const COMPANY_LAUNCH_AMOUNT = 39;
/** Paid months at $39 before the $149 step (company ladder plan). */
export const COMPANY_LAUNCH_MONTHS = 12;
/** Company standard rate after the launch months (ladder plan). */
export const COMPANY_STANDARD_AMOUNT = 149;
export const COMPANY_LAUNCH_LABEL = `$${COMPANY_LAUNCH_AMOUNT}`;
export const COMPANY_STANDARD_LABEL = `$${COMPANY_STANDARD_AMOUNT}`;
/** Experts are always $39 after their free months. */
export const EXPERT_RATE_LABEL = COMPANY_LAUNCH_LABEL;

/** Normalises any stored value (ladder, flat, legacy standard/large/flat_49) to a plan. */
export function normalizeProviderRate(value: string | null | undefined): ProviderRate {
  return value === "flat" || value === "flat_49" ? "flat" : "ladder";
}

/** The launch rate label ("$39"). */
export function rateLabel(rate: ProviderRate | string | null | undefined): string {
  void rate;
  return COMPANY_LAUNCH_LABEL;
}

/** When the $149 standard rate starts for a ladder company: free end + 12 months. */
export function companyStandardStartsAt(freePeriodEnd: Date): Date {
  return addMonthsUtc(freePeriodEnd, COMPANY_LAUNCH_MONTHS);
}

export function memberLaunchDate(): Date | null {
  const raw = (process.env.MEMBER_LAUNCH_DATE ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Free months that apply to a provider. */
export function freeMonthsFor(opts: { audience: "expert" | "vendor"; founding?: boolean }): number {
  return opts.audience === "expert" && opts.founding ? FOUNDING_EXPERT_FREE_MONTHS : PROVIDER_FREE_MONTHS;
}

/**
 * When the free months end for a provider accepting now.
 * `provisional` is true while MEMBER_LAUNCH_DATE is unset.
 */
export function providerFreePeriodEnd(months: number = PROVIDER_FREE_MONTHS, now: Date = new Date()): { date: Date; provisional: boolean } {
  const launch = memberLaunchDate();
  if (launch) {
    const end = addMonthsUtc(launch, months);
    // Stripe needs a trial end in the future; if the launch-based date has
    // already passed, the provider simply starts paying next month.
    if (end.getTime() > now.getTime() + 60 * 60 * 1000) return { date: end, provisional: false };
    return { date: addMonthsUtc(now, 1), provisional: false };
  }
  return { date: addMonthsUtc(now, Math.max(PROVIDER_PROVISIONAL_FREE_MONTHS, months)), provisional: true };
}

export function formatLongDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
}

export type TermsOpts = { expert?: boolean; founding?: boolean };

/**
 * One sentence describing a provider's terms, used in emails, the
 * acceptance page and the portals so every surface reads the same.
 *   founding expert  "Your first 12 months are free, starting the day we open to members. After that it's $39 a month, and it stays $39 with no increase."
 *   website expert   "Your first 6 months are free, ... After that it's $39 a month, and it stays $39 with no increase."
 *   company ladder   "Your first 6 months are free, ... After that it's $39 a month for your first 12 months, then $149 a month."
 *   company flat     "Your first 6 months are free, ... After that it's $39 a month, and it stays $39 with no increase."
 */
export function providerTermsSentence(rate: ProviderRate | string | null | undefined, opts: TermsOpts = {}): string {
  const months = opts.expert ? freeMonthsFor({ audience: "expert", founding: opts.founding }) : PROVIDER_FREE_MONTHS;
  const lead = `Your first ${months} months are free, starting the day we open to members.`;
  if (opts.expert || normalizeProviderRate(rate) === "flat") {
    return `${lead} After that it's ${COMPANY_LAUNCH_LABEL} a month, and it stays ${COMPANY_LAUNCH_LABEL} with no increase.`;
  }
  return `${lead} After that it's ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL} a month.`;
}

/** Short form for tables and chips: "Free until March 1, 2027, then $39 a month ...". */
export function providerTermsShort(rate: ProviderRate | string | null | undefined, freeUntil: Date | string | null | undefined, opts: TermsOpts = {}): string {
  const months = opts.expert ? freeMonthsFor({ audience: "expert", founding: opts.founding }) : PROVIDER_FREE_MONTHS;
  const until = formatLongDate(freeUntil);
  const after =
    opts.expert || normalizeProviderRate(rate) === "flat"
      ? `${COMPANY_LAUNCH_LABEL} a month with no increase`
      : `${COMPANY_LAUNCH_LABEL} a month for ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL}`;
  return until ? `Free until ${until}, then ${after}` : `${months} months free from the member launch, then ${after}`;
}
