import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalPage } from "@/lib/auth/portal";

export const metadata: Metadata = {
  title: "Expert portal",
  robots: { index: false, follow: false },
};

export default async function ExpertPortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortalPage("expert");
  return (
    <Providers>
      <PortalShell portal="expert">{children}</PortalShell>
    </Providers>
  );
}
