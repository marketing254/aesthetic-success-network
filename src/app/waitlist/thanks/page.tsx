import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";

export const metadata: Metadata = {
  title: "You're on the list",
  description: "You're on the Aesthetic Success Network founding waitlist. We'll be in touch.",
  robots: { index: false, follow: true },
};

/**
 * /waitlist/thanks — standalone confirmation page. The homepage's
 * WaitlistForm shows an inline "you're on the list" state on success
 * (unchanged, to avoid disrupting that established flow); this route
 * exists as a direct, linkable destination for anywhere else that
 * wants to send someone here after joining the waitlist (email links,
 * ad campaigns, etc.).
 */
export default function WaitlistThanksPage() {
  return (
    <>
      <SiteNav links={[{ href: "/", label: "Aesthetic Success Network" }]} cta={{ href: "/pricing", label: "See pricing" }} />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">You&rsquo;re In</span>
          <h1>
            You&rsquo;re on the <em>founding waitlist</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            No payment today, no spam. We&rsquo;ll reach out as founding spots open, and
            you&rsquo;ll confirm before any charge.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap center">
          <div className="feature-grid--cards">
            <div className="feat">
              <h3>While you wait</h3>
              <p>Read a few articles from the blog, or run the membership math yourself.</p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn ghost" href="/blog">
                  Read the blog
                </a>
              </div>
            </div>
            <div className="feat">
              <h3>Know an expert?</h3>
              <p>
                If you know someone who teaches aesthetics practice operations well, send them
                our way.
              </p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn ghost" href="/experts">
                  For experts
                </a>
              </div>
            </div>
            <div className="feat">
              <h3>Know a vendor?</h3>
              <p>Practices you know might want the deal our partners bring to members.</p>
              <div className="cta-row" style={{ marginTop: 18 }}>
                <a className="btn ghost" href="/partners">
                  For partners
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter links={[{ href: "/pricing", label: "Pricing" }, { href: "/privacy", label: "Privacy" }]} />

      <PageFx revealSelector="section .feature-grid--cards .feat" grids={[".feature-grid--cards"]} />
    </>
  );
}
