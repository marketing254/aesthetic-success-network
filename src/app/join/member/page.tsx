import { Suspense } from "react";
import type { Metadata } from "next";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import MemberSignupForm, { type SignupPrefill } from "@/components/site/MemberSignupForm";
import { getPromoContext, getReferralContext, type RefContext } from "@/lib/referralContext";
import { resolveResumeToken } from "@/lib/abandoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve your founding spot | Aesthetic Success Network",
  description:
    "Three short steps to join Aesthetic Success Network: the Expert Hotline, company savings, and the resource library of expert kits.",
  alternates: { canonical: "/join/member" },
};

/**
 * /join/member: the ASN-styled three-step member signup on top of DMN's
 * signup logic (POST /api/member/signup, then /upgrade for plan and Stripe
 * checkout).
 *
 * ?ref=CODE: referral links show who invited them; ?promo=CODE: team promo
 * codes render as a gift from the ASN team; ?resume=TOKEN: the follow-up
 * email's welcome-back path with saved details prefilled.
 */
export default async function JoinMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; promo?: string | string[]; resume?: string | string[] }>;
}) {
  const params = await searchParams;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const promo = Array.isArray(params.promo) ? params.promo[0] : params.promo;
  const resume = Array.isArray(params.resume) ? params.resume[0] : params.resume;

  let refCtx: RefContext | null = (await getReferralContext(ref)) ?? (await getPromoContext(promo));
  let prefill: SignupPrefill | null = null;

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
          imageUrl: "/asn-app-icon.png",
          pairedName: null,
          offerActive: true,
          offerMonths: 1,
        };
      }
    }
  }

  return (
    <SitePage>
      <SiteNav />
      <main>
        <section className="apply signup-section">
          <div className="wrap center">
            <span className="kicker">Founding membership &middot; first 100 members</span>
            <h1 className="title">
              Reserve your <em>founding spot</em>.
            </h1>
            <p className="lead">
              $29 a month or $290 a year, locked for as long as your membership stays active, for the
              first 100 members. Nothing to pay today: we reach out before the doors open, and you
              confirm before any charge.
            </p>
            <Suspense fallback={null}>
              <MemberSignupForm refCtx={refCtx} prefill={prefill} />
            </Suspense>
          </div>
        </section>
      </main>
      <SiteFooter />
    </SitePage>
  );
}
