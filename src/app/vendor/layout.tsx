import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalPage } from "@/lib/auth/portal";
import { getPartnerBilling } from "@/lib/portal/data";
import { checkBillingAccess, monthsSince } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Partner portal",
  robots: { index: false, follow: false },
};

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const identity = await requirePortalPage("partner");
  const billing = await getPartnerBilling(identity.partner!.id);
  const access = checkBillingAccess({
    monthsInProgram: monthsSince(billing?.program_started_at ?? null),
    subscriptionStatus: billing?.subscription_status ?? null,
    hasSubscription: Boolean(billing?.stripe_subscription_id),
  });

  return (
    <Providers>
      <PortalShell portal="partner" billingAccess={access}>
        {children}
      </PortalShell>
    </Providers>
  );
}
