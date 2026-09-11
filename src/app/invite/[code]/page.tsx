import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import ExpertForm from "@/components/site/ExpertForm";
import PartnerForm from "@/components/site/PartnerForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Invitation",
  robots: { index: false, follow: false },
};

type InviteState = "valid" | "accepted" | "expired" | "not_found";

async function loadInvite(code: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("invite_links")
    .select("id, code, kind, full_name, email, company_name, status, expires_at")
    .eq("code", code)
    .maybeSingle();
  return data;
}

export default async function InviteLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await loadInvite(code).catch(() => null);

  let state: InviteState = "not_found";
  if (invite) {
    if (invite.status === "accepted") state = "accepted";
    else if (invite.status === "revoked" || new Date(invite.expires_at as string) < new Date()) state = "expired";
    else state = "valid";
  }

  if (invite && state === "valid" && invite.status === "active") {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("invite_links")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", invite.id)
      .then(undefined, () => undefined);
  }

  const kindLabel = invite?.kind === "partner" ? "partner" : "expert";
  const firstName = invite?.full_name?.split(" ")[0];

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
        ]}
        cta={{ href: "/pricing", label: "See pricing" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          {state === "valid" && (
            <>
              <span className="eyebrow">Personal Invitation</span>
              <h1>
                {firstName ? `${firstName}, y` : "Y"}ou&rsquo;re invited to join as a{" "}
                <em>{kindLabel}</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                We&rsquo;ve pre-filled what we already know. Confirm the rest below and
                we&rsquo;ll get your application in front of our review team right away.
              </p>
            </>
          )}
          {state === "accepted" && (
            <>
              <span className="eyebrow">Already Submitted</span>
              <h1>
                We&rsquo;ve already got your <em>application</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                This invite has already been used. Our team reviews every application for fit and
                will be in touch.
              </p>
            </>
          )}
          {state === "expired" && (
            <>
              <span className="eyebrow">Invite Expired</span>
              <h1>
                This invite is no longer <em>valid</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                Email{" "}
                <a href="mailto:hello@aestheticsuccessnetwork.com">
                  hello@aestheticsuccessnetwork.com
                </a>{" "}
                and we&rsquo;ll help you out, or apply directly below.
              </p>
            </>
          )}
          {state === "not_found" && (
            <>
              <span className="eyebrow">Invite Not Found</span>
              <h1>
                We couldn&rsquo;t find that <em>invite</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                Double-check the link, or apply directly below.
              </p>
            </>
          )}
        </div>
      </header>

      <section id="apply">
        <div className="wrap center">
          {state === "valid" && invite ? (
            invite.kind === "partner" ? (
              <PartnerForm
                apiEndpoint={`/api/invite/${invite.code}/accept`}
                source="invite-link"
                defaultValues={{
                  contactName: invite.full_name,
                  email: invite.email ?? undefined,
                  companyName: invite.company_name ?? undefined,
                }}
              />
            ) : (
              <ExpertForm
                apiEndpoint={`/api/invite/${invite.code}/accept`}
                source="invite-link"
                defaultValues={{
                  firstName: invite.full_name?.split(" ")[0],
                  lastName: invite.full_name?.split(" ").slice(1).join(" "),
                  email: invite.email ?? undefined,
                  company: invite.company_name ?? undefined,
                }}
              />
            )
          ) : (
            <>
              <span className="kicker">Apply directly</span>
              <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
                <a className="btn bronze" href="/experts#apply">
                  Apply as an expert
                </a>
                <a className="btn solid" href="/partners#apply">
                  Apply as a partner
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .kicker, .netform" />
    </>
  );
}
