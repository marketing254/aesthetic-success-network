import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import ExpertForm from "@/components/site/ExpertForm";

export const metadata: Metadata = {
  title: "Become an Expert",
  description:
    "Turn your aesthetics expertise into a done-for-you content library and a pipeline of warm leads. Share one recording; we produce the kit and bring the audience.",
};

export default function ExpertsPage() {
  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/experts", label: "For Experts", active: true },
          { href: "/partners", label: "For Partners" },
        ]}
        cta={{ href: "#apply", label: "Apply as an expert" }}
      />

      <header className="hero hero--experts" id="top">
        <div className="wrap">
          <div>
            <span className="eyebrow">For Experts</span>
            <h1>
              Turn your expertise into a <em>done-for-you</em> library and a pipeline of warm
              leads.
            </h1>
            <p className="sub">
              Share one recording. We build the full content kit, put it in front of aesthetic
              practice owners, and send interested members straight to your calendar.
            </p>
            <div className="cta-row">
              <a className="btn bronze" href="#apply">
                Apply to be an expert
              </a>
              <a className="btn ghost" href="#how">
                See how it works
              </a>
            </div>
            <div className="micro">Curated by the Business of Aesthetics team, not an algorithm.</div>
          </div>
          <div className="hero-art">
            <div className="arc"></div>
            <div className="particles">
              <span style={{ top: "14%", left: "16%", animation: "floaty 6s ease-in-out infinite" }} />
              <span
                style={{
                  top: "74%",
                  left: "18%",
                  width: 4,
                  height: 4,
                  animation: "floaty 7.5s ease-in-out infinite .8s",
                }}
              />
              <span
                style={{ top: "26%", right: "14%", animation: "floaty 6.8s ease-in-out infinite .4s" }}
              />
            </div>
            <svg
              id="portrait"
              viewBox="0 0 480 600"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="One recording becomes a content library"
            >
              <circle className="ln draw" cx="232" cy="206" r="94" />
              <circle className="ln-thin draw" cx="232" cy="206" r="60" />
              <path className="ln draw" d="M214 172 L214 240 L274 206 Z" />
              <path className="ln-thin draw" d="M344 164 C366 186 366 226 344 248" />
              <path className="ln-thin draw" d="M366 142 C400 176 400 236 366 270" />
              <path
                className="ln draw"
                d="M150 372 h150 a12 12 0 0 1 12 12 v96 a12 12 0 0 1 -12 12 h-150 a12 12 0 0 1 -12 -12 v-96 a12 12 0 0 1 12 -12 z"
              />
              <path className="ln-thin draw" d="M172 404 h106 M172 426 h106 M172 448 h66" />
              <circle className="ln-thin draw" cx="290" cy="404" r="13" />
              <path className="ln-thin draw" d="M286 398 L286 410 L296 404 Z" />
              <path
                className="ln-blush"
                d="M386 150 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z"
                style={{ animation: "twinkle 4s ease-in-out infinite" }}
              />
              <path
                className="ln-blush"
                d="M132 300 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"
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
            Other networks ask experts to make their own content and chase their own audience.{" "}
            <b>We do the production for you, and we bring the audience.</b>
          </span>
        </div>
      </div>

      <section id="how">
        <div className="wrap center">
          <span className="kicker">How it works</span>
          <h2 className="title">
            Three steps from <em>recording</em> to <em>booked</em>.
          </h2>
          <div className="steps3">
            <div className="stepc">
              <div className="n">01</div>
              <h3>You share</h3>
              <p>
                One recording of you teaching your topic, plus a few details. That&rsquo;s the
                whole lift on your side.
              </p>
            </div>
            <div className="stepc">
              <div className="n">02</div>
              <h3>We build</h3>
              <p>
                Your full kit (training video, action guide, checklist, key takeaways, worksheet,
                slide deck and wall poster) produced in your branding, live under your profile.
              </p>
            </div>
            <div className="stepc">
              <div className="n">03</div>
              <h3>You get booked</h3>
              <p>
                Every resource carries a &ldquo;book a meeting&rdquo; button, so interested members
                reach out to you directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">What you get</span>
          <h2 className="title">
            Exposure and warm leads, <em>without</em> the production work.
          </h2>
          <div className="feature-grid--cards">
            <div className="feat">
              <h3>A done-for-you library</h3>
              <p>
                Produced for you, in your branding, from a single recording. No editing, no design,
                no chasing.
              </p>
            </div>
            <div className="feat">
              <h3>Your featured profile</h3>
              <p>
                Your resources, bio and brand in the member portal, a home base members can find.
              </p>
            </div>
            <div className="feat">
              <h3>Warm leads</h3>
              <p>Interested members book straight onto your calendar. No cold outreach required.</p>
            </div>
            <div className="feat">
              <h3>Expert Hotline referrals</h3>
              <p>
                When a member&rsquo;s problem fits your expertise, we point them to you. By fit,
                never pay-to-play.
              </p>
            </div>
            <div className="feat">
              <h3>Sell your own courses</h3>
              <p>
                List your own paid, on-demand courses to members and keep 70% (the network takes
                30%).
              </p>
            </div>
            <div className="feat">
              <h3>Co-marketing</h3>
              <p>
                Features across the Business of Aesthetics network: podcast, webinars and
                newsletter.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-alt" id="pricing">
        <div className="wrap center">
          <span className="kicker">What it costs</span>
          <h2 className="title">
            Build first. Pay only as the value <em>compounds</em>.
          </h2>
          <p className="lead">
            Get set up, build your library and start getting leads before you pay a cent.
          </p>
          <div className="pgrid">
            <div className="pc hot">
              <div className="badge">Start here</div>
              <div className="tier">Months 1&ndash;6</div>
              <div className="price">$0</div>
              <div className="desc">Get set up and build your library first.</div>
            </div>
            <div className="pc">
              <div className="tier">Months 7&ndash;12</div>
              <div className="price">
                $49<span>/mo</span>
              </div>
              <div className="desc">Locked launch rate as the leads start flowing.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 13+</div>
              <div className="price">
                $199<span>/mo</span>
              </div>
              <div className="desc">Standard rate once your library is working for you.</div>
            </div>
          </div>
          <p className="guarantee">
            <b>Paid courses:</b> you keep 70% &middot; <b>Annual prepay:</b> two months free
          </p>
        </div>
      </section>

      <section id="fit">
        <div className="wrap center">
          <span className="kicker">Is this a fit?</span>
          <h2 className="title">
            Built for experts who <em>teach</em>, not hard-sell.
          </h2>
          <div className="fitgrid">
            <div className="fitcol yes">
              <h3>For you if</h3>
              <ul>
                <li>You coach, consult or teach in aesthetics</li>
                <li>You have content, or can record it</li>
                <li>You want exposure and warm leads without doing the production yourself</li>
              </ul>
            </div>
            <div className="fitcol no">
              <h3>Not for you if</h3>
              <ul>
                <li>You&rsquo;re looking to hard-sell with no real value</li>
                <li>You can&rsquo;t be reachable when we send you a member who fits</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="apply" id="apply">
        <div className="wrap center">
          <span className="kicker">Apply</span>
          <h2 className="title">
            Apply to become an <em>expert</em>.
          </h2>
          <p className="lead">
            Send us one recording and we&rsquo;ll build your first resources for your review. We
            review every application for fit.
          </p>
          <ExpertForm />
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/", label: "For Members" },
          { href: "/partners", label: "For Partners" },
          { href: "/provider-agreement", label: "Provider Agreement" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .feature-grid--cards .feat, .pc, .stepc, .fitcol"
        grids={[".steps3", ".feature-grid--cards", ".pgrid", ".fitgrid"]}
        gridDelay={0.09}
      />
    </>
  );
}
