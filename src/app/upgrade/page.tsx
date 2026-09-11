import { redirect } from "next/navigation";

/**
 * /upgrade — alias for TD's post-login paywall page.
 *
 * ASN already has this exact feature at /dashboard/billing
 * (SubscribeCard + BillingSection, gated by requirePortalPage("member"),
 * checking out through the existing /api/stripe/checkout route). Rather
 * than duplicate that page, /upgrade simply forwards there — an
 * unauthenticated visitor gets redirected on to /login by the portal
 * guard, exactly like TD's /upgrade did for a logged-out visitor.
 */
export default function UpgradePage() {
  redirect("/dashboard/billing");
}
