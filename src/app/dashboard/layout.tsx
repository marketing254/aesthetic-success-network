import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";
import PortalShell from "@/components/portal/PortalShell";
import { requirePortalPage } from "@/lib/auth/portal";

export const metadata: Metadata = {
  title: "Member portal",
  robots: { index: false, follow: false },
};

export default async function MemberPortalLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: the middleware already gated this path.
  await requirePortalPage("member");
  return (
    <Providers>
      <PortalShell portal="member">{children}</PortalShell>
    </Providers>
  );
}
