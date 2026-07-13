import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";

export const metadata: Metadata = {
  title: "Member Agreement",
  robots: { index: false, follow: false },
};

export default function MemberAgreementPage() {
  return (
    <LegalShell
      title="Member Agreement"
      meta={
        'Aesthetic Success Network, operated by Ekwa Marketing Inc. ("ASN", "we", "us") · Last updated: July 11, 2026'
      }
      footerLinks={[
        { href: "/refund-policy", label: "Refund & Cancellation" },
        { href: "/privacy", label: "Privacy" },
      ]}
    >
      <p>
        This agreement governs your membership in the Aesthetic Success Network. By joining as a
        member you agree to the terms below.
      </p>

      <h2>
        <span className="n">01</span>Membership benefits
      </h2>
      <p>
        Your membership includes access to the Expert Hotline, a growing resource library with new
        expert kits added regularly, exclusive member-only deals from vetted partners, and live AMA
        and continuing-education sessions. Content and features may be modified at our discretion
        with reasonable notice.
      </p>

      <h2>
        <span className="n">02</span>The Expert Hotline
      </h2>
      <p>
        The Hotline works as follows: you call our toll-free line, (855) 567-5323, and leave a
        voicemail describing your question. Our team, assisted by AI tools, reviews it and replies
        in writing by text and email within 2&ndash;3 business days with a recommended solution and
        typically 3&ndash;4 experts to contact. The Hotline is not a live or 24/7 helpline, and it
        provides business guidance only: nothing from the Hotline constitutes legal, financial,
        tax, clinical, or insurance advice. Expert referrals are routed by fit, never by payment.
      </p>

      <h2>
        <span className="n">03</span>Account access and sharing
      </h2>
      <p>
        Membership is tied to you and your practice. Staff within your registered practice may use
        your access. Credentials may not be shared outside your practice, and we may monitor usage
        patterns for inappropriate sharing.
      </p>

      <h2>
        <span className="n">04</span>Pricing, auto-renewal, and the founding rate
      </h2>
      <p>
        Founding members (the first 100) pay $49 per month, or $490 per year (two months free), and
        that rate never increases while the membership remains continuously active. If your
        membership lapses or is cancelled, the price lock ends, and rejoining is at the standard
        rate of $199 per month. Memberships renew automatically unless cancelled before the renewal
        date; we send renewal reminders in advance.
      </p>

      <h2>
        <span className="n">05</span>Content usage rights
      </h2>
      <p>
        You may stream member content for your professional development and download templates,
        worksheets, and documents for use inside your own practice. You may not record or
        screen-capture content, redistribute it, upload it to other platforms, or use it to create
        competing products.
      </p>

      <h2>
        <span className="n">06</span>Partner deals and savings
      </h2>
      <p>
        Partner offers are negotiated for members collectively. Any savings figures we discuss are
        estimates or illustrations, individual results vary, and no savings are guaranteed.
        Transactions with partners are between you and the partner; ASN is not a party to them.
      </p>

      <h2>
        <span className="n">07</span>Member conduct
      </h2>
      <p>
        The network must be used professionally. Harassment, misleading content, uses unrelated to
        the network&rsquo;s purpose, and attempts to circumvent security are prohibited and can
        result in termination without refund.
      </p>

      <h2>
        <span className="n">08</span>Disclaimer
      </h2>
      <p>
        Network content does not constitute legal, financial, tax, clinical, or insurance advice.
        Results are not guaranteed. We do not collect, store, or process patient data of any kind;
        ASN is a business education and services platform, not a clinical one.
      </p>

      <h2>
        <span className="n">09</span>Termination
      </h2>
      <p>
        We may terminate memberships for violations of these terms, unauthorized credential
        sharing, or payment failure. Terminations for violations are not refunded. Access
        interrupted by a failed payment is restored when payment is resolved, subject to the Refund
        &amp; Cancellation Policy.
      </p>

      <h2>
        <span className="n">10</span>Contact
      </h2>
      <p>
        Questions about this agreement:{" "}
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a> or
        (855) 567-5323.
      </p>
    </LegalShell>
  );
}
