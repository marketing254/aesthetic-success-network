/**
 * Company price terms, keyed by vendors.billing_plan (0074).
 *
 * Every company pays nothing until PROVIDER_FREE_MONTHS (6) after the
 * member launch, then:
 *   ladder  $39 a month for 12 months, then $149 a month   (default)
 *   flat    $39 a month, no increase                       (admin choice)
 * Founding invites and website signups share these plans. Every
 * company-portal surface that prints a price reads from here.
 */

import {
  COMPANY_LAUNCH_LABEL,
  COMPANY_LAUNCH_MONTHS,
  COMPANY_STANDARD_LABEL,
  PROVIDER_FREE_MONTHS,
  companyStandardStartsAt,
  formatLongDate,
  normalizeProviderPlan,
  isQuarterlyPlan,
  quarterlyLabel,
  providerTermsSentence,
  type ProviderRate,
  type QuarterlyPlan,
  LAUNCH_LABEL,
} from "@/lib/providerBilling";

export type VendorBillingPlan = ProviderRate | QuarterlyPlan;

export type VendorRampRow = {
  label: string;
  price: string;
  /** Short note shown beside the row. */
  note: string;
  /** True when this row is the free period. */
  free: boolean;
};

export type VendorRamp = {
  plan: VendorBillingPlan;
  /** Short plan label, e.g. "Founding company". */
  label: string;
  /** Launch rate after the free months: "$39". */
  rate: string;
  /** Standard rate after the launch months (ladder only): "$149". */
  standardRate: string;
  /** True when the plan has the $149 step. */
  hasStandardStep: boolean;
  rows: VendorRampRow[];
  /** Price this period: "$0.00" during the free period, else the launch or standard rate. */
  monthlyNow: (hasTrial: boolean, onStandard?: boolean) => string;
  /** One sentence describing the whole term. */
  summary: string;
  /** "a month" or "every 3 months". */
  cadence: string;
  /** "/mo" or "/3 mo". */
  per: string;
  /** True for the quarterly plans (one fee for expert access + company listing). */
  quarterly: boolean;
};

/** Normalises whatever is on the row (null, legacy values) to a known plan. */
export function normalizeVendorPlan(plan: string | null | undefined): VendorBillingPlan {
  const p = normalizeProviderPlan(plan);
  return p === "free" ? "ladder" : p;
}

/**
 * The term table for a company. `freeUntil` (the Stripe trial end on the
 * row) turns "6 months from the member launch" into a date.
 */
export function vendorRamp(plan: VendorBillingPlan | string | null | undefined, freeUntil?: string | Date | null): VendorRamp {
  const p = normalizeVendorPlan(typeof plan === "string" ? plan : plan ?? null);
  const freeDate = freeUntil ? new Date(freeUntil) : null;
  const until = formatLongDate(freeDate);
  if (isQuarterlyPlan(p)) {
    const q = quarterlyLabel(p);
    const qFree: VendorRampRow = { label: "Free founding months", price: "$0", note: until ? `Until ${until}` : `${PROVIDER_FREE_MONTHS} months from ${LAUNCH_LABEL}`, free: true };
    return {
      plan: p,
      label: "Founding provider, quarterly",
      rate: q,
      standardRate: q,
      hasStandardStep: false,
      rows: [qFree, { label: "After that", price: q, note: "Every 3 months, no increase. One fee for expert access and company listing.", free: false }],
      summary: providerTermsSentence(p),
      monthlyNow(hasTrial: boolean): string {
        return hasTrial ? "$0.00" : `${q}.00`;
      },
      cadence: "every 3 months",
      per: "/3 mo",
      quarterly: true,
    };
  }
  const rate = COMPANY_LAUNCH_LABEL;
  const standardFrom = freeDate && !Number.isNaN(freeDate.getTime()) ? formatLongDate(companyStandardStartsAt(freeDate)) : null;
  const freeRow: VendorRampRow = {
    label: "Free founding months",
    price: "$0",
    note: until ? `Until ${until}` : `${PROVIDER_FREE_MONTHS} months from ${LAUNCH_LABEL}`,
    free: true,
  };
  const rows: VendorRampRow[] =
    p === "flat"
      ? [freeRow, { label: "After that", price: rate, note: "Every month, no increase", free: false }]
      : [
          freeRow,
          { label: `Next ${COMPANY_LAUNCH_MONTHS} months`, price: rate, note: standardFrom ? `Launch rate until ${standardFrom}` : "Launch rate", free: false },
          { label: "After that", price: COMPANY_STANDARD_LABEL, note: "Standard rate", free: false },
        ];
  return {
    plan: p,
    label: p === "flat" ? "Founding company, flat rate" : "Founding company",
    rate,
    standardRate: COMPANY_STANDARD_LABEL,
    hasStandardStep: p !== "flat",
    rows,
    summary: providerTermsSentence(p),
    monthlyNow(hasTrial: boolean, onStandard = false): string {
      return hasTrial ? "$0.00" : `${onStandard && p !== "flat" ? COMPANY_STANDARD_LABEL : rate}.00`;
    },
    cadence: "a month",
    per: "/mo",
    quarterly: false,
  };
}

/** The row that applies now. */
export function currentRampRow(plan: VendorBillingPlan | string | null | undefined, hasTrial: boolean, freeUntil?: string | Date | null, onStandard = false): VendorRampRow {
  const ramp = vendorRamp(plan, freeUntil);
  if (hasTrial) return ramp.rows[0];
  return onStandard && ramp.hasStandardStep ? ramp.rows[2] : ramp.rows[1];
}

/** Short chip label for the admin console. */
export function vendorPlanChipLabel(plan: string | null | undefined): string {
  const p = normalizeVendorPlan(plan);
  if (isQuarterlyPlan(p)) return `${quarterlyLabel(p)} every 3 months`;
  return p === "flat" ? "$39 flat" : "$39 x 12, then $149";
}
