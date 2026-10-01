/**
 * Company price terms, keyed by vendors.billing_plan (0071).
 *
 * Every company pays nothing until PROVIDER_FREE_MONTHS after the member
 * launch, then a flat monthly rate with no increase:
 *   standard  $39 a month  (default; website signups and most invites)
 *   large     $149 a month (set by the admin at approval / on the invite)
 *
 * Every company-portal surface that prints a price reads from here so the
 * terms a company sees always match the plan on its row.
 */

import {
  PROVIDER_FREE_MONTHS,
  formatLongDate,
  normalizeProviderRate,
  providerTermsSentence,
  rateLabel,
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
  /** Short plan label, e.g. "Company, standard rate". */
  label: string;
  /** "$39" or "$149". */
  rate: string;
  rows: VendorRampRow[];
  /** Price this month: "$0.00" during the free period, else the rate. */
  monthlyNow: (hasTrial: boolean) => string;
  /** One sentence describing the whole term. */
  summary: string;
};

/** Normalises whatever is on the row (null, legacy values) to a known plan. */
export function normalizeVendorPlan(plan: string | null | undefined): VendorBillingPlan {
  return normalizeProviderRate(plan);
}

/**
 * The two-row term table for a company. `freeUntil` (the Stripe trial
 * end on the row) turns "6 months from the member launch" into a date.
 */
export function vendorRamp(plan: VendorBillingPlan | string | null | undefined, freeUntil?: string | Date | null): VendorRamp {
  const p = normalizeVendorPlan(typeof plan === "string" ? plan : plan ?? null);
  const rate = rateLabel(p);
  const until = formatLongDate(freeUntil ?? null);
  return {
    plan: p,
    label: p === "large" ? "Company, large rate" : "Company, standard rate",
    rate,
    rows: [
      {
        label: "Free founding months",
        price: "$0",
        note: until ? `Until ${until}` : `${PROVIDER_FREE_MONTHS} months from the member launch`,
        free: true,
      },
      { label: "After that", price: rate, note: "Every month, no increase", free: false },
    ],
    summary: providerTermsSentence(p),
    monthlyNow(hasTrial: boolean): string {
      return hasTrial ? "$0.00" : `${rate}.00`;
    },
  };
}

/** The row that applies now. */
export function currentRampRow(plan: VendorBillingPlan | string | null | undefined, hasTrial: boolean, freeUntil?: string | Date | null): VendorRampRow {
  const ramp = vendorRamp(plan, freeUntil);
  return hasTrial ? ramp.rows[0] : ramp.rows[1];
}

/** Short chip label for the admin console. */
export function vendorPlanChipLabel(plan: string | null | undefined): string {
  return normalizeVendorPlan(plan) === "large" ? "$149 rate" : "$39 rate";
}
