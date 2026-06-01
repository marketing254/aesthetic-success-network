import type { Metadata } from "next";
import DocPage from "@/components/DocPage";
import { memberAgreement } from "@/docs";

export const metadata: Metadata = {
  title: "Member Agreement · Aesthetics Success Network",
  description:
    "Membership benefits, account access, helpline usage, content rights, and termination terms for Aesthetics Success Network members.",
};

export default function MemberAgreementPage() {
  return <DocPage data={memberAgreement} />;
}
