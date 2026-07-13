import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";

export const metadata: Metadata = {
  title: "Provider Agreement (Experts & Partners)",
  robots: { index: false, follow: false },
};

export default function ProviderAgreementPage() {
  return (
    <LegalShell
      title="Provider Agreement"
      meta={
        'For Experts and Partners · Aesthetic Success Network, operated by Ekwa Marketing Inc. ("ASN", "we", "us") · Last updated: July 11, 2026'
      }
      footerLinks={[
        { href: "/member-agreement", label: "Member Agreement" },
        { href: "/refund-policy", label: "Refund & Cancellation" },
        { href: "/privacy", label: "Privacy" },
      ]}
    >
      <p>
        Expert and Partner are capabilities on one provider account; a provider can hold both. This
        agreement takes effect when you sign up as a provider and covers both capabilities.
        Sections 1&ndash;2 apply to Partners, Section 3 applies to Experts, and the remaining
        sections apply to all providers.
      </p>

      <h2>
        <span className="n">01</span>The five partner commitments
      </h2>
      <ol>
        <li>
          <b>Best deal:</b> offer ASN members an exclusive discount or benefit at least as good as
          any offer you make available to comparable customers. Improvements are welcome anytime;
          reductions require our written approval and notice to members.
        </li>
        <li>
          <b>Stay reachable:</b> maintain a responsive presence and respond to member leads within
          one business day.
        </li>
        <li>
          <b>Booking link:</b> supply and maintain a working booking link (for example Calendly or
          Cal.com).
        </li>
        <li>
          <b>Evolve with the network:</b> accept term changes made with 30 days&rsquo; advance
          notice; if a change materially reduces your benefits or increases your fees, you may
          terminate within the notice window with no further obligation.
        </li>
        <li>
          <b>Pay the fee:</b> $0 for months 1&ndash;6 (founding waiver), $49 per month for months
          7&ndash;12 (locked launch rate), $199 per month from month 13 (Featured Partner rate).
        </li>
      </ol>

      <h2>
        <span className="n">02</span>What partners receive
      </h2>
      <ul>
        <li>
          A vetted partner profile with your logo and your member-exclusive offer, placed in your
          category.
        </li>
        <li>Pre-qualified lead routing with a dashboard and conversion data.</li>
        <li>
          The Verified Partner badge for your marketing (the license to use it ends when this
          agreement ends).
        </li>
        <li>
          Podcast, webinar, and co-marketing features across the Business of Aesthetics network.
        </li>
      </ul>

      <h2>
        <span className="n">03</span>Expert terms
      </h2>
      <p>
        Experts share one recording (up to about one hour) of themselves teaching a topic, plus
        supporting details. We produce the content kit (training video, action guide, checklist,
        key takeaways, worksheet, slide deck, wall poster, and extras), and you approve it before
        it goes live under your profile. You keep ownership of your content and grant ASN a license
        to produce, host, and distribute the kits to members. Expert access pricing follows the
        same ramp as partners: $0 for months 1&ndash;6, then $49 per month, then $199 per month
        from month 13.
      </p>
      <p>
        Paid courses: you may list your own paid courses to members. You keep 70% of net course
        revenue; the network retains 30%. Payouts are processed monthly. Hotline referrals are
        routed by fit, never by payment.
      </p>

      <h2>
        <span className="n">04</span>Fees and payment
      </h2>
      <p>
        Invoices are due net 15. Fees are non-refundable except as stated in the Refund &amp;
        Cancellation Policy. Late amounts may accrue up to 1.5% per month. Annual prepay earns two
        months free.
      </p>

      <h2>
        <span className="n">05</span>Provider standards
      </h2>
      <p>
        You confirm that you comply with applicable laws and professional standards, that you have
        the rights to any content and marks you provide, that you will support members
        responsively, and that you will avoid conduct that damages the network&rsquo;s brand or its
        members&rsquo; trust.
      </p>

      <h2>
        <span className="n">06</span>Confidentiality and member data
      </h2>
      <p>
        Both parties protect the other&rsquo;s non-public information with reasonable care. Member
        contact details routed to you may be used only to respond to and service that lead. Selling
        member data or using it for unrelated marketing is prohibited, during and after the term.
      </p>

      <h2>
        <span className="n">07</span>Changes to terms
      </h2>
      <p>
        We may modify these terms with at least thirty (30) days&rsquo; prior written notice. If a
        change materially reduces your benefits or increases your fees, you may terminate within
        the notice window with no further obligation.
      </p>

      <h2>
        <span className="n">08</span>Term, renewal, and termination
      </h2>
      <p>
        The initial term is 12 months from signup, renewing automatically for successive 12-month
        terms unless either party gives 30 days&rsquo; non-renewal notice. Either party may
        terminate for convenience with 30 days&rsquo; written notice. Either party may terminate
        immediately for a material breach that remains uncured 15 days after written notice, for
        insolvency, or for conduct that materially harms the network. On termination: the profile
        is removed, the badge license ends, and unpaid fees become due. Expert kits are unpublished
        from the member library; purchasers of paid courses retain access, and final course payouts
        are processed within 30 days.
      </p>

      <h2>
        <span className="n">09</span>Disclaimers and liability
      </h2>
      <p>
        We do not guarantee any specific number of leads, conversion rate, or revenue outcome.
        Neither party is liable for indirect or consequential damages or lost profits. Our
        cumulative liability is capped at the total fees you paid in the preceding 12 months. You
        indemnify ASN against third-party claims arising from your products, services, sales
        practices, or breach of this agreement.
      </p>

      <h2>
        <span className="n">10</span>Miscellaneous
      </h2>
      <p>
        The parties are independent contractors. No assignment without consent. This is the entire
        agreement; changes happen per Section 07 or by signed amendment. Electronic signatures are
        effective. Governing law: to be confirmed at legal review.
      </p>

      <h2>
        <span className="n">11</span>Contact
      </h2>
      <p>
        Questions about this agreement:{" "}
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a> or
        (855) 567-5323.
      </p>
    </LegalShell>
  );
}
