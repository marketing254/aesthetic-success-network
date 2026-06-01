import type { Metadata } from "next";
import DocPage from "@/components/DocPage";
import { vendorAgreement } from "@/docs";

export const metadata: Metadata = {
  title: "Vendor Partnership Agreement · Aesthetics Success Network",
  description:
    "The five commitments, fee schedule, and operational terms of the Aesthetics Success Network Vendor Network Partnership Agreement.",
};

export default function VendorAgreementPage() {
  return <DocPage data={vendorAgreement} />;
}
