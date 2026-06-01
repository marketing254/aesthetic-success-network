import type { Metadata } from "next";
import DocPage from "@/components/DocPage";
import { privacyPolicy } from "@/docs";

export const metadata: Metadata = {
  title: "Privacy Policy · Aesthetics Success Network",
  description:
    "What data Aesthetics Success Network collects, how it is used, who it is shared with, and your rights. We do not collect or store patient data.",
};

export default function PrivacyPolicyPage() {
  return <DocPage data={privacyPolicy} />;
}
