import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isHiddenFromDirectory } from "@/lib/directoryVisibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /companies/[id]: PUBLIC profile page for an accepted company, in the ASN
 * design. Data and gating are DMN's: only approved + verified companies with
 * a logo and a description are public (a covered company shows only while
 * its paying company is live). Public-safe fields only: never contact or
 * billing details, and never the calendar link (member-portal benefit).
 * Offers and spotlights render as locked teasers: ids/kinds only.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

async function getPartner(id: string) {
  const sb = getSupabaseAdmin();
  const { data: v } = await sb
    .from("vendors")
    .select("id, company_name, display_name, category, description, logo_url, avatar_url, website, status, verified, billing_parent_id, contact_email")
    .eq("id", id)
    .maybeSingle();
  if (!v || v.status !== "approved" || !v.verified || !(v.logo_url ?? v.avatar_url) || !v.description) return null;
  if (isHiddenFromDirectory(v.contact_email)) return null;
  if (v.billing_parent_id) {
    const { data: parent } = await sb
      .from("vendors")
      .select("status, verified")
      .eq("id", v.billing_parent_id)
      .maybeSingle();
    if (!parent || parent.status !== "approved" || !parent.verified) return null;
  }
  return v;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await getPartner(id).catch(() => null);
  if (!company) return { title: "Company not found", robots: { index: false } };
  const name = company.display_name || company.company_name || "ASN Company";
  return {
    title: `${name}, Verified Company`,
    description: String(company.description).slice(0, 160),
    alternates: { canonical: `/companies/${company.id}` },
  };
}

export default async function PublicPartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getPartner(id);
  if (!company) notFound();

  const sb = getSupabaseAdmin();

  // Offers as a LOCKED teaser: ids only. Headlines, discounts and promo
  // codes stay members-only.
  const { data: offerRows } = await sb
    .from("offers")
    .select("id")
    .eq("vendor_id", id)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false });
  const offerCount = (offerRows ?? []).length;

  // Spotlight teaser: kind + date only.
  const { data: spotRows } = await sb
    .from("profile_spotlights")
    .select("id, kind, event_date")
    .eq("vendor_id", id)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(5);
  const spotlights = (spotRows ?? []).map((s) => ({
    id: s.id as string,
    kind: String(s.kind).charAt(0).toUpperCase() + String(s.kind).slice(1),
    dateLabel: s.event_date
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(s.event_date))
      : null,
  }));

  const name = company.display_name || company.company_name || "ASN Company";
  const logo = company.logo_url ?? company.avatar_url ?? null;
  const descParagraphs = String(company.description)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <SitePage>
      <SiteNav active="/companies" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap" style={{ display: "block" }}>
          <div className="profile-head">
            <div className="profile-avatar">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={name} />
              ) : (
                initials(name)
              )}
            </div>
            <div>
              <span className="eyebrow">Verified Company</span>
              <h1 style={{ fontSize: 40 }}>{name}</h1>
              {company.category ? (
                <p className="sub" style={{ marginBottom: 0 }}>
                  {company.category}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <article className="profile-bio">
            {descParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          <div className="profile-section">
            <span className="kicker">Member deal</span>
            {offerCount > 0 ? (
              <div className="locked-list">
                {Array.from({ length: offerCount }, (_, i) => (
                  <div className="row" key={i}>
                    <span>
                      <span className="blur" aria-hidden>
                        Member-only offer details
                      </span>
                    </span>
                    <span className="lk">Offer · Members only</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="lead" style={{ margin: 0 }}>
                This company&rsquo;s member-only offer is confirmed with members directly inside the
                portal and requires an active membership to redeem.
              </p>
            )}
          </div>

          {spotlights.length > 0 && (
            <div className="profile-section">
              <span className="kicker">Recent spotlights</span>
              <div className="locked-list">
                {spotlights.map((s) => (
                  <div className="row" key={s.id}>
                    <span>
                      <span className="blur" aria-hidden>
                        Member-only spotlight content
                      </span>
                    </span>
                    <span className="lk">
                      {s.kind}
                      {s.dateLabel ? ` · ${s.dateLabel}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="profile-section">
            <span className="kicker">Reach this company</span>
            <p className="lead" style={{ margin: "0 0 16px" }}>
              Members contact companies directly and redeem the deal from the portal.
            </p>
            <div className="cta-row" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link className="btn bronze" href="/join/member">
                Start your membership
              </Link>
              {company.website ? (
                <a className="btn ghost" href={company.website} target="_blank" rel="noopener noreferrer">
                  Visit website
                </a>
              ) : null}
              <Link className="btn ghost" href="/companies">
                &larr; Back to all companies
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx revealSelector="section .profile-bio, .profile-section" />
    </SitePage>
  );
}
