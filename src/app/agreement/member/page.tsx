import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";
import SitePage from "@/components/site/SitePage";
import { html, meta, title } from "@/content/legal/member-agreement";

// Document text is generated from the original ASN site
// (https://www.aestheticsuccessnetwork.com/member-agreement) in
// src/content/legal/member-agreement.ts. Regenerate that module to update the copy.

export const metadata: Metadata = {
  title: `${title} | Aesthetic Success Network`,
  description: meta,
  alternates: { canonical: "/agreement/member" },
};

export default function Page() {
  return (
    <SitePage>
      <LegalShell
        title={title}
        meta={meta}
        pdfHref="/agreements/asn-member-agreement.pdf"
        footerLinks={[
          { href: "/agreement/provider", label: "Provider Agreement" },
          { href: "/legal/refund", label: "Refund & Cancellation" },
          { href: "/legal/privacy", label: "Privacy" },
        ]}
      >
        {/* Our own approved legal copy, generated from the live ASN site (not user input). */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </LegalShell>
    </SitePage>
  );
}
