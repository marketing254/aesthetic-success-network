import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      meta={
        'Aesthetic Success Network, operated by Ekwa Marketing Inc. ("ASN", "we", "us") · Last updated: July 11, 2026'
      }
      footerLinks={[
        { href: "/member-agreement", label: "Member Agreement" },
        { href: "/refund-policy", label: "Refund & Cancellation" },
      ]}
    >
      <h2>
        <span className="n">01</span>No patient data, ever
      </h2>
      <p>
        ASN is a business education and services platform, not a clinical one. We do not collect,
        store, or process patient health information, PHI, clinical records, or any patient data
        of any kind. Nothing in our membership, Hotline, forms, or content involves patient
        records.
      </p>

      <h2>
        <span className="n">02</span>What we collect
      </h2>
      <ul>
        <li>
          Account and waitlist details you give us: name, email, phone, practice name, role, number
          of locations, and what you tell us about your business challenges.
        </li>
        <li>
          Expert and partner application details: contact information, company details, topics,
          bios, links, and uploaded assets such as logos or headshots.
        </li>
        <li>Hotline voicemails and the written replies we send you.</li>
        <li>
          Billing data, handled by secure third-party payment processors; we do not store full card
          numbers.
        </li>
        <li>Basic usage analytics for the site and, once live, the member portal.</li>
      </ul>

      <h2>
        <span className="n">03</span>How we use it
      </h2>
      <p>
        To deliver the membership (including routing Hotline questions to fitting experts), process
        payments, send membership communications, respond to support requests, improve the network,
        and meet legal obligations. Marketing emails always include an opt-out.
      </p>

      <h2>
        <span className="n">04</span>Sharing
      </h2>
      <p>
        We do not sell or trade personal information. We share it only with service providers who
        help us operate (payment processors, email providers, analytics), with partners or experts
        when you ask to be connected as part of a Hotline referral or lead, and when required by
        law. Providers receiving a lead may use your contact details only to respond to and service
        that lead.
      </p>

      <h2>
        <span className="n">05</span>Security
      </h2>
      <p>
        We use encryption in transit (SSL/TLS), secure payment processing, and access controls, and
        we review our practices regularly. No method of transmission or storage is 100% secure, and
        we cannot guarantee absolute security.
      </p>

      <h2>
        <span className="n">06</span>Cookies
      </h2>
      <p>
        The site uses cookies for session management, preferences, and analytics. You can control
        cookies in your browser settings.
      </p>

      <h2>
        <span className="n">07</span>Your rights
      </h2>
      <p>
        You may request access to, correction of, or deletion of your data, opt out of marketing,
        or request a copy of your data by emailing{" "}
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>.
        We respond within 30 days.
      </p>

      <h2>
        <span className="n">08</span>Contact
      </h2>
      <p>
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>{" "}
        &middot; (855) 567-5323.
      </p>
    </LegalShell>
  );
}
