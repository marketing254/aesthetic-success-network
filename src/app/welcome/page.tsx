import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { applySubscriptionToMember } from "@/lib/billing";
import { ensureAuthUser } from "@/lib/auth/portal";
import { sendMemberSubscriptionConfirmedEmail, notifyTeam } from "@/lib/email/templates";
import RequestLoginCodeButton from "@/components/welcome/RequestLoginCodeButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to Aesthetic Success Network",
  description: "Your founding membership is confirmed.",
  robots: { index: false, follow: false },
};

const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

type WelcomeState = "paid" | "processing" | "invalid";

/**
 * /welcome — the founding-invite checkout confirmation page.
 *
 * SERVER-VERIFIED, same pattern TD used: this page renders "you're in"
 * ONLY after retrieving the Checkout Session from Stripe with the
 * secret key and seeing payment_status = paid. A guessed/replayed
 * session id can't fake a membership.
 *
 * This is also where the `members` row is actually created for the
 * founding-invite flow (see /api/founding/[code]/accept, which
 * deliberately does NOT create it before payment). We can't touch the
 * Stripe webhook route to do this instead, since it never learns a
 * member_id for a checkout that started before any member row existed
 * — so this page does the provisioning itself, idempotently (guarded
 * by the invite's own status column).
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  let state: WelcomeState = "invalid";
  let firstName = "";
  let email = "";

  if (sessionId && SESSION_ID_RE.test(sessionId)) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.metadata?.channel === "founding_invite" && session.payment_status === "paid") {
        state = "paid";
        const supabase = getSupabaseAdmin();
        const inviteId = session.metadata.invite_id;

        const { data: invite } = await supabase
          .from("founding_member_invites")
          .select("id, full_name, email, practice_name, status, member_id")
          .eq("id", inviteId)
          .maybeSingle();

        if (invite) {
          email = invite.email as string;
          firstName = (invite.full_name as string).split(" ")[0] ?? "";

          if (invite.status !== "accepted") {
            // First time we're seeing this paid session — provision the member.
            const [first, ...rest] = (invite.full_name as string).trim().split(/\s+/);
            const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

            const { data: member, error: insertErr } = await supabase
              .from("members")
              .insert({
                email: invite.email,
                first_name: first || invite.full_name,
                last_name: rest.join(" ") || "",
                practice_name: invite.practice_name,
                status: "active",
                tier: "founding",
                activated_at: new Date().toISOString(),
                activated_by: "founding_invite",
                joined_at: new Date().toISOString(),
                stripe_customer_id: customerId ?? null,
              })
              .select("id")
              .single();

            if (!insertErr && member) {
              if (session.subscription) {
                const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
                  expand: ["default_payment_method"],
                });
                await applySubscriptionToMember(supabase, member.id as string, sub, stripe).catch((err) =>
                  console.error("[welcome] applySubscriptionToMember failed:", err),
                );
              }
              await supabase
                .from("founding_member_invites")
                .update({ status: "accepted", accepted_at: new Date().toISOString(), member_id: member.id })
                .eq("id", invite.id);

              await ensureAuthUser(invite.email as string);
              await sendMemberSubscriptionConfirmedEmail(invite.email as string, firstName, "Founding plan").catch(
                () => undefined,
              );
              void notifyTeam("Founding invite accepted", [
                ["Name", invite.full_name as string],
                ["Email", invite.email as string],
              ]);
            } else if (insertErr) {
              console.error("[welcome] member insert failed:", insertErr);
            }
          }
        }
      } else if (session.status === "expired") {
        state = "invalid";
      } else {
        state = "processing";
      }
    } catch (err) {
      console.error("[welcome] session retrieval failed:", err);
      state = "invalid";
    }
  }

  return (
    <>
      <SiteNav links={[{ href: "/", label: "Aesthetic Success Network" }]} cta={{ href: "/pricing", label: "Pricing" }} />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          {state === "paid" && (
            <>
              <span className="eyebrow">Payment Confirmed</span>
              <h1>
                Welcome{firstName ? `, ${firstName}` : ""}. You&rsquo;re a <em>founding member</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                Your founding rate is locked at $49/mo for as long as your membership stays
                active. We&rsquo;ll send your login code to {email || "your email"} &mdash; no
                password to remember.
              </p>
              <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
                <RequestLoginCodeButton email={email} />
              </div>
            </>
          )}
          {state === "processing" && (
            <>
              <span className="eyebrow">Almost There</span>
              <h1>
                We&rsquo;re confirming your <em>payment</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                This usually takes a few seconds. Refresh this page in a moment &mdash; if it
                doesn&rsquo;t clear within a few minutes, email{" "}
                <a href="mailto:hello@aestheticsuccessnetwork.com">
                  hello@aestheticsuccessnetwork.com
                </a>
                .
              </p>
            </>
          )}
          {state === "invalid" && (
            <>
              <span className="eyebrow">Something&rsquo;s Off</span>
              <h1>
                We couldn&rsquo;t confirm a <em>payment</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                This link may have expired or already been used. If you believe this is a
                mistake, email{" "}
                <a href="mailto:hello@aestheticsuccessnetwork.com">
                  hello@aestheticsuccessnetwork.com
                </a>
                .
              </p>
            </>
          )}
        </div>
      </header>

      <SiteFooter links={[{ href: "/privacy", label: "Privacy" }]} />

      <PageFx revealSelector=".welcome-page-no-reveal-sections" />
    </>
  );
}
