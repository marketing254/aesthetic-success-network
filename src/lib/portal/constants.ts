/**
 * Shared portal vocabularies. Kept out of the route handlers so the forms
 * and the validators read from exactly the same list — a route file may
 * only export HTTP methods, so constants can't live there.
 */

export const HOTLINE_CATEGORIES = [
  "Marketing & patient acquisition",
  "Pricing & packaging",
  "Staffing & training",
  "Operations & workflow",
  "Compliance & risk",
  "Finance & profitability",
  "Technology & devices",
  "Something else",
] as const;

export const DEAL_CATEGORIES = [
  "Devices & equipment",
  "Injectables & pharmacy",
  "Skincare & retail",
  "Software & EMR",
  "Marketing & advertising",
  "Staffing & recruiting",
  "Financing & leasing",
  "Compliance & legal",
  "Insurance",
  "Training & education",
  "Other",
] as const;

export const KIT_CATEGORIES = [
  "Marketing",
  "Operations",
  "Finance",
  "Staffing",
  "Compliance",
  "Patient experience",
  "Technology",
  "Other",
] as const;
