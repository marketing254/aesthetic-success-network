import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getMemberBilling } from "@/lib/portal/data";
import { PageHeader, MigrationNotice } from "@/components/portal/ui";
import { errMessage } from "@/lib/errMessage";
import { SubscribeCard } from "@/components/dashboard/SubscribeCard";
import { BillingSection } from "@/components/dashboard/BillingSection";
import { PLAN_DISPLAY, type SubscriptionPlanKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function planLabelFor(tier: string, interval: string | null): string {
  const key = `${tier}_${interval === "year" ? "annual" : "monthly"}` as SubscriptionPlanKey;
  return PLAN_DISPLAY[key]?.label ?? `${tier} plan`;
}

export default async function MemberBillingPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let billing;
  try {
    billing = await getMemberBilling(member.id);
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
          role="member"
          planLabel={planLabelFor(billing.tier, billing.subscription_interval)}
          status={billing.subscription_status}
          currentPeriodEnd={billing.current_period_end}
          cancelAtPeriodEnd={billing.cancel_at_period_end}
          cardBrand={billing.card_brand}
          cardLast4={billing.card_last4}
          hasCustomer={Boolean(billing.stripe_customer_id)}
          hasSubscription={hasSubscription}
          portalEndpoint="/api/stripe/portal"
          syncEndpoint="/api/member/billing/sync"
          invoicesEndpoint="/api/member/billing/invoices"
        />
      ) : (
        <SubscribeCard />
      )}
    </Box>
  );
}
