import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";

/**
 * /reviews: honest empty state in the ASN design.
 *
 * ASN canon: no review may be reused from Ekwa, Business of Aesthetics or
 * any other source, and none may be invented. Until verified member reviews
 * exist, this page says exactly that. When the first verified reviews
 * arrive, add a REVIEWS array here and render it; never seed placeholders.
 */
export const metadata: Metadata = {
  title: "Member Reviews",
  description:
    "Aesthetic Success Network publishes only verified member reviews. None are published yet; this page will carry them as the network grows.",
  alternates: { canonical: "/reviews" },
};

export default function ReviewsPage() {
  return (
    <SitePage>
      <SiteNav active="/reviews" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Member Reviews</span>
          <h1>
            Verified member reviews will appear here <em>once we have them</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Aesthetic Success Network publishes only verified reviews from active members. The
            network is new and none are published yet. We will not borrow reviews from other
            companies or programs, and we will not invent any.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap center">
          <span className="kicker">In the meantime</span>
          <h2 className="title">
            Judge the membership on <em>what it includes</em>.
          </h2>
          <p className="lead">
            The Expert Hotline, the resource library of expert kits, member-only company offers
            and the tools are all listed on the pricing page, with a 30-day money-back guarantee.
            Founding membership is $29 a month for the first 100 members.
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
            <Link className="btn bronze" href="/pricing">
              See membership pricing
            </Link>
            <Link className="btn ghost" href="/#join">
              Join the waitlist
            </Link>
          </div>
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Add your own <em>founding review</em>.
          </h2>
          <p className="lead2">
            Join now and tell us how it&rsquo;s going once you&rsquo;ve put the network to work.
            As members share their experience, their reviews will be added to this page.
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center" }}>
            <Link className="btn bronze" href="/join/member">
              Start your membership
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx revealSelector="section .kicker, h2.title, .lead, .final h2, .final .lead2" />
    </SitePage>
  );
}
