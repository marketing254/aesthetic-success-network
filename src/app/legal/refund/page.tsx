import type { Metadata } from "next";
import DocPage from "@/components/DocPage";
import { refundPolicy } from "@/docs";

export const metadata: Metadata = {
  title: "Refund & Cancellation · Aesthetics Success Network",
  description:
    "30-day money-back guarantee, cancellation rules, founding-member pricing, and refund eligibility for members and vendor partners.",
};

export default function RefundPolicyPage() {
  return <DocPage data={refundPolicy} />;
}
