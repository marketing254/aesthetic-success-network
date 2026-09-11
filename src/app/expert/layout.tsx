import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalPage } from "@/lib/auth/portal";
import { getExpertBilling } from "@/lib/portal/data";
import { checkBillingAccess, monthsSince } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Expert portal",
  robots: { index: false, follow: false },
};

export default async function ExpertPortalLayout({ children }: { children: React.ReactNode }) {
  const identity = await requirePortalPage("expert");
  const billing = await getExpertBilling(identity.expert!.id);
  const access = checkBillingAccess({
    monthsInProgram: monthsSince(billing?.program_started_at ?? null),
    subscriptionStatus: billing?.subscription_status ?? null,
    hasSubscription: Boolean(billing?.stripe_subscription_id),
  });

  return (
    <Providers>
      <PortalShell portal="expert" billingAccess={access}>
        {children}
      </PortalShell>
    </Providers>
  );
}
