import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import Calculator from "@/components/site/Calculator";
import MarginCalculator from "@/components/site/MarginCalculator";
import ConversionCalculator from "@/components/site/ConversionCalculator";
import { MEMBER_TOOLS, TOOL_CATEGORIES, isPublicTool } from "@/lib/toolsData";

/**
 * /tools in the ASN design: the three member tools from lib/toolsData as CSS
 * placeholder tiles (no screenshot previews ship with ASN), each opening its
 * locked preview at /tools/[id], followed by the three inline calculators the
 * previous ASN site offered as free previews (illustrative; the full member
 * versions with PDF export live in the portal).
 */
export const metadata: Metadata = {
  title: "Free Tools & Calculators",
  description:
    "Calculators for aesthetic practice owners: membership ROI, treatment margin and consult-conversion revenue impact. Free previews; members run the full versions.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <SitePage>
      <SiteNav active="/tools" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Tools</span>
          <h1>
            Run the numbers <em>yourself</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            {MEMBER_TOOLS.length} practice calculators built for aesthetic practices: treatment
            margins, consult conversion and the membership math itself. Try the free previews
            below; members run the full versions with their own numbers and download the results.
          </p>
        </div>
      </header>

      <section id="directory">
        <div className="wrap center">
          <span className="kicker">Member tools</span>
          <h2 className="title">
            Included with <em>membership</em>.
          </h2>
          <div className="tool-grid">
            {MEMBER_TOOLS.map((t) => {
              const color = TOOL_CATEGORIES.find((c) => c.name === t.category)?.color ?? "#0a1320";
              return (
                <Link
                  key={t.id}
                  className="tool-tile"
                  href={`/tools/${t.id}`}
                  style={{ ["--tt" as string]: color } as React.CSSProperties}
                >
                  <div className="tt-art" aria-hidden>
                    <span className="tt-cat">{t.category}</span>
                    <span className="tt-title">{t.title}</span>
                    <span className="tt-lock">{isPublicTool(t.id) ? "Free to try" : "Members only"}</span>
                  </div>
                  <div className="tt-body">
                    <h3>{t.title}</h3>
                    <p>{t.blurb}</p>
                    <div className="tt-by">
                      Built by <b>{t.expert ?? "ASN"}</b>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section id="deal-math" className="math">
        <div className="wrap center">
          <span className="kicker">Free preview &middot; Membership ROI</span>
          <h2 className="title">
            Do the <em>membership</em> math.
          </h2>
          <p className="lead">
            If the partner deals alone don&rsquo;t clear the membership cost, don&rsquo;t join.
            That&rsquo;s the honest test. Illustrative only.
          </p>
          <Calculator />
        </div>
      </section>

      <section id="margin-calc">
        <div className="wrap center">
          <span className="kicker">Free preview &middot; Treatment margin</span>
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
          <span className="kicker">Free preview &middot; Consult conversion</span>
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
            The Expert Hotline turns numbers like these into a written action plan in 2 to 3
            business days. Founding membership is $29/mo, locked while your membership stays
            active.
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <Link className="btn bronze" href="/join/member">
              Start your membership
            </Link>
            <Link className="btn ghost" href="/pricing" style={{ color: "#f6f1e7", borderColor: "#5c5648" }}>
              See membership pricing
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .tool-tile, .calc, .final h2, .final .lead2"
        grids={[".tool-grid"]}
      />
    </SitePage>
  );
}
