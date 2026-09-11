import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

async function getPartner(id: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("partner_applications")
    .select("id, company_name, display_name, category, description, member_deal, logo_url, website, booking_link, status")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "approved" || !data.description) return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const partner = await getPartner(id).catch(() => null);
  if (!partner) return {};
  const name = (partner.display_name as string) || (partner.company_name as string);
  return { title: name, description: (partner.description as string).slice(0, 160) };
}

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();

  const name = (partner.display_name as string) || (partner.company_name as string) || "Network partner";

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners", active: true },
        ]}
        cta={{ href: "/partners#apply", label: "Apply as a partner" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <div className="profile-head">
            <div className="profile-avatar">
              {partner.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={partner.logo_url as string} alt={name} />
              ) : (
                initials(name)
              )}
            </div>
            <div>
              <span className="eyebrow">Verified Partner</span>
              <h1 style={{ fontSize: 40 }}>{name}</h1>
              {partner.category ? <p className="sub">{partner.category as string}</p> : null}
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <article className="legal-doc" style={{ maxWidth: 720 }}>
            <p>{partner.description as string}</p>
          </article>

          {partner.member_deal ? (
            <div className="invite-box" style={{ margin: "30px 0 0", maxWidth: 720 }}>
              <span className="kicker">Member deal</span>
              <p style={{ marginTop: 10, fontSize: 15, color: "#3d4653", lineHeight: 1.6 }}>
                {partner.member_deal as string}
              </p>
              <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
                Deal details are confirmed with members directly and require an active
                membership to redeem.
              </p>
            </div>
          ) : null}

          <div className="cta-row" style={{ marginTop: 30 }}>
            {partner.booking_link ? (
              <a className="btn bronze" href={partner.booking_link as string} target="_blank" rel="noopener noreferrer">
                Book a meeting &rarr;
              </a>
            ) : null}
            {partner.website ? (
              <a className="btn ghost" href={partner.website as string} target="_blank" rel="noopener noreferrer">
                Visit website
              </a>
            ) : null}
            <Link className="btn ghost" href="/partners">
              &larr; Back to all partners
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/provider-agreement", label: "Provider Agreement" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .legal-doc, .cta-row, .invite-box" />
    </>
  );
}
