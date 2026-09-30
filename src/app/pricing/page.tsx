import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import PricingTiers from "@/components/site/PricingTiers";
import JsonLd from "@/components/seo/JsonLd";
import {
  FOUNDING_MEMBER_CAP,
  PLAN_DISPLAY,
  EXPERT_PLAN_DISPLAY,
  PARTNER_PLAN_DISPLAY,
} from "@/lib/stripe";

// /pricing in the ASN design. Member tiers: Founding ($29/mo or $290/yr,
// first 100, open/closed from /api/stripe/availability) then Standard
// ($99/mo or $990/yr). There is NO "early" tier. Experts: $0
// months 1 to 6, then $39/month for good (no month-13 step). Companies:
// $39 months 1 to 12 from the day the card is added, then $149 from
// month 13 (no free period). Every member CTA starts the DMN signup at
// /join/member.

const SITE = "https://www.aestheticsuccessnetwork.com";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Aesthetic Success Network pricing: founding membership at $29/mo (first 100) then $99/mo, plus the expert and company programs. No hidden fees, no four-figure coaching upsell.",
  alternates: { canonical: "/pricing" },
};

// Product + Offer JSON-LD, carried over from the DMN pricing page: one
// Product per audience so search engines and AI assistants can extract the
// pricing without rendering the page.
const PRICING_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "Aesthetic Success Network: Founding Membership",
      description:
        "Membership for aesthetic practice owners. Expert Hotline returning a written action plan in 2 to 3 business days, member-only company offers, and a growing resource library of expert kits.",
      brand: { "@type": "Brand", name: "Aesthetic Success Network" },
      image: `${SITE}/asn-logo-full-dark.png`,
      url: `${SITE}/pricing`,
      offers: [
        {
          "@type": "Offer",
          name: "Founding Member · Monthly",
          price: "49.00",
          priceCurrency: "USD",
          url: `${SITE}/join?intent=founding&interval=monthly`,
          availability: "https://schema.org/LimitedAvailability",
          eligibleQuantity: { "@type": "QuantitativeValue", maxValue: 100 },
        },
        {
          "@type": "Offer",
          name: "Founding Member · Annual",
          price: "490.00",
          priceCurrency: "USD",
          url: `${SITE}/join?intent=founding&interval=annual`,
          availability: "https://schema.org/LimitedAvailability",
        },
        {
          "@type": "Offer",
          name: "Standard Member · Monthly",
          price: "199.00",
          priceCurrency: "USD",
          url: `${SITE}/join?intent=standard&interval=monthly`,
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Standard Member · Annual",
          price: "1990.00",
          priceCurrency: "USD",
          url: `${SITE}/join?intent=standard&interval=annual`,
          availability: "https://schema.org/InStock",
        },
      ],
    },
    {
      "@type": "Product",
      name: "Aesthetic Success Network: Expert Bench",
      description:
        "Featured spot on the ASN expert bench for coaches, consultants and educators serving aesthetic practices. We produce your content kits, surface them in the member library, and route warm leads to your calendar. Sell your own courses and keep 70%.",
      brand: { "@type": "Brand", name: "Aesthetic Success Network" },
      image: `${SITE}/asn-logo-full-dark.png`,
      url: `${SITE}/pricing`,
      offers: [
        { "@type": "Offer", name: "Expert Launch: months 1 to 6", price: "0.00", priceCurrency: "USD", url: `${SITE}/experts` },
        { "@type": "Offer", name: "Expert: month 7 onward", price: "39.00", priceCurrency: "USD", url: `${SITE}/experts` },
      ],
    },
    {
      "@type": "Product",
      name: "Aesthetic Success Network: Featured Company",
      description:
        "Featured company placement for companies serving aesthetic practices. Same Featured Company benefits across all phases, plus refer-and-earn $50 per referred member, paid after their first payment.",
      brand: { "@type": "Brand", name: "Aesthetic Success Network" },
      image: `${SITE}/asn-logo-full-dark.png`,
      url: `${SITE}/pricing`,
      offers: [
        { "@type": "Offer", name: "Company Launch: months 1 to 12", price: "39.00", priceCurrency: "USD", url: `${SITE}/companies` },
        { "@type": "Offer", name: "Company Standard: month 13 onward", price: "149.00", priceCurrency: "USD", url: `${SITE}/companies` },
      ],
    },
  ],
};

export default function PricingPage() {
  return (
    <SitePage>
      <JsonLd data={PRICING_JSONLD} />
      <SiteNav active="/pricing" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Pricing</span>
          <h1>
            One membership. <em>One</em> honest price.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            The first {FOUNDING_MEMBER_CAP} founding members lock in ${PLAN_DISPLAY.founding_monthly.amount}
            /mo for as long as their membership stays active. After that, it&rsquo;s $
            {PLAN_DISPLAY.standard_monthly.amount}/mo. No hidden fees, no four-figure coaching upsell
            hiding behind the door.
          </p>
        </div>
      </header>

      <section className="pricing" id="members">
        <div className="wrap center">
          <span className="kicker">Members</span>
          <h2 className="title">
            Locked in <em>while your membership stays active</em>.
          </h2>
          <p className="lead">
            {FOUNDING_MEMBER_CAP} founding seats, then the standard rate. Your rate never goes up
            once you&rsquo;re in. Cancel anytime, 30-day money-back guarantee.
          </p>
          <PricingTiers />
          <p className="guarantee">
            <b>Every membership includes:</b> the Expert Hotline (a written action plan in 2 to 3
            business days), the resource library of expert kits, templates and checklists, every
            member-only company deal, the practice calculators, monthly live AMAs and CE, and a
            growing bench of experts.
          </p>
        </div>
      </section>

      <section className="pricing-alt" id="experts">
        <div className="wrap center">
          <span className="kicker">Experts</span>
          <h2 className="title">
            Build first. Pay only as the value <em>compounds</em>.
          </h2>
          <p className="lead">
            Get set up, build your library and start getting leads before you pay a cent.
          </p>
          <div className="pgrid">
            <div className="pc hot">
              <div className="badge">Start here</div>
              <div className="tier">Months 1 to 6</div>
              <div className="price">$0</div>
              <div className="desc">Get set up and build your library first.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 7 onward</div>
              <div className="price">
                ${EXPERT_PLAN_DISPLAY.expert_growth_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">Locked rate as the leads start flowing. It stays $39, with no increase.</div>
            </div>
          </div>
          <p className="guarantee">
            <b>Paid courses:</b> you keep 70% &middot; Hotline referrals are routed by fit, never by
            payment
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
            <Link className="btn solid" href="/experts#apply">
              Apply as an expert &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="pricing" id="companies">
        <div className="wrap center">
          <span className="kicker">Companies</span>
          <h2 className="title">
            $39 a month for your first year. It pays for itself as <em>deals close</em>.
          </h2>
          <p className="lead">
            A locked launch rate for 12 months from the day you add a card, then the standard rate as the leads keep coming in.
          </p>
          <div className="pgrid">
            <div className="pc hot">
              <div className="badge">Launch</div>
              <div className="tier">Months 1 to 12</div>
              <div className="price">
                ${PARTNER_PLAN_DISPLAY.partner_growth_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">Get listed and start receiving leads. Your first $39 charge is the day you add a card.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 13 onward</div>
              <div className="price">
                ${PARTNER_PLAN_DISPLAY.partner_founding_standard_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">Standard rate.</div>
            </div>
          </div>
          <p className="guarantee">
            <b>Refer and earn:</b> $50 per referred member, paid after their first payment &middot;
            Founding companies get priority placement
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
            <Link className="btn solid" href="/companies#apply">
              Become a company &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="wrap">
          <div className="center">
            <span className="kicker">Questions</span>
            <h2 className="title">Good to know</h2>
          </div>
          <div style={{ marginTop: 42 }}>
            <details open>
              <summary>Do prices ever go up on me?</summary>
              <p>
                No. Once you lock a rate, whether as a founding member or as an expert or company
                on the launch rate, that rate is yours for as long as you stay active. It never
                increases.
              </p>
            </details>
            <details>
              <summary>What happens after the founding seats fill?</summary>
              <p>
                New members join at the standard rate of $99/mo or $990/yr. Members who already
                locked in the founding rate keep it, no matter how the cap fills up around them.
              </p>
            </details>
            <details>
              <summary>Can I cancel anytime?</summary>
              <p>
                Yes. Every membership comes with a 30-day money-back guarantee and no long-term
                contract. Cancelling ends the price lock: if you rejoin later, it is at the
                then-current standard rate.
              </p>
            </details>
            <details>
              <summary>Is there a free period for experts and companies?</summary>
              <p>
                Experts pay nothing for months 1 to 6 from the day they&rsquo;re approved, then
                $39/mo, and it stays $39. Companies have no free period: they pay the $39/mo
                launch rate for months 1 to 12 from the day they add a card, then the standard
                rate of $149/mo from month 13.
              </p>
            </details>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .pc, .faq details"
        grids={[".pgrid"]}
      />
    </SitePage>
  );
}
