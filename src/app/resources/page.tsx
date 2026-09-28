import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import ResourceKits from "@/components/site/ResourceKits";

/**
 * /resources: the ASN resource-library teaser (phase-one holdback: not in
 * the nav or the sitemap). The kit grid reads DMN's public /api/resources
 * (locked cards, metadata only) and renders an honest empty state while the
 * library is being built. Categories are the canon resource categories.
 */
export const metadata: Metadata = {
  title: "Resource Library",
  description:
    "A preview of the Aesthetic Success Network resource library: expert-built kits on pricing, consults, team, patient experience, marketing and operations, added weekly for members.",
  alternates: { canonical: "/resources" },
  robots: { index: false, follow: true },
};

const CATEGORIES = [
  { title: "Pricing & Margins", body: "Worksheets and audit checklists for pricing injectables, devices and packages without guessing." },
  { title: "Consult & Conversion", body: "Consult scripts, follow-up templates and before-and-after guidance that convert without pressure." },
  { title: "Team & Culture", body: "Interview guides, comp-plan templates and onboarding SOPs for injectors, estheticians and front desk." },
  { title: "Patient Experience", body: "Retention and membership-plan playbooks, review requests and the touches that keep patients coming back." },
  { title: "Marketing & Growth", body: "Campaign templates, referral programs and reputation systems that fill the calendar." },
  { title: "Operations & Compliance", body: "KPI dashboards, chart-audit checklists, medical-direction notes and vendor-vetting templates." },
];

export default function ResourcesPage() {
  return (
    <SitePage>
      <SiteNav />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Resource Library</span>
          <h1>
            New expert kits, <em>every week</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Training videos, action guides, checklists, worksheets and slide decks, built by
            working experts and matched to real practice problems. Full kits are a member
            benefit; here&rsquo;s a preview of what&rsquo;s inside.
          </p>
        </div>
      </header>

      <section id="categories">
        <div className="wrap center">
          <span className="kicker">What&rsquo;s in the library</span>
          <h2 className="title">
            Six categories. <em>Growing</em> every week.
          </h2>
          <div className="feature-grid--cards">
            {CATEGORIES.map((c) => (
              <div key={c.title} className="feat">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Latest kits</span>
          <h2 className="title">
            A preview of what&rsquo;s <em>live</em> right now.
          </h2>
          <ResourceKits />
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Unlock the full <em>library</em>.
          </h2>
          <p className="lead2">
            Every kit, every week, included with membership. Founding membership is $49/mo, locked
            while your membership stays active.
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center" }}>
            <Link className="btn bronze" href="/join/member">
              Start your membership
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .feature-grid--cards .feat, .final h2, .final .lead2"
        grids={[".resource-grid"]}
      />
    </SitePage>
  );
}
