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
  normalizeProviderRate,
  providerTermsSentence,
  type ProviderRate,
} from "@/lib/providerBilling";

export type VendorBillingPlan = ProviderRate;

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
  /** Price this month: "$0.00" during the free period, else the launch or standard rate. */
  monthlyNow: (hasTrial: boolean, onStandard?: boolean) => string;
  /** One sentence describing the whole term. */
  summary: string;
};

/** Normalises whatever is on the row (null, legacy values) to a known plan. */
export function normalizeVendorPlan(plan: string | null | undefined): VendorBillingPlan {
  return normalizeProviderRate(plan);
}

/**
 * The term table for a company. `freeUntil` (the Stripe trial end on the
 * row) turns "6 months from the member launch" into a date.
 */
export function vendorRamp(plan: VendorBillingPlan | string | null | undefined, freeUntil?: string | Date | null): VendorRamp {
  const p = normalizeVendorPlan(typeof plan === "string" ? plan : plan ?? null);
  const rate = COMPANY_LAUNCH_LABEL;
  const freeDate = freeUntil ? new Date(freeUntil) : null;
  const until = formatLongDate(freeDate);
  const standardFrom = freeDate && !Number.isNaN(freeDate.getTime()) ? formatLongDate(companyStandardStartsAt(freeDate)) : null;
  const freeRow: VendorRampRow = {
    label: "Free founding months",
    price: "$0",
    note: until ? `Until ${until}` : `${PROVIDER_FREE_MONTHS} months from the member launch`,
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
  return normalizeVendorPlan(plan) === "flat" ? "$39 flat" : "$39 x 12, then $149";
}
