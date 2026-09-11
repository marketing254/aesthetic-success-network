import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import {
  FOUNDING_MEMBER_CAP,
  EARLY_MEMBER_CAP,
  PLAN_DISPLAY,
  EXPERT_PLAN_DISPLAY,
  PARTNER_PLAN_DISPLAY,
} from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Aesthetic Success Network pricing: Founding, Early and Standard membership tiers, plus the Expert and Partner programs. No hidden fees, no four-figure coaching upsell.",
};

export default function PricingPage() {
  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/pricing", label: "Pricing", active: true },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Pricing</span>
          <h1>
            One membership. <em>Three</em> honest tiers.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            The earlier you join, the less you pay, for as long as you stay a member. No hidden
            fees, no four-figure coaching upsell hiding behind the door.
          </p>
        </div>
      </header>

      <section className="pricing" id="members">
        <div className="wrap center">
          <span className="kicker">Members</span>
          <h2 className="title">
            Locked in <em>for life</em>, while your membership stays active.
          </h2>
          <p className="lead">
            {FOUNDING_MEMBER_CAP} founding seats, then {EARLY_MEMBER_CAP} early seats, then the
            standard rate. Your rate never goes up once you&rsquo;re in.
          </p>
          <div className="pgrid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="pc hot">
              <div className="badge">First {FOUNDING_MEMBER_CAP}</div>
              <div className="tier">Founding</div>
              <div className="price">
                ${PLAN_DISPLAY.founding_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">
                Locked for life while active. Annual: ${PLAN_DISPLAY.founding_annual.amount}/yr
                (two months free).
              </div>
            </div>
            <div className="pc">
              <div className="tier">Next {EARLY_MEMBER_CAP}</div>
              <div className="price">
                ${PLAN_DISPLAY.early_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">
                Locked once founding fills. Annual: ${PLAN_DISPLAY.early_annual.amount}/yr.
              </div>
            </div>
            <div className="pc">
              <div className="tier">Standard</div>
              <div className="price">
                ${PLAN_DISPLAY.standard_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">
                Once both caps fill. Annual: ${PLAN_DISPLAY.standard_annual.amount}/yr.
              </div>
            </div>
          </div>
          <p className="guarantee">
            <b>Every tier includes:</b> the Expert Hotline, the full resource library, every
            partner deal and monthly live AMAs &amp; CE &middot; 30-day money-back guarantee
            &middot; cancel anytime
          </p>
          <div className="cta-row" style={{ justifyContent: "center", marginTop: 28 }}>
            <a className="btn bronze" href="/#join">
              Join the founding waitlist
            </a>
          </div>
        </div>
      </section>

      <section className="pricing-alt" id="experts">
        <div className="wrap center">
          <span className="kicker">Experts</span>
          <h2 className="title">
            Build first. Pay only as the value <em>compounds</em>.
          </h2>
          <p className="lead">
            Get set up, build your library and start getting leads before you pay a cent.
          </p>
          <div className="pgrid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="pc hot">
              <div className="badge">Start here</div>
              <div className="tier">Months 1&ndash;6</div>
              <div className="price">$0</div>
              <div className="desc">Get set up and build your library first.</div>
            </div>
            <div className="pc">
              <div className="tier">Months 7&ndash;12</div>
              <div className="price">
                ${EXPERT_PLAN_DISPLAY.expert_growth_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">Locked launch rate as the leads start flowing.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 13+</div>
              <div className="price">
                ${EXPERT_PLAN_DISPLAY.expert_standard_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">
                Standard rate, or ${EXPERT_PLAN_DISPLAY.expert_standard_annual.amount}/yr annual
                (two months free).
              </div>
            </div>
          </div>
          <p className="guarantee">
            <b>Paid courses:</b> you keep 70% &middot; Starting a trial locks your Growth rate for
            life
          </p>
          <div className="cta-row" style={{ justifyContent: "center", marginTop: 28 }}>
            <Link className="btn solid" href="/experts#apply">
              Apply as an expert &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="pricing" id="partners">
        <div className="wrap center">
          <span className="kicker">Partners</span>
          <h2 className="title">
            Free for six months. It pays for itself as <em>deals close</em>.
          </h2>
          <p className="lead">
            Prove the channel before you pay, then keep a locked launch rate as the leads come in.
          </p>
          <div className="pgrid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="pc hot">
              <div className="badge">Founding</div>
              <div className="tier">Months 1&ndash;6</div>
              <div className="price">$0</div>
              <div className="desc">Get listed and start receiving leads, free.</div>
            </div>
            <div className="pc">
              <div className="tier">Months 7&ndash;12</div>
              <div className="price">
                ${PARTNER_PLAN_DISPLAY.partner_growth_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">Founding locked rate.</div>
            </div>
            <div className="pc">
              <div className="tier">Month 13+</div>
              <div className="price">
                ${PARTNER_PLAN_DISPLAY.partner_standard_monthly.amount}
                <span>/mo</span>
              </div>
              <div className="desc">
                Standard rate, or ${PARTNER_PLAN_DISPLAY.partner_standard_annual.amount}/yr
                annual (two months free).
              </div>
            </div>
          </div>
          <p className="guarantee">
            <b>Referral rewards:</b> $50 per referred member &middot; Founding partners get
            priority placement
          </p>
          <div className="cta-row" style={{ justifyContent: "center", marginTop: 28 }}>
            <Link className="btn solid" href="/partners#apply">
              Become a partner &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="wrap">
          <div className="center">
            <span className="kicker">Questions</span>
            <h2 className="title">Good to know</h2>
          </div>
          <div style={{ marginTop: 42 }}>
            <details open>
              <summary>Do prices ever go up on me?</summary>
              <p>
                No. Once you lock a rate, whether as a founding member, an early member, or an
                expert/partner on the Growth rate, that rate is yours for as long as you stay
                active. It never increases.
              </p>
            </details>
            <details>
              <summary>What happens after the founding and early seats fill?</summary>
              <p>
                New members join at the standard rate. Members who already locked in a lower rate
                keep it, no matter how the caps fill up around them.
              </p>
            </details>
            <details>
              <summary>Can I cancel anytime?</summary>
              <p>
                Yes. Every membership comes with a 30-day money-back guarantee and no long-term
                contract. Cancelling frees up your seat for someone else &mdash; it does not
                reopen your locked rate if you rejoin later.
              </p>
            </details>
            <details>
              <summary>Is there a free trial for experts and partners?</summary>
              <p>
                Experts and partners get a 6-month free waiver from the day they&rsquo;re
                approved, no card required. After that, the Growth rate applies through month 12,
                then the Standard rate.
              </p>
            </details>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/member-agreement", label: "Member Agreement" },
          { href: "/refund-policy", label: "Refund & Cancellation" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .pc, .faq details"
        grids={[".pgrid"]}
      />
    </>
  );
}
