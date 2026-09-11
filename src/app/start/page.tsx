import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";

/**
 * /start — a lightweight, ad-traffic-friendly "get started" hub.
 *
 * TD's /start was a dedicated Meta paid-ads landing page wired into
 * Meta pixel/CAPI tracking that ASN doesn't have. Rather than force
 * that infrastructure in, this is a generic entry point suited to any
 * campaign link: three honest doors (member / expert / partner), fully
 * static so it's cheap to serve at traffic-spike volume, noindex since
 * it's a traffic-routing page, not organic content.
 */
export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Three ways into the Aesthetic Success Network: join as a member, apply as an expert, or apply as a partner.",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return (
    <>
      <SiteNav links={[{ href: "/", label: "Aesthetic Success Network" }]} cta={{ href: "/#join", label: "Join the waitlist" }} />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Get Started</span>
          <h1>
            One network. <em>Three</em> honest doors.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Tell us which one is you, and we&rsquo;ll take you straight there.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="feature-grid--cards">
            <div className="feat">
              <h3>I own or run a practice</h3>
              <p>
                Join the founding waitlist for the Expert Hotline, the resource library and
                member-only partner deals. $49/mo, locked for life while active.
              </p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn bronze" href="/#join">
                  Join the waitlist &rarr;
                </a>
              </div>
            </div>
            <div className="feat">
              <h3>I&rsquo;m an expert or coach</h3>
              <p>
                Share one recording; we build your content kit and send warm leads to your
                calendar. Free for the first six months.
              </p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn solid" href="/experts#apply">
                  Apply as an expert &rarr;
                </a>
              </div>
            </div>
            <div className="feat">
              <h3>I sell to aesthetic practices</h3>
              <p>
                Get in front of engaged buyers through a trusted shortlist, not a cold ad. Free
                for the first six months.
              </p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn solid" href="/partners#apply">
                  Apply as a partner &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />

      <PageFx revealSelector="section .kicker, .feature-grid--cards .feat" grids={[".feature-grid--cards"]} />
    </>
  );
}
