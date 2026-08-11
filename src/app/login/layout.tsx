import type { Metadata } from "next";
import Providers from "@/components/admin/Providers";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
