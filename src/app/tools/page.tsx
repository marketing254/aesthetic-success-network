import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import Calculator from "@/components/site/Calculator";
import MarginCalculator from "@/components/site/MarginCalculator";
import ConversionCalculator from "@/components/site/ConversionCalculator";

export const metadata: Metadata = {
  title: "Free Tools & Calculators",
  description:
    "Free calculators for aesthetic practice owners: vendor-deal ROI, injectable margin and consult-conversion revenue impact. No signup required.",
};

export default function ToolsPage() {
  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/tools", label: "Tools", active: true },
          { href: "/resources", label: "Resources" },
          { href: "/pricing", label: "Pricing" },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Free Tools</span>
          <h1>
            Run the numbers <em>yourself</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Three calculators built for aesthetic practices. Free, no signup, no email gate. Set
            your own assumptions and see what changes.
          </p>
        </div>
      </header>

      <section id="deal-math">
        <div className="wrap center">
          <span className="kicker">Membership ROI</span>
          <h2 className="title">
            Do the <em>membership</em> math.
          </h2>
          <p className="lead">
            If the vendor deals alone don&rsquo;t clear the membership cost, don&rsquo;t join.
            That&rsquo;s the honest test.
          </p>
          <Calculator />
        </div>
      </section>

      <section id="margin-calc" style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Injectable Margin</span>
          <h2 className="title">
            Are you actually making money <em>per syringe</em>?
          </h2>
          <p className="lead">
            Plug in your real cost and price per unit to see profit and margin per treatment.
          </p>
          <MarginCalculator />
        </div>
      </section>

      <section id="conversion-calc" style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Consult Conversion</span>
          <h2 className="title">
            What&rsquo;s a better <em>close rate</em> worth?
          </h2>
          <p className="lead">
            See the monthly and annual revenue impact of lifting your same-day close rate, holding
            lead volume flat.
          </p>
          <ConversionCalculator />
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Want the <em>plan</em>, not just the math?
          </h2>
          <p className="lead2">
            The Expert Hotline turns numbers like these into a written action plan in 2&ndash;3
            business days.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <a className="btn bronze" href="/#join">
              Join the founding waitlist
            </a>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/resources", label: "Resources" },
          { href: "/pricing", label: "Pricing" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .calc, .final h2, .final .lead2"
      />
    </>
  );
}
