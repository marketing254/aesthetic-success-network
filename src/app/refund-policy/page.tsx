import type { Metadata } from "next";
import LegalShell from "@/components/site/LegalShell";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  robots: { index: false, follow: false },
};

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Refund & Cancellation Policy"
      meta={
        'Aesthetic Success Network, operated by Ekwa Marketing Inc. ("ASN", "we", "us") · Last updated: July 11, 2026'
      }
      footerLinks={[
        { href: "/member-agreement", label: "Member Agreement" },
        { href: "/privacy", label: "Privacy" },
      ]}
    >
      <h2>
        <span className="n">01</span>30-day money-back guarantee
      </h2>
      <p>
        New members can request a full refund within 30 days of first enrollment. The guarantee
        applies to first-time sign-ups, not renewals. To request it, email{" "}
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>{" "}
        with the subject line &ldquo;30-Day Refund Request&rdquo;. Refunds are processed within
        5&ndash;10 business days.
      </p>

      <h2>
        <span className="n">02</span>Cancelling a membership
      </h2>
      <p>
        <b>Monthly plans:</b> cancel anytime; cancellation takes effect at the end of the current
        billing cycle. You keep access through that period. Partial-month refunds are not available
        outside the 30-day guarantee.
      </p>
      <p>
        <b>Annual plans:</b> cancel anytime. Within the first 30 days you receive a full refund.
        After day 30, cancellation takes effect at the end of the annual period, without pro-rated
        refunds.
      </p>
      <p>Cancellations are processed within 1&ndash;2 business days of your request.</p>

      <h2>
        <span className="n">03</span>Founding-rate protection
      </h2>
      <p>
        The founding rate ($49 per month or $490 per year, first 100 members) stays locked for as
        long as the membership remains continuously active. If you cancel or your membership
        lapses, the founding rate is forfeited; rejoining is at the standard rate of $199 per
        month.
      </p>

      <h2>
        <span className="n">04</span>Payment failures
      </h2>
      <p>
        Failed payments are retried three times over 10 days, with email alerts. After the retries,
        the account is suspended (access pauses; the membership is not yet cancelled), and you have
        30 days to update payment details. Beyond 30 days the membership is cancelled
        automatically, and founding members forfeit the founding rate.
      </p>

      <h2>
        <span className="n">05</span>Refund exceptions
      </h2>
      <ul>
        <li>Terminations caused by violations of the Member Agreement are not refunded.</li>
        <li>
          The 30-day guarantee cannot be claimed twice; re-enrollments after a refunded membership
          are not eligible.
        </li>
        <li>Requests outside the 30-day window follow the standard cancellation terms above.</li>
      </ul>

      <h2>
        <span className="n">06</span>Partner cancellation
      </h2>
      <p>
        During the free founding period (months 1&ndash;6) cancellation carries no cost. During
        paid periods ($49 per month for months 7&ndash;12, $199 per month from month 13), cancel
        with 30 days&rsquo; written notice, effective at the end of the billing period. The initial
        term is 12 months; early exit within it may incur the remaining balance unless agreed
        otherwise in writing. On cancellation, the partner listing is removed within 5 business
        days; member deals already published are honored to their stated expiration dates.
        Reactivating partners rejoin at then-current standard pricing.
      </p>

      <h2>
        <span className="n">07</span>Expert cancellation
      </h2>
      <p>
        During the free period (months 1&ndash;6) cancellation is cost-free. During paid periods,
        cancel with 30 days&rsquo; written notice, effective at the end of the billing period.
        Expert kits are unpublished from the member library on the effective date. Purchasers of
        paid courses keep access; the 70/30 course revenue split applies to revenue collected
        before the effective date, and final payouts are processed within 30 days.
      </p>

      <h2>
        <span className="n">08</span>Contact
      </h2>
      <p>
        <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>{" "}
        &middot; (855) 567-5323 &middot; Monday&ndash;Friday, 9 AM&ndash;5 PM EST. We reply within
        one business day.
      </p>
    </LegalShell>
  );
}
