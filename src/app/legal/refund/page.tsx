import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";
import SitePage from "@/components/site/SitePage";
import { html, meta, title } from "@/content/legal/refund-policy";

// Document text is generated from the original ASN site
// (https://www.aestheticsuccessnetwork.com/refund-policy) in
// src/content/legal/refund-policy.ts. Regenerate that module to update the copy.

export const metadata: Metadata = {
  title: `${title} | Aesthetic Success Network`,
  description: meta,
  alternates: { canonical: "/legal/refund" },
};

export default function Page() {
  return (
    <SitePage>
      <LegalShell
        title={title}
        meta={meta}
        pdfHref="/agreements/asn-refund-and-cancellation-policy.pdf"
        footerLinks={[
          { href: "/agreement/member", label: "Member Agreement" },
          { href: "/legal/privacy", label: "Privacy" },
        ]}
      >
        {/* Our own approved legal copy, generated from the live ASN site (not user input). */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </LegalShell>
    </SitePage>
  );
}
