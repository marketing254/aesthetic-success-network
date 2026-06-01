import Link from "next/link";
import {
  hero,
  featuresSection,
  features,
  pricingSection,
  pricing,
  faqSection,
} from "@/content";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";
import Constellation from "@/components/Constellation";
import FoundingPanel from "@/components/FoundingPanel";
import Faq from "@/components/Faq";
import WaitlistSection from "@/components/WaitlistSection";

export default function Home() {
  return (
    <div className="shell">
      <SiteHeader />

      <main id="top">
        {/* HERO — Split Studio diptych over interactive network */}
        <section className="hero">
          <Constellation />
          <div className="wrap hero__grid">
            <div>
              <Reveal>
                <span className="hero__chip">
                  <span className="dot" aria-hidden="true" />
                  {hero.topChip}
                </span>
              </Reveal>
              <Reveal delay={60} as="h1">
                A <span className="swash">human expert</span> on the line for every practice
                problem.
              </Reveal>
              <Reveal delay={120}>
                <p className="hero__sub">{hero.subtitle}</p>
              </Reveal>
              <Reveal delay={180}>
                <div className="hero__actions">
                  <Link className="btn" href="#waitlist">
                    Join the waitlist
                  </Link>
                  <Link className="textlink" href="#features">
                    See what&rsquo;s inside
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={240}>
                <p className="hero__note">{hero.bottomNote}</p>
              </Reveal>
            </div>
            <Reveal delay={160}>
              <Tilt>
                <FoundingPanel />
              </Tilt>
            </Reveal>
          </div>
        </section>

        {/* FEATURES — numbered editorial list */}
        <section className="section" id="features">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">{featuresSection.eyebrow}</span>
              <h2>
                The difference is <span className="em">curation</span>, not catalog.
              </h2>
              <p>{featuresSection.subtitle}</p>
            </Reveal>
            <div className="features__list">
              {features.map((f) => (
                <Reveal className="feature" key={f.title}>
                  <span className="feature__index">{f.index}</span>
                  <div className="feature__body">
                    <h3>{f.title}</h3>
                    <p>{f.summary}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING — member + vendor partner tiers */}
        <section className="section" id="pricing" style={{ background: "var(--color-paper-2)" }}>
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">{pricingSection.eyebrow}</span>
              <h2>{pricingSection.title}</h2>
              <p>{pricingSection.subtitle}</p>
            </Reveal>
            <div className="pricing__grid">
              {pricing.map((plan) => (
                <Reveal key={plan.tier}>
                  <Tilt max={5}>
                    <div className={`plan${plan.highlight ? " plan--feature" : ""}`}>
                      <span className="plan__tier">{plan.tier}</span>
                      <span className="plan__audience">{plan.audience}</span>
                      <div className="plan__price">
                        <span className="amt">{plan.price}</span>
                        <span className="cad">{plan.cadence}</span>
                      </div>
                      {plan.regularNote && <p className="plan__note">{plan.regularNote}</p>}
                      <p className="plan__blurb">{plan.blurb}</p>
                      <ul className="plan__features">
                        {plan.features.map((feat) => (
                          <li key={feat}>{feat}</li>
                        ))}
                      </ul>
                      <div className="plan__cta">
                        <Link
                          className={`btn ${plan.highlight ? "btn--gold" : "btn--ghost"}`}
                          href="#waitlist"
                        >
                          {plan.cta}
                        </Link>
                      </div>
                    </div>
                  </Tilt>
                </Reveal>
              ))}
            </div>
            <p className="pricing__note">{pricingSection.bottomNote}</p>
          </div>
        </section>

        {/* WAITLIST — tabbed member / vendor form on dark slab */}
        <WaitlistSection />

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="wrap faq__grid">
            <Reveal className="section-head" as="div">
              <span className="eyebrow">{faqSection.eyebrow}</span>
              <h2>{faqSection.title}</h2>
              <p>{faqSection.subtitle}</p>
            </Reveal>
            <Reveal>
              <Faq />
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
