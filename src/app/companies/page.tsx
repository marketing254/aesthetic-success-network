import type { Metadata } from "next";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import PartnerForm from "@/components/site/PartnerForm";
import PartnerDirectory from "@/components/site/PartnerDirectory";
import { vendorCategories } from "@/lib/vendorData";

// Copy source: the previous ASN site / _asn-source-copy/partners.html
// (approved ASN copy). The application form posts to DMN's
// /api/vendor/signup; the roster reads DMN's /api/directory/partners.
// Provider ramp per the ASN canon: $0 months 1 to 6, $49 months 7 to 12,
// $199 from month 13. Referral: $50 per referred member, paid after their
// first payment.

export const metadata: Metadata = {
  title: "Become a Company",
  description:
    "Get in front of aesthetics' most engaged buyers through a trusted shortlist instead of a cold ad. Free for the first six months; the channel pays for itself as deals close.",
  alternates: { canonical: "/companies" },
};

const RECRUITED_CATEGORIES = vendorCategories.filter((c) => c !== "Other");

export default function PartnersPage() {
  return (
    <SitePage>
      <SiteNav active="/companies" />

      <header className="hero hero--partners" id="top">
        <div className="wrap">
          <div>
            <span className="eyebrow">For Companies &middot; Company Network</span>
            <h1>
              Get in front of aesthetics&rsquo; most engaged buyers through a{" "}
              <em>trusted shortlist</em>, not a cold ad.
            </h1>
            <p className="sub">
              Reach practice owners who are actively investing in their practice. Pay nothing for
              six months. The channel pays for itself as deals close.
            </p>
            <div className="cta-row">
              <a className="btn bronze" href="#apply">
                Apply to be a company
              </a>
              <a className="btn ghost" href="#how">
                See how it works
              </a>
            </div>
            <div className="micro">
              Founding companies get priority placement &middot; Limited per category.
            </div>
          </div>
          <div className="hero-art">
            <div className="arc"></div>
            <div className="particles">
              <span style={{ top: "14%", left: "16%", animation: "floaty 6s ease-in-out infinite" }} />
              <span
                style={{
                  top: "74%",
                  left: "20%",
                  width: 4,
                  height: 4,
                  animation: "floaty 7.5s ease-in-out infinite .8s",
                }}
              />
              <span
                style={{ top: "24%", right: "14%", animation: "floaty 6.8s ease-in-out infinite .4s" }}
              />
            </div>
            <svg
              id="portrait"
              viewBox="0 0 480 600"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Verified company badge"
            >
              <path
                className="ln draw"
                d="M240 120 L344 158 V252 C344 324 298 368 240 394 C182 368 136 324 136 252 V158 Z"
              />
              <path
                className="ln-thin draw"
                d="M240 144 L322 174 V252 C322 310 286 346 240 368 C194 346 158 310 158 252 V174 Z"
              />
              <path className="ln draw" d="M198 252 L228 284 L294 208" />
              <path className="ln-thin draw" d="M212 392 L196 448 L224 430" />
              <path className="ln-thin draw" d="M268 392 L284 448 L256 430" />
              <path
                className="ln-blush"
                d="M380 168 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z"
                style={{ animation: "twinkle 4s ease-in-out infinite" }}
              />
              <path
                className="ln-blush"
                d="M118 250 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"
                style={{ animation: "twinkle 5s ease-in-out infinite 1s" }}
              />
            </svg>
          </div>
        </div>
      </header>

      <div className="powered">
        <div className="wrap">
          <span className="star">&#10022;</span>
          <span>
            Members come to you pre-qualified, through a recommendation they trust,{" "}
            <b>not an ad they scrolled past.</b>
          </span>
        </div>
      </div>

      <section id="directory" style={{ paddingBottom: 0 }}>
        <div className="wrap center">
          <span className="kicker">The roster</span>
          <h2 className="title">
            Meet the <em>companies</em>.
          </h2>
          <p className="lead">
            Vetted companies with a genuine member deal, curated by our team.
          </p>
          <PartnerDirectory />
        </div>
      </section>

      <section id="how">
        <div className="wrap center">
          <span className="kicker">How it works</span>
          <h2 className="title">
            Three steps to a <em>warm-lead</em> channel.
          </h2>
          <div className="steps3">
            <div className="stepc">
              <div className="n">01</div>
              <h3>You apply</h3>
              <p>Tell us your category and the exclusive deal you&rsquo;ll offer members.</p>
            </div>
            <div className="stepc">
              <div className="n">02</div>
              <h3>We vet and list you</h3>
              <p>
                A profile, a Verified Company badge, and searchable placement in your category,
                all curated by our team.
              </p>
            </div>
            <div className="stepc">
              <div className="n">03</div>
              <h3>Leads route to you</h3>
              <p>
                Member inquiries arrive with a dashboard and conversion data, so you can see the
                channel working.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">What you get</span>
          <h2 className="title">
            A trusted shortlist in front of <em>real</em> buyers.
          </h2>
          <div className="feature-grid--cards">
            <div className="feat">
              <h3>Profile + placement</h3>
              <p>A profile and searchable placement in your category, where members go looking.</p>
            </div>
            <div className="feat">
              <h3>Lead flow + dashboard</h3>
              <p>
                Member inquiries with a dashboard and conversion data. See exactly what&rsquo;s
                working.
              </p>
            </div>
            <div className="feat">
              <h3>Verified Company badge</h3>
              <p>
                The trust mark that tells members your deal is real and your listing is vetted.
              </p>
            </div>
            <div className="feat">
              <h3>Podcast and webinar features</h3>
              <p>Features and event slots across the Business of Aesthetics network.</p>
            </div>
            <div className="feat">
              <h3>Co-marketing</h3>
              <p>Co-branded case studies and newsletter mentions that compound over time.</p>
            </div>
            <div className="feat">
              <h3>Referral rewards</h3>
              <p>
                Earn $50 for each practice owner you refer, paid after their first payment.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-alt" id="pricing">
        <div className="wrap center">
          <span className="kicker">What it costs</span>
          <h2 className="title">
            Free for six months. It pays for itself as <em>deals close</em>.
          </h2>
          <p className="lead">
            Prove the channel before you pay, then keep a locked launch rate as the leads come in.
          </p>
          <div className="pgrid">
            <div className="pc hot">
              <div className="badge">Founding</div>
              <div className="tier">Months 1 to 6</div>
              <div className="price">$0</div>
              <div className="desc">Get listed and start receiving leads, free.</div>
            </div>
            <div className="pc">
              <div className="tier">Months 7 to 12</div>
              <div className="price">
                $49<span>/mo</span>
              </div>
              <div className="desc">Founding locked rate.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 13+</div>
              <div className="price">
                $199<span>/mo</span>
              </div>
              <div className="desc">
                Featured Company standard rate, or $1,990/yr annual (two months free).
              </div>
            </div>
          </div>
          <p className="guarantee">
            <b>Refer and earn:</b> $50 per referred member, paid after their first payment &middot;{" "}
            <b>Founding companies</b> get priority placement.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap center">
          <span className="kicker">What you commit to</span>
          <h2 className="title">
            Five commitments that keep the network <em>trusted</em>.
          </h2>
          <div className="commitgrid">
            <div className="cc">
              <div className="n">01</div>
              <p>
                Give members your best deal: an exclusive discount at least as good as any offer
                you make comparable customers.
              </p>
            </div>
            <div className="cc">
              <div className="n">02</div>
              <p>Stay reachable and respond to member leads within one business day.</p>
            </div>
            <div className="cc">
              <div className="n">03</div>
              <p>Provide a booking link so members can reach you directly.</p>
            </div>
            <div className="cc">
              <div className="n">04</div>
              <p>Evolve with the network, with 30 days&rsquo; notice on changes to your offer.</p>
            </div>
            <div className="cc">
              <div className="n">05</div>
              <p>Pay the fee after your free period.</p>
            </div>
          </div>
          <p className="guarantee">
            The full terms are in the <a href="/agreement/provider">Provider Agreement</a>.
          </p>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Who we&rsquo;re recruiting</span>
          <h2 className="title">
            Limited spots <em>per category</em>.
          </h2>
          <p className="lead">
            We vet and list companies per category, so spots are limited. If your category is on
            this list, apply early.
          </p>
          <div className="profile-topics" style={{ justifyContent: "center", marginTop: 26 }}>
            {RECRUITED_CATEGORIES.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="fit" style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Is this a fit?</span>
          <h2 className="title">
            For companies who <em>follow up</em> and deliver real value.
          </h2>
          <div className="fitgrid">
            <div className="fitcol yes">
              <h3>For you if</h3>
              <ul>
                <li>
                  You sell to aesthetic practices (devices, injectables, skincare, software,
                  services)
                </li>
                <li>You can offer members a genuine deal</li>
                <li>You respond to leads within a business day</li>
              </ul>
            </div>
            <div className="fitcol no">
              <h3>Not for you if</h3>
              <ul>
                <li>You can&rsquo;t beat your standard pricing for members</li>
                <li>You want a passive ad you never follow up on</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="apply" id="apply">
        <div className="wrap center">
          <span className="kicker">Apply</span>
          <h2 className="title">
            Become a <em>founding company</em>.
          </h2>
          <p className="lead">
            Tell us your category and the deal you&rsquo;ll offer members. We vet and list companies
            per category, so spots are limited.
          </p>
          <PartnerForm />
        </div>
      </section>

      <SiteFooter />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .feature-grid--cards .feat, .pc, .stepc, .cc, .fitcol"
        grids={[".steps3", ".feature-grid--cards", ".pgrid", ".commitgrid", ".fitgrid"]}
      />
    </SitePage>
  );
}
