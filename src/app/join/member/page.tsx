import { Suspense } from "react";
import type { Metadata } from "next";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import MemberSignupForm, { type SignupPrefill } from "@/components/site/MemberSignupForm";
import { getPromoContext, getReferralContext, type RefContext } from "@/lib/referralContext";
import { resolveResumeToken } from "@/lib/abandoned";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { founding } from "@/lib/content";
import { memberLaunchShortLabel } from "@/lib/providerBilling";
import { PROTOCOL_CARDS, inviterFor } from "@/lib/foundingExperts";
import "./join-member.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Bring any practice problem and get an answer instantly. Reserve your founding spot in the Aesthetic Success Network: $29 a month, locked in, nothing to pay today.";

export const metadata: Metadata = {
  title: "Reserve your founding spot | Aesthetic Success Network",
  description: DESCRIPTION,
  alternates: { canonical: "/join/member" },
  openGraph: {
    title: "Bring any practice problem. Get an answer instantly.",
    description: DESCRIPTION,
    url: "/join/member",
  },
};

/**
 * /join/member: the founding-membership waitlist page (owner design,
 * 14 Oct 2026). The three-step MemberSignupForm is unchanged; only the page
 * around it is new.
 *
 * ?from=<slug>  a founding expert's personal link ("Dr. Jonathan Kaplan
 *               invited you"); slugs live in lib/foundingExperts
 * ?ref=CODE     referral links show who invited them inside the form
 * ?promo=CODE   team promo codes render as a gift from the ASN team
 * ?resume=TOKEN the follow-up email's welcome-back path, details prefilled
 * ?wl=ID        the launch email link, waitlist details prefilled
 */

const Tick = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#d9a84b" strokeWidth="2" aria-hidden>
    <polyline points="3,9.5 7,13 15,5" />
  </svg>
);

export default async function JoinMemberPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string | string[];
    promo?: string | string[];
    resume?: string | string[];
    wl?: string | string[];
    from?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ref = one(params.ref);
  const promo = one(params.promo);
  const resume = one(params.resume);
  const wl = one(params.wl);
  const inviter = inviterFor(one(params.from));

  let refCtx: RefContext | null = (await getReferralContext(ref)) ?? (await getPromoContext(promo));
  let prefill: SignupPrefill | null = null;

  // ?wl=<waitlist signup id>: the launch email link. Prefills the details
  // the member gave on the waitlist (name, email, practice); nothing else
  // is exposed and the id is an unguessable uuid.
  if (wl && /^[0-9a-f-]{36}$/i.test(wl)) {
    try {
      const { data: w } = await getSupabaseAdmin()
        .from("waitlist_signups")
        .select("email, full_name, first_name, last_name, practice_name")
        .eq("id", wl)
        .eq("role", "member")
        .maybeSingle();
      if (w) {
        const parts = (w.full_name ?? "").trim().split(/\s+/);
        prefill = {
          firstName: w.first_name ?? parts[0] ?? null,
          lastName: w.last_name ?? (parts.length > 1 ? parts.slice(1).join(" ") : null),
          email: w.email,
          practiceName: w.practice_name,
        };
      }
    } catch {
      /* no prefill */
    }
  }

  if (resume) {
    const rc = await resolveResumeToken(resume).catch(() => null);
    if (rc) {
      prefill = {
        firstName: rc.firstName,
        lastName: rc.lastName,
        email: rc.email,
        practiceName: rc.practiceName,
      };
      if (!refCtx && rc.codeState === "active") {
        refCtx = {
          name: "Aesthetic Success Network",
          kind: "team",
          tagline: "Welcome back. We saved your spot",
          imageUrl: "/asn-app-icon-256.png",
          pairedName: null,
          offerActive: true,
          offerMonths: 1,
        };
      }
    }
  }

  const doors = memberLaunchShortLabel();

  return (
    <SitePage className="jm">
      <SiteNav />

      {inviter && (
        <div className="jm-invite">
          <div className="jm-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={inviter.photo ?? "/asn-app-icon-256.png"} alt="" width={34} height={34} />
            <div>
              <b>{inviter.name}</b> invited you. {inviter.line}
            </div>
          </div>
        </div>
      )}

      <main>
        <section className="jm-hero">
          <svg className="jm-hero-art jm-draw" width="520" height="520" viewBox="0 0 520 520" fill="none" stroke="#d9a84b" strokeWidth="1.4" aria-hidden>
            <circle cx="260" cy="260" r="200" style={{ ["--len" as string]: 1260 }} />
            <circle cx="260" cy="260" r="140" style={{ ["--len" as string]: 880 }} />
            <path d="M120 300c60-90 220-90 280 0" style={{ ["--len" as string]: 420 }} />
            <path d="M160 200c40 40 160 40 200 0" style={{ ["--len" as string]: 300 }} />
            <line x1="260" y1="60" x2="260" y2="460" style={{ ["--len" as string]: 400 }} />
          </svg>
          <div className="jm-wrap jm-hero-grid">
            <div>
              <div className="jm-eyebrow">Founding membership &middot; first {founding.totalSpots} members</div>
              <h1>
                Bring any practice problem. <em>Get an answer instantly.</em>
              </h1>
              <p className="jm-lede">
                The Aesthetic Success Network is a paid membership community for aesthetic practice owners, and the
                experts and companies who help them grow.
              </p>
              <ul className="jm-ticks">
                <li>
                  <Tick />
                  An instant, AI-assisted answer to any practice problem
                </li>
                <li>
                  <Tick />
                  Practical Protocols from experts who&rsquo;ve done it
                </li>
                <li>
                  <Tick />
                  Member-only offers from companies we&rsquo;ve vetted
                </li>
              </ul>
              <div className="jm-date">
                <span className="jm-dot" />
                Doors open {doors}. Reserve your spot now.
              </div>
            </div>
            <div className="jm-card" id="card">
              <Suspense fallback={null}>
                <MemberSignupForm refCtx={refCtx} prefill={prefill} variant="card" from={inviter?.slug ?? null} />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="jm-sec">
          <div className="jm-wrap">
            <div className="jm-sec-h">
              <div className="jm-eyebrow">What membership includes</div>
              <h2>Everything a practice owner needs, in one place.</h2>
            </div>
            <div className="jm-grid5">
              <div className="jm-feat jm-feat-wide">
                <svg className="jm-ic jm-draw" viewBox="0 0 44 44" fill="none" stroke="#d9a84b" strokeWidth="1.6" aria-hidden>
                  <rect x="6" y="9" width="32" height="22" rx="6" style={{ ["--len" as string]: 110 }} />
                  <path d="M14 31l-4 7 10-7" style={{ ["--len" as string]: 30 }} />
                  <line x1="13" y1="17" x2="31" y2="17" style={{ ["--len" as string]: 20 }} />
                  <line x1="13" y1="23" x2="25" y2="23" style={{ ["--len" as string]: 14 }} />
                </svg>
                <h3>The Expert Hotline</h3>
                <p>
                  Bring a practice problem and get an instant, AI-assisted answer: a recommended solution, plus the
                  experts and companies best placed to help. Matched by fit, never pay-to-play.
                </p>
              </div>
              <div className="jm-feat">
                <svg className="jm-ic jm-draw" viewBox="0 0 44 44" fill="none" stroke="#a07823" strokeWidth="1.6" aria-hidden>
                  <rect x="9" y="7" width="22" height="30" rx="3" style={{ ["--len" as string]: 110 }} />
                  <path d="M15 15h10M15 21h10M15 27h6" style={{ ["--len" as string]: 30 }} />
                  <path d="M31 13h4v26H15v-2" style={{ ["--len" as string]: 50 }} />
                </svg>
                <h3>Expert Signature Series</h3>
                <p>A library of Protocols: videos, guides, scripts and checklists from experts in the field.</p>
              </div>
              <div className="jm-feat">
                <svg className="jm-ic jm-draw" viewBox="0 0 44 44" fill="none" stroke="#a07823" strokeWidth="1.6" aria-hidden>
                  <path d="M8 20l14-12 14 12v16H8z" style={{ ["--len" as string]: 110 }} />
                  <circle cx="22" cy="26" r="5" style={{ ["--len" as string]: 32 }} />
                </svg>
                <h3>Member-only offers</h3>
                <p>Offers from vetted companies that members can&rsquo;t get anywhere else.</p>
              </div>
              <div className="jm-feat">
                <svg className="jm-ic jm-draw" viewBox="0 0 44 44" fill="none" stroke="#a07823" strokeWidth="1.6" aria-hidden>
                  <rect x="17" y="6" width="10" height="20" rx="5" style={{ ["--len" as string]: 60 }} />
                  <path d="M11 22a11 11 0 0 0 22 0M22 33v5" style={{ ["--len" as string]: 50 }} />
                </svg>
                <h3>Podcast &amp; events</h3>
                <p>Exclusive episodes featuring our experts and partners, and access to our events.</p>
              </div>
              <div className="jm-feat">
                <svg className="jm-ic jm-draw" viewBox="0 0 44 44" fill="none" stroke="#a07823" strokeWidth="1.6" aria-hidden>
                  <circle cx="15" cy="17" r="5" style={{ ["--len" as string]: 32 }} />
                  <circle cx="29" cy="17" r="5" style={{ ["--len" as string]: 32 }} />
                  <path d="M6 34c2-6 16-6 18 0M20 34c2-6 16-6 18 0" style={{ ["--len" as string]: 60 }} />
                </svg>
                <h3>A private community</h3>
                <p>Connect with practice owners, experts and companies in the private Business of Aesthetics group.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="jm-sec jm-sec-tight">
          <div className="jm-wrap">
            <div className="jm-sec-h">
              <div className="jm-eyebrow">How the Hotline answers</div>
              <h2>A real problem, a useful answer.</h2>
            </div>
            <div className="jm-demo">
              <div className="jm-bubble jm-q">
                <span className="jm-tag">A member asks</span>
                &ldquo;We get plenty of consultation enquiries, but most never book. Where do we start?&rdquo;
              </div>
              <div className="jm-bubble jm-a">
                <span className="jm-tag">The Hotline answers, instantly</span>
                A recommended starting point: respond to every new enquiry within the hour and follow up three times
                before letting it go.
                <ul>
                  <li>A Protocol from the library on lead follow-up, with scripts for the front desk</li>
                  <li>Experts and companies who help practices with this, matched by fit</li>
                </ul>
                <div className="jm-illus">Illustrative example. Real answers depend on the question.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="jm-sec jm-experts">
          <div className="jm-wrap">
            <div className="jm-sec-h">
              <div className="jm-eyebrow">Founding experts</div>
              <h2>Learn from people who&rsquo;ve built it.</h2>
              <p className="jm-sec-p">
                Dr. Jonathan Kaplan, founder and CEO of DrWell, and Laura Crowley, founder and CEO of Laura Jeannette
                &amp; Co. Six Protocols ready on day one.
              </p>
            </div>
          </div>
          {/* Slow right-to-left loop in pure CSS: the list is rendered twice and the
              track slides by half its width. Pauses on hover; still and scrollable
              with reduced motion. */}
          <div className="jm-marquee" aria-label="Founding expert Protocols">
            <div className="jm-track" style={{ ["--dur" as string]: `${PROTOCOL_CARDS.length * 8}s` }}>
              {[...PROTOCOL_CARDS, ...PROTOCOL_CARDS].map((c, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${c.src}-${i}`}
                  src={c.src}
                  alt={i < PROTOCOL_CARDS.length ? c.alt : ""}
                  aria-hidden={i >= PROTOCOL_CARDS.length ? true : undefined}
                  width={220}
                  height={293}
                  decoding="async"
                />
              ))}
            </div>
          </div>
          <div className="jm-wrap">
            <div className="jm-more">
              <b>More founding experts are joining before launch.</b>
              Each one brings Protocols built from what they already teach, so members have a strong bench from day
              one.
            </div>
          </div>
        </section>

        <section className="jm-sec">
          <div className="jm-wrap">
            <div className="jm-sec-h">
              <div className="jm-eyebrow">How founding membership works</div>
              <h2>Reserve now. Decide when the doors open.</h2>
            </div>
            <div className="jm-time">
              <div>
                <small>Today</small>
                <b>Reserve your spot</b>
                <span>Three short steps. Nothing to pay.</span>
              </div>
              <div>
                <small>Before {doors}</small>
                <b>We email you</b>
                <span>Everything you need to know before you commit.</span>
              </div>
              <div>
                <small>{doors}</small>
                <b>Doors open</b>
                <span>Confirm your membership. No charge until you do.</span>
              </div>
              <div>
                <small>From then on</small>
                <b>${founding.priceMonthly} a month, locked</b>
                <span>Your founding rate stays as long as your membership is active.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="jm-sec jm-sec-tight">
          <div className="jm-wrap jm-faq">
            <div className="jm-sec-h">
              <div className="jm-eyebrow">Questions</div>
              <h2>Before you reserve</h2>
            </div>
            <details open>
              <summary>Do I pay anything today?</summary>
              <p>No. Reserving your spot is free. We email you before the doors open, and you confirm before any charge.</p>
            </details>
            <details>
              <summary>Is the Hotline a live human?</summary>
              <p>
                No, and we won&rsquo;t pretend otherwise. The Hotline is AI-assisted: you describe your problem and get
                an instant answer with a recommended solution and the experts or companies best placed to help.
              </p>
            </details>
            <details>
              <summary>What if it isn&rsquo;t right for me?</summary>
              <p>Membership comes with a money-back guarantee, and you can cancel anytime.</p>
            </details>
            <details>
              <summary>Who is behind ASN?</summary>
              <p>The team behind Business of Aesthetics. ASN is powered by Business of Aesthetics.</p>
            </details>
          </div>
        </section>

        <section className="jm-sec jm-final">
          <div className="jm-wrap">
            <div className="jm-eyebrow">Founding membership &middot; first {founding.totalSpots} members</div>
            <h2>Reserve your founding spot.</h2>
            <p>${founding.priceMonthly} a month, locked in. Nothing to pay today.</p>
            <a className="jm-btn" href="#card">
              Reserve my spot
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </SitePage>
  );
}
