import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getExpertBilling } from "@/lib/portal/data";
import { PageHeader, MigrationNotice } from "@/components/portal/ui";
import { errMessage } from "@/lib/errMessage";
import { TrialStartCard } from "@/components/shared/TrialStartCard";
import { BillingSection } from "@/components/dashboard/BillingSection";
import { EXPERT_PLAN_DISPLAY, expertPlanKeyForPriceId } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function planLabelFor(priceId: string | null): string {
  const key = expertPlanKeyForPriceId(priceId);
  return key ? EXPERT_PLAN_DISPLAY[key].label : "Growth";
}

export default async function ExpertBillingPage() {
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;

  let billing;
  try {
    billing = await getExpertBilling(expert.id);
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
          role="expert"
          planLabel={planLabelFor(billing.stripe_price_id)}
          status={billing.subscription_status}
          currentPeriodEnd={billing.current_period_end}
          cancelAtPeriodEnd={billing.cancel_at_period_end}
          cardBrand={billing.card_brand}
          cardLast4={billing.card_last4}
          hasCustomer={Boolean(billing.stripe_customer_id)}
          hasSubscription={hasSubscription}
          portalEndpoint="/api/expert/billing/portal"
          syncEndpoint="/api/expert/billing/sync"
          invoicesEndpoint="/api/expert/billing/invoices"
        />
      ) : (
        <TrialStartCard prepareEndpoint="/api/expert/billing/trial/prepare" startEndpoint="/api/expert/billing/trial/start" />
      )}
    </Box>
  );
}
