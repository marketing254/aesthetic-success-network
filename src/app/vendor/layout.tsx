import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalPage } from "@/lib/auth/portal";

export const metadata: Metadata = {
  title: "Partner portal",
  robots: { index: false, follow: false },
};

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortalPage("partner");
  return (
    <Providers>
      <PortalShell portal="partner">{children}</PortalShell>
    </Providers>
  );
}
