import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getPartnerBilling } from "@/lib/portal/data";
import { PageHeader, MigrationNotice } from "@/components/portal/ui";
import { errMessage } from "@/lib/errMessage";
import { TrialStartCard } from "@/components/shared/TrialStartCard";
import { BillingSection } from "@/components/dashboard/BillingSection";
import { PARTNER_PLAN_DISPLAY, partnerPlanKeyForPriceId } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function planLabelFor(priceId: string | null): string {
  const key = partnerPlanKeyForPriceId(priceId);
  return key ? PARTNER_PLAN_DISPLAY[key].label : "Growth";
}

export default async function VendorBillingPage() {
  const identity = await requirePortalPage("partner");
  const partner = identity.partner!;

  let billing;
  try {
    billing = await getPartnerBilling(partner.id);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Billing" title="Your subscription" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const hasSubscription = Boolean(billing?.stripe_subscription_id);

  return (
    <Box>
      <PageHeader eyebrow="Billing" title="Your subscription" />
      {hasSubscription && billing ? (
        <BillingSection
          role="partner"
          planLabel={planLabelFor(billing.stripe_price_id)}
          status={billing.subscription_status}
          currentPeriodEnd={billing.current_period_end}
          cancelAtPeriodEnd={billing.cancel_at_period_end}
          cardBrand={billing.card_brand}
          cardLast4={billing.card_last4}
          hasCustomer={Boolean(billing.stripe_customer_id)}
          hasSubscription={hasSubscription}
          portalEndpoint="/api/vendor/billing/portal"
          syncEndpoint="/api/vendor/billing/sync"
          invoicesEndpoint="/api/vendor/billing/invoices"
        />
      ) : (
        <TrialStartCard prepareEndpoint="/api/vendor/billing/trial/prepare" startEndpoint="/api/vendor/billing/trial/start" />
      )}
    </Box>
  );
}
