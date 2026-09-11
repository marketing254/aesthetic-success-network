import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import FoundingAcceptView from "@/components/founding/FoundingAcceptView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Founding Invite",
  robots: { index: false, follow: false },
};

type InviteState = "valid" | "accepted" | "expired" | "not_found";

async function loadInvite(code: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("founding_member_invites")
    .select("id, code, full_name, email, practice_name, status, expires_at")
    .eq("code", code)
    .maybeSingle();
  return data;
}

export default async function FoundingInvitePage({
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

  // Mark it viewed on first open — best-effort, never blocks the render.
  if (invite && state === "valid" && invite.status === "sent") {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("founding_member_invites")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", invite.id)
      .then(undefined, () => undefined);
  }

  return (
    <>
      <SiteNav
        links={[{ href: "/", label: "Aesthetic Success Network" }]}
        cta={{ href: "/pricing", label: "See pricing" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          {state === "valid" && (
            <>
              <span className="eyebrow">Personal Invitation</span>
              <h1>
                {invite!.full_name.split(" ")[0]}, you&rsquo;re invited to <em>found</em> the
                network.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                A limited number of founding seats are set aside for practice owners we&rsquo;ve
                hand-picked. Yours is reserved &mdash; $49/mo, locked for as long as
                you&rsquo;re active.
              </p>
            </>
          )}
          {state === "accepted" && (
            <>
              <span className="eyebrow">Already Confirmed</span>
              <h1>
                You&rsquo;re already a <em>founding member</em>.
              </h1>
              <p className="sub" style={{ margin: "0 auto" }}>
                This invite has already been accepted. Head to the login page to get your access
                code.
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
                It may have expired or been revoked. Email{" "}
                <a href="mailto:hello@aestheticsuccessnetwork.com">
                  hello@aestheticsuccessnetwork.com
                </a>{" "}
                and we&rsquo;ll help you out, or join the public waitlist below.
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
                Double-check the link, or join the public waitlist below.
              </p>
            </>
          )}
        </div>
      </header>

      {state === "valid" && invite ? (
        <section>
          <div className="wrap">
            <FoundingAcceptView
              code={invite.code}
              fullName={invite.full_name}
              email={invite.email}
              practiceName={invite.practice_name}
            />
          </div>
        </section>
      ) : (
        <section>
          <div className="wrap center">
            <a className="btn bronze" href="/#join">
              Join the public waitlist
            </a>
          </div>
        </section>
      )}

      <SiteFooter
        links={[
          { href: "/member-agreement", label: "Member Agreement" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />
    </>
  );
}
