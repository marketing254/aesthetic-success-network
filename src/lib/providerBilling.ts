/**
 * Provider billing model (experts and companies), owner decision 2026-10-01.
 *
 *   Free founding months: every provider (founding invite or website
 *   signup, expert or company) pays nothing until PROVIDER_FREE_MONTHS
 *   after the member launch. The free period is anchored to the launch
 *   date, not to the day they accept, so providers who join early are
 *   never charged before members can join.
 *
 *   After the free period:
 *     expert   $39 a month, flat, no increase.
 *     company  $39 a month for the first COMPANY_LAUNCH_MONTHS (12) paid
 *              months, then $149 a month (the standard company rate).
 *              Same for founding invites and website signups.
 *
 *   A card is saved when the agreement is accepted. Stripe holds the
 *   subscription in `trialing` until the free period ends, then charges
 *   the rate. One reminder goes out 7 days before the first charge.
 *   Cancelling before the first charge takes effect immediately with no
 *   charge; after the first charge, 30 days' written notice applies.
 *
 * Config:
 *   MEMBER_LAUNCH_DATE   ISO date the network opens to members
 *                        (e.g. 2027-01-15). Free periods end
 *                        PROVIDER_FREE_MONTHS after it. While it is unset,
 *                        subscriptions get a PROVISIONAL free period of
 *                        PROVIDER_PROVISIONAL_FREE_MONTHS from today and
 *                        `scripts/stripe-sync-free-period.mjs` moves every
 *                        trial end to the real date once it is known.
 */

export const PROVIDER_FREE_MONTHS = 6;
/** Fallback free period (months from today) while MEMBER_LAUNCH_DATE is unset. */
export const PROVIDER_PROVISIONAL_FREE_MONTHS = 12;
/** Days a listing stays live after a failed charge before it is paused. */
export const PAYMENT_GRACE_DAYS = 7;
/** Written notice required to cancel after the first charge. */
export const CANCEL_NOTICE_DAYS = 30;
/** Days before the first charge that the single reminder email goes out. */
export const FIRST_CHARGE_REMINDER_DAYS = 7;

/** Kept for the DB column values (standard | large); every company is on the same ladder now. */
export type ProviderRate = "standard" | "large";

/** Company launch rate ($39) for the first paid months. */
export const COMPANY_LAUNCH_AMOUNT = 39;
/** Number of paid months at the launch rate before the standard rate. */
export const COMPANY_LAUNCH_MONTHS = 12;
/** Company standard rate after the launch months. */
export const COMPANY_STANDARD_AMOUNT = 149;
export const COMPANY_LAUNCH_LABEL = `$${COMPANY_LAUNCH_AMOUNT}`;
export const COMPANY_STANDARD_LABEL = `$${COMPANY_STANDARD_AMOUNT}`;

export function normalizeProviderRate(value: string | null | undefined): ProviderRate {
  return value === "large" ? "large" : "standard";
}

/** The company LAUNCH rate label ("$39"). The standard step is COMPANY_STANDARD_LABEL. */
export function rateLabel(rate: ProviderRate | string | null | undefined): string {
  void rate;
  return COMPANY_LAUNCH_LABEL;
}

/** When the $149 standard rate starts: the free period end plus the launch months. */
export function companyStandardStartsAt(freePeriodEnd: Date): Date {
  return addMonthsUtc(freePeriodEnd, COMPANY_LAUNCH_MONTHS);
}

/** Experts are always $39. */
export const EXPERT_RATE_LABEL = "$39";

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

/**
 * When the free founding months end for a provider accepting now.
 * `provisional` is true while MEMBER_LAUNCH_DATE is unset.
 */
export function providerFreePeriodEnd(now: Date = new Date()): { date: Date; provisional: boolean } {
  const launch = memberLaunchDate();
  if (launch) {
    const end = addMonthsUtc(launch, PROVIDER_FREE_MONTHS);
    // Stripe needs a trial end in the future; if the launch-based date has
    // already passed, the provider simply starts paying next month.
    if (end.getTime() > now.getTime() + 60 * 60 * 1000) return { date: end, provisional: false };
    return { date: addMonthsUtc(now, 1), provisional: false };
  }
  return { date: addMonthsUtc(now, PROVIDER_PROVISIONAL_FREE_MONTHS), provisional: true };
}

export function formatLongDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
}

/**
 * One sentence describing a provider's terms, used in emails, the
 * acceptance page and the portals so every surface reads the same.
 *   "Your first 6 months are free, starting the day we open to members.
 *    After that it's $39 a month, and it stays $39 with no increase."
 */
export function providerTermsSentence(rate: ProviderRate | string | null | undefined, opts: { expert?: boolean } = {}): string {
  void rate;
  if (opts.expert) {
    return `Your first ${PROVIDER_FREE_MONTHS} months are free, starting the day we open to members. After that it's ${EXPERT_RATE_LABEL} a month, and it stays ${EXPERT_RATE_LABEL} with no increase.`;
  }
  return `Your first ${PROVIDER_FREE_MONTHS} months are free, starting the day we open to members. After that it's ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL} a month.`;
}

/** Short form for tables and chips: "Free until March 1, 2027, then $39 a month". */
export function providerTermsShort(rate: ProviderRate | string | null | undefined, freeUntil: Date | string | null | undefined, opts: { expert?: boolean } = {}): string {
  void rate;
  const until = formatLongDate(freeUntil);
  const after = opts.expert
    ? `${EXPERT_RATE_LABEL} a month with no increase`
    : `${COMPANY_LAUNCH_LABEL} a month for ${COMPANY_LAUNCH_MONTHS} months, then ${COMPANY_STANDARD_LABEL}`;
  return until ? `Free until ${until}, then ${after}` : `${PROVIDER_FREE_MONTHS} months free from the member launch, then ${after}`;
}
