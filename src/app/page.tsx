import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import Calculator from "@/components/site/Calculator";
import WaitlistForm from "@/components/site/WaitlistForm";
import JsonLd from "@/components/seo/JsonLd";

// The ASN home page: the approved plain-CSS design (previous ASN site,
// _asn-source-copy/index.html) on top of DMN's functionality. The hero
// CTA starts the DMN member signup (/join/member); the waitlist form at
// the bottom is the "not ready yet" path and posts to /api/waitlist.
//
// Canon rules (ASN-SWAP-CANON.md): the Hotline is a voicemail line with a
// written reply by text and email in 2 to 3 business days, never live or
// 24/7; founding $29/mo (first 100) or $290/yr, then $99/mo; no $99 tier;
// worked examples are labelled illustrative; no member directory or
// community claims; no em dashes in visible copy.


// FAQ copy is rendered on the page AND emitted as FAQPage JSON-LD from the
// same list so the two can never drift.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What exactly do I get as a member?",
    a: "The Expert Hotline (written action plans in 2 to 3 business days), a growing resource library with new expert kits weekly, exclusive member-only company deals, and monthly live AMAs and CE with the field's best experts.",
  },
  {
    q: "Is the Hotline a live, 24/7 helpline?",
    a: "No, and we won't pretend otherwise. It's a voicemail line. You leave your question and our team (AI-assisted) replies by text and email within 2 to 3 business days with a recommended solution plus 3 to 4 experts to contact.",
  },
  {
    q: "How does the founding rate work?",
    a: "The first 100 members lock in $29/mo for as long as their membership stays active. After the founding hundred, the standard rate is $99/mo. There is also an annual option: $290/yr for founding members (pay for 10 months, get 12, save $58). Your locked rate never increases while you're a member.",
  },
  {
    q: "How do the company deals save me money?",
    a: "Companies commit to a genuine member-only discount, at least as good as any offer they make comparable customers. We list them with a Verified Company badge, and you deal with them directly. Use the calculator above with your own numbers.",
  },
  {
    q: "Is this just a front for a big coaching upsell?",
    a: "No. The membership is the product. There are no four-figure programs behind the door, just the network, the resources, and the deals.",
  },
  {
    q: "Do you store patient data?",
    a: "No. The Aesthetic Success Network is a training, education and business-services platform. We do not collect, store, or process any patient data. Ever.",
  },
  {
    q: "What if it's not for me?",
    a: "Every membership comes with a 30-day money-back guarantee, and you can cancel anytime.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// The Supabase auth fallback (?code / ?error on the homepage) is handled
// in middleware.ts, so this page reads NO request data: it stays fully
// static and is served from the CDN edge on every visit.
export default function HomePage() {
  return (
    <SitePage>
      <JsonLd data={FAQ_JSONLD} />
      <SiteNav active="/" />

      <header className="hero hero--home" id="top">
        <div className="wrap">
          <div>
            <span className="eyebrow">For aesthetic practice owners</span>
            <h1>
              Every practice problem gets a <em>written action plan</em> instantly from a vetted
              community of experts and companies.
            </h1>
            <p className="sub">
              The Expert Hotline routes your toughest questions to the right people. Vetted
              companies give you member-only deals. New expert kits arrive weekly. That&rsquo;s the
              network.
            </p>
            <div className="cta-row">
              <Link className="btn bronze" href="/join/member">
                Reserve a founding spot
              </Link>
              <a className="btn ghost" href="#hotline">
                See how the Hotline works
              </a>
            </div>
            <div className="micro">
              <span>Founding rate $29/mo, locked while active</span>
              <span>30-day money-back guarantee</span>
              <span>Cancel anytime</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="arc"></div>
            <div className="particles">
              <span style={{ top: "10%", left: "16%", animation: "floaty 6s ease-in-out infinite" }} />
              <span
                style={{
                  top: "70%",
                  left: "10%",
                  width: 4,
                  height: 4,
                  animation: "floaty 7.5s ease-in-out infinite .8s",
                }}
              />
              <span
                style={{ top: "26%", right: "12%", animation: "floaty 6.8s ease-in-out infinite .4s" }}
              />
              <span
                style={{
                  top: "84%",
                  right: "20%",
                  width: 4,
                  height: 4,
                  animation: "floaty 8s ease-in-out infinite 1.1s",
                }}
              />
            </div>
            <svg
              id="portrait"
              viewBox="0 0 480 600"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Line-art portrait"
            >
              <path className="ln-thin draw" d="M300 70 C342 58 374 82 366 118 C360 148 320 150 302 128" />
              <path className="ln draw" d="M250 96 C342 100 392 178 378 268 C368 336 336 384 308 414" />
              <path className="ln-thin draw" d="M258 104 C330 112 360 170 352 234" />
              <path className="ln-thin draw" d="M296 98 C352 132 364 198 346 256" />
              <path
                className="ln draw"
                d="M250 96 C196 92 156 132 156 184 C156 198 154 204 146 214 C140 224 132 238 126 250 C123 256 126 261 136 264 C130 268 128 272 134 276 C146 280 146 288 134 292 C148 298 148 308 138 314 C160 324 168 342 158 362 C176 394 206 412 230 428 L242 472"
              />
              <path className="ln-thin draw" d="M168 166 C184 158 206 160 220 170" />
              <path className="ln draw" d="M170 182 C182 174 204 174 216 182 C204 192 182 192 170 182 Z" />
              <circle className="dot" cx="196" cy="183" r="4" />
              <path className="ln-blush draw" d="M132 286 C138 288 144 288 150 285" />
              <path className="guide draw" d="M238 256 C216 306 216 348 252 386" />
              <circle className="dot" cx="238" cy="256" r="3" />
              <circle className="dot" cx="216" cy="302" r="3" />
              <circle className="dot" cx="224" cy="342" r="3" />
              <circle className="dot" cx="252" cy="386" r="3" />
              <path
                className="ln-blush"
                d="M372 150 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z"
                style={{ animation: "twinkle 4s ease-in-out infinite" }}
              />
              <path
                className="ln-blush"
                d="M150 460 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z"
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
            The network is <b>powered by Business of Aesthetics</b>. Every expert and company is
            curated by our team, never by an algorithm.
          </span>
        </div>
      </div>

      <section className="hotline" id="hotline">
        <div className="wrap">
          <div className="body">
            <span className="kicker">The Expert Hotline</span>
            <h2>
              Stuck? Put the <em>network</em> on it.
            </h2>
            <p>
              A pricing decision. An injector who just resigned. A marketing channel that stopped
              working. Every practice hits walls. The Hotline gets you a considered, written answer
              and the right experts to call.
            </p>
            <div className="example">
              <div className="tag">Example &middot; illustrative</div>
              <h5>&ldquo;My filler margins are shrinking and I don&rsquo;t know where.&rdquo;</h5>
              <p>A reply like this arrives by text and email within 2 to 3 business days:</p>
              <ul>
                <li>A written action plan: inventory audit steps plus a pricing worksheet</li>
                <li>3 to 4 vetted experts in aesthetics finance and operations to contact</li>
                <li>Relevant kits from the library, matched to your problem</li>
              </ul>
            </div>
            <div className="honest">
              <b>How it actually works:</b> the Hotline is a voicemail line, not a live 24/7
              helpline. You leave your question; our team (AI-assisted) replies in writing within
              2 to 3 business days, routed by fit, never pay-to-play.
            </div>
          </div>
          <div>
            <div className="steps" style={{ marginTop: 60 }}>
              <div className="stepr">
                <div className="n">01</div>
                <div>
                  <h4>Call and describe the problem</h4>
                  <p>
                    In plain English, on our toll-free line, (855) 567-5323. No forms, no forums, no
                    scrolling.
                  </p>
                </div>
              </div>
              <div className="stepr">
                <div className="n">02</div>
                <div>
                  <h4>We route it by fit</h4>
                  <p>
                    Our team reviews your voicemail and matches it to the best solution and the
                    right experts.
                  </p>
                </div>
              </div>
              <div className="stepr">
                <div className="n">03</div>
                <div>
                  <h4>You get a written plan</h4>
                  <p>
                    Text and email within 2 to 3 business days: a recommended solution plus 3 to 4
                    experts to contact.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* /#features (DMN's "What is ASN" anchor) lands on the same section. */}
      <span id="features" className="anchor-alias" aria-hidden />
      <section id="inside">
        <div className="wrap center">
          <span className="kicker">What&rsquo;s inside</span>
          <h2 className="title">
            One membership. <em>Four</em> ways it pays off.
          </h2>
          <p className="lead">
            Built for owners running real practices, not another four-figure coaching upsell. The
            membership itself is the product.
          </p>
          <div className="feature-grid--joined" style={{ textAlign: "left" }}>
            <div className="feat">
              <div className="num">No.1</div>
              <h3>Expert Hotline</h3>
              <p>
                Written action plans for staffing, pricing, marketing and compliance problems, in
                2 to 3 business days.
              </p>
            </div>
            <div className="feat">
              <div className="num">No.2</div>
              <h3>Resource library</h3>
              <p>
                Training videos, action guides, checklists, worksheets and slide decks, with new
                expert kits added weekly.
              </p>
            </div>
            <div className="feat">
              <div className="num">No.3</div>
              <h3>Company deals</h3>
              <p>
                Member-only pricing from vetted companies across devices, injectables, skincare,
                software and services.
              </p>
            </div>
            <div className="feat">
              <div className="num">No.4</div>
              <h3>Live AMAs and CE</h3>
              <p>
                Monthly live sessions with the field&rsquo;s best experts, plus
                continuing-education opportunities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="practices">
        <div className="wrap center">
          <span className="kicker">Built for the whole field</span>
          <h2 className="title">
            One network, <em>every</em> aesthetic practice.
          </h2>
          <div className="artgrid">
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Dermatology">
                <circle className="ln draw" cx="60" cy="60" r="20" />
                <path
                  className="ln-thin draw"
                  d="M60 22 L60 32 M60 88 L60 98 M22 60 L32 60 M88 60 L98 60 M34 34 L41 41 M86 34 L79 41 M34 86 L41 79 M86 86 L79 79"
                />
                <path className="ln-blush draw" d="M52 58 C56 52 64 52 68 58" />
              </svg>
              <h3>Dermatology</h3>
            </div>
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Plastic surgery">
                <path className="ln draw" d="M46 28 C32 42 30 62 42 76 C38 82 40 90 48 94" />
                <path className="ln-thin draw" d="M40 52 C48 48 56 52 58 60" />
                <path className="guide draw" d="M72 38 C86 54 86 74 72 90" />
                <circle className="dot" cx="72" cy="38" r="3" />
                <circle className="dot" cx="86" cy="64" r="3" />
                <circle className="dot" cx="72" cy="90" r="3" />
              </svg>
              <h3>Plastic surgery</h3>
            </div>
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Med spas">
                <path className="ln draw" d="M60 34 C70 50 72 62 60 74 C48 62 50 50 60 34 Z" />
                <path className="ln-thin draw" d="M60 74 C44 70 36 58 38 46 C50 48 58 60 60 74 Z" />
                <path className="ln-thin draw" d="M60 74 C76 70 84 58 82 46 C70 48 62 60 60 74 Z" />
                <path className="ln-blush draw" d="M40 86 C52 94 68 94 80 86" />
              </svg>
              <h3>Med spas</h3>
            </div>
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Estheticians">
                <path className="ln draw" d="M58 30 C76 48 78 70 58 88 C40 70 42 48 58 30 Z" />
                <path className="ln-thin draw" d="M58 42 L58 82" />
                <path
                  className="ln-blush draw"
                  d="M82 64 C90 60 98 64 98 64 C98 64 94 74 84 74 C80 70 82 64 82 64 Z"
                />
              </svg>
              <h3>Estheticians</h3>
            </div>
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Injectors">
                <path className="ln draw" d="M30 60 C42 47 52 47 60 56 C68 47 78 47 90 60" />
                <path className="ln draw" d="M30 60 C50 86 70 86 90 60" />
                <path className="ln-thin draw" d="M32 60 L88 60" />
                <path className="ln-blush draw" d="M58 53 C59 56 61 56 62 53" />
              </svg>
              <h3>Injectors</h3>
            </div>
            <div className="atile">
              <svg className="articon" viewBox="0 0 120 120" role="img" aria-label="Skincare brands">
                <path
                  className="ln draw"
                  d="M52 52 L68 52 Q74 52 74 58 L74 86 Q74 92 68 92 L52 92 Q46 92 46 86 L46 58 Q46 52 52 52 Z"
                />
                <path className="ln-thin draw" d="M52 52 L52 42 L68 42 L68 52" />
                <path className="ln-thin draw" d="M56 42 L56 34 L64 34 L64 42" />
                <path className="ln-blush draw" d="M60 64 L60 80 M54 72 L66 72" />
              </svg>
              <h3>Skincare brands</h3>
            </div>
          </div>
        </div>
      </section>

      <section className="portal">
        <div className="wrap center">
          <span className="kicker">The member portal</span>
          <h2 className="title">
            Everything in <em>one place</em>.
          </h2>
          <p className="lead">
            The Hotline, your library, live sessions and company deals, all behind one login.
          </p>
          <div className="shell" style={{ textAlign: "left" }}>
            <div className="bar">
              <i></i>
              <i></i>
              <i></i>
              <span className="addr">www.aestheticsuccessnetwork.com/dashboard</span>
            </div>
            <div className="app">
              <div className="side">
                <div className="it on">&#9742; &nbsp;Expert Hotline</div>
                <div className="it">&#9783; &nbsp;Resource library</div>
                <div className="it">&#9788; &nbsp;Live sessions &amp; CE</div>
                <div className="it">&#9873; &nbsp;Company deals</div>
                <div className="it">&#9998; &nbsp;Our experts</div>
                <div className="it">&#9881; &nbsp;Account</div>
              </div>
              <div className="main">
                <div className="hi">Good morning.</div>
                <div className="sub2">Your latest kits, fresh from the network&rsquo;s experts:</div>
                <div className="kitrow">
                  <div>
                    <div className="t">Pricing injectables to protect your margin</div>
                    <div className="m">Training video &middot; action guide &middot; worksheet</div>
                  </div>
                  <div className="pill">New this week</div>
                </div>
                <div className="kitrow">
                  <div>
                    <div className="t">The consult that converts without pressure</div>
                    <div className="m">Training video &middot; checklist &middot; script</div>
                  </div>
                  <div className="pill">Kit</div>
                </div>
                <div className="kitrow">
                  <div>
                    <div className="t">Hiring and keeping a great injector</div>
                    <div className="m">Training video &middot; SOP &middot; interview guide</div>
                  </div>
                  <div className="pill">Kit</div>
                </div>
              </div>
            </div>
            <div className="note2">
              Illustrative preview. Kit titles are examples of the format.
            </div>
          </div>
        </div>
      </section>

      <section className="math" id="math">
        <div className="wrap center">
          <span className="kicker">Do the math</span>
          <h2 className="title">
            Run it on <em>your</em> numbers.
          </h2>
          <p className="lead">
            Set your own assumptions. If the deals alone don&rsquo;t clear the membership cost,
            don&rsquo;t join. That&rsquo;s the honest test.
          </p>
          <Calculator />
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="wrap center">
          <span className="kicker">Founding offer</span>
          <h2 className="title">
            $29 a month. <em>Locked</em>, for the first 100.
          </h2>
          <p className="lead">
            After the founding hundred, the rate is $99/mo. Founding members keep $29 for as long
            as their membership stays active.
          </p>
          <div className="pwrap" style={{ textAlign: "left" }}>
            <div className="pfound">
              <div className="fbadge">Founding &middot; first 100 members</div>
              <div className="price">
                $29<span>/mo</span>
              </div>
              <div className="cap">Locked while your membership stays active.</div>
              <ul>
                <li>The Expert Hotline</li>
                <li>Full resource library, new kits weekly</li>
                <li>Every member-only company deal</li>
                <li>Monthly live AMAs and CE</li>
                <li>30-day money-back guarantee &middot; cancel anytime</li>
              </ul>
              <Link className="btn bronze" href="/join/member">
                Claim a founding spot
              </Link>
            </div>
            <div className="pstd">
              <div className="t">After the first 100</div>
              <div className="price">
                $99<span>/mo</span>
              </div>
              <p>The standard rate once founding spots fill. Same membership, later price.</p>
              <div className="ann">
                <b>Annual:</b> $290/yr for founding members. Pay for 10 months, get 12, save
                $58/year.
              </div>
            </div>
          </div>
          <p className="guarantee">
            <b>Fair-launch promise:</b> every membership comes with a 30-day money-back guarantee.
            Not ready yet? <a href="#join">Join the waitlist</a> and pay nothing today.
          </p>
        </div>
      </section>

      <section className="fit">
        <div className="wrap center">
          <span className="kicker">An honest fit check</span>
          <h2 className="title">
            This is worth it <em>only</em> if you&rsquo;ll use it.
          </h2>
          <div className="fitgrid">
            <div className="fitcol yes">
              <h3>For you if</h3>
              <ul>
                <li>You own or run an aesthetic practice and make the decisions</li>
                <li>You want fast, specific answers, not forum scrolling</li>
                <li>You&rsquo;re tired of guessing on vendors, pricing and systems</li>
                <li>You&rsquo;ll actually call the Hotline and use the deals</li>
              </ul>
            </div>
            <div className="fitcol no">
              <h3>Not for you if</h3>
              <ul>
                <li>You&rsquo;re looking for free generic content</li>
                <li>You need $20k one-on-one coaching</li>
                <li>You won&rsquo;t use the Hotline or the company deals</li>
                <li>You&rsquo;re not a decision-maker at a practice</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="doors">
        <div className="wrap center">
          <span className="kicker">One network &middot; three ways in</span>
          <h2 className="title">
            Are you an <em>expert</em> or a <em>company</em>?
          </h2>
          <p className="lead">
            Members get the value. Experts and companies help build it, and get a warm-lead channel
            in return.
          </p>
          <div className="dgrid">
            <div className="door">
              <h3>
                For <em>Experts</em>
              </h3>
              <p>
                Turn one recording into a done-for-you content library and a pipeline of warm
                leads. We produce it; we bring the audience.
              </p>
              <ul>
                <li>A library built for you, in your branding</li>
                <li>Featured profile plus warm leads to your calendar</li>
                <li>Sell your own courses and products to members and keep the full price</li>
              </ul>
              <Link className="btn solid" href="/experts">
                Apply as an expert &rarr;
              </Link>
            </div>
            <div className="door">
              <h3>
                For <em>Companies</em>
              </h3>
              <p>
                Get in front of aesthetics&rsquo; most engaged buyers through a trusted shortlist
                instead of a cold ad. Your first 6 months are free from the member launch, then $39 a month for 12 months, then $149.
              </p>
              <ul>
                <li>Profile plus placement in your category</li>
                <li>Lead flow with a dashboard plus a Verified Company badge</li>
                <li>Podcast, webinar and co-marketing features</li>
              </ul>
              <Link className="btn solid" href="/companies">
                Become a company &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="wrap">
          <div className="center">
            <span className="kicker">Everything else</span>
            <h2 className="title">Good to know</h2>
          </div>
          <div style={{ marginTop: 42 }}>
            {FAQ_ITEMS.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* /#waitlist (DMN's waitlist anchor) lands on the same section. */}
      <span id="waitlist" className="anchor-alias" aria-hidden />
      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Not ready yet? <em>Get on the list.</em>
          </h2>
          <p className="lead2">
            Join the waitlist and pay nothing today. We&rsquo;ll reach out as founding spots open,
            and you confirm before any charge. Ready now?{" "}
            <Link href="/join/member" style={{ textDecoration: "underline" }}>
              Reserve a founding spot
            </Link>
            .
          </p>
          <WaitlistForm />
        </div>
      </section>

      <SiteFooter />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .feature-grid--joined .feat, .atile, .stepr, .example, .honest, .fitcol, .door, .pwrap, .calc, .shell, .faq details, .final h2, .final .lead2, .final .cd-wrap"
        grids={[".feature-grid--joined", ".artgrid", ".fitgrid", ".dgrid", ".steps"]}
      />
    </SitePage>
  );
}
