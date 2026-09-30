/**
 * Company price ramps, keyed by vendors.billing_plan (0070).
 *
 * ASN-SWAP-CANON.md section 3, provider pricing cases (owner decision,
 * 2026-09-30: every company pays from the day it adds a card):
 *   website          case D: $39 a month for months 1 to 12, then $149
 *                    from month 13. Default for /companies signups. Same
 *                    ramp as founding_ladder; only the label differs.
 *   founding_ladder  case B, invite pricing_plan "ladder": $39 a month for
 *                    months 1 to 12, then $149 from month 13.
 *   founding_flat    case B, invite pricing_plan "flat_49": $39 a month,
 *                    no increase.
 *
 * There is no free period and no $199 rate for companies anywhere.
 *
 * Every company-portal surface that prints a price reads from here so the
 * ramp a company sees always matches the plan on its row.
 */

export type VendorBillingPlan = "website" | "founding_ladder" | "founding_flat";

export type VendorRampRow = {
  label: string;
  price: string;
  /** Short note shown beside the row. */
  note: string;
  /** First month (1-based) this row covers. */
  from: number;
  /** Last month this row covers, or null for open-ended. */
  to: number | null;
};

export type VendorRamp = {
  plan: VendorBillingPlan;
  /** Short plan label, e.g. "Founding company". */
  label: string;
  rows: VendorRampRow[];
  /** Price for the current month, e.g. "$39.00". */
  monthlyNow: (monthsInProgram: number, hasTrial: boolean) => string;
  /** One sentence describing the whole ramp. */
  summary: string;
  /** Length of the first-year term the progress bar tracks, in months. */
  termMonths: number;
};

const LADDER_ROWS: VendorRampRow[] = [
  { label: "Months 1 to 12", price: "$39", note: "Launch rate, billed from day 1", from: 1, to: 12 },
  { label: "Month 13 onward", price: "$149", note: "Standard rate", from: 13, to: null },
];

const LADDER_SUMMARY = "$39 a month for your first 12 months, then $149 a month from month 13";

const RAMPS: Record<VendorBillingPlan, Omit<VendorRamp, "monthlyNow">> = {
  website: {
    plan: "website",
    label: "Company",
    rows: LADDER_ROWS,
    summary: LADDER_SUMMARY,
    termMonths: 12,
  },
  founding_ladder: {
    plan: "founding_ladder",
    label: "Founding company",
    rows: LADDER_ROWS,
    summary: LADDER_SUMMARY,
    termMonths: 12,
  },
  founding_flat: {
    plan: "founding_flat",
    label: "Founding company",
    rows: [{ label: "Every month", price: "$39", note: "Founding rate, no increase", from: 1, to: null }],
    summary: "$39 a month, no increase",
    termMonths: 12,
  },
};

/** Normalises whatever is on the row (null, unknown) to a known plan. */
export function normalizeVendorPlan(plan: string | null | undefined): VendorBillingPlan {
  if (plan === "founding_ladder" || plan === "founding_flat") return plan;
  return "website";
}

/** The ramp row that applies in a given month (1-based; month 0 counts as month 1). */
export function currentRampRow(plan: VendorBillingPlan, monthsInProgram: number): VendorRampRow {
  const month = Math.max(1, Math.floor(monthsInProgram) || 1);
  const rows = RAMPS[plan].rows;
  return rows.find((r) => month >= r.from && (r.to === null || month <= r.to)) ?? rows[rows.length - 1];
}

export function vendorRamp(plan: VendorBillingPlan): VendorRamp {
  const base = RAMPS[plan];
  return {
    ...base,
    monthlyNow(monthsInProgram: number, hasTrial: boolean): string {
      // Companies never trial any more. A legacy row still marked
      // "trialing" (signed up under the old free period) pays $0 until
      // Stripe converts it; every new company pays from day 1.
      if (hasTrial) return "$0.00";
      const row = currentRampRow(plan, monthsInProgram);
      return `${row.price}.00`;
    },
  };
}

/** Short chip label for the admin console. */
export function vendorPlanChipLabel(plan: string | null | undefined): string {
  const p = normalizeVendorPlan(plan);
  if (p === "founding_ladder") return "Founding ladder";
  if (p === "founding_flat") return "Founding flat";
  return "Website";
}
