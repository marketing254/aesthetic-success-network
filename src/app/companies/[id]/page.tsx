import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/seo/JsonLd";
import { founding } from "@/lib/content";
import { companyExtras, getPublicCompany, hostOf, otherCompanies } from "@/lib/directoryProfiles";
import "@/app/directory.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "https://www.aestheticsuccessnetwork.com";

/**
 * /companies/[id]: PUBLIC profile for a verified company. Same publish gate
 * as the directory (approved + verified + logo + description, not hidden;
 * a covered company only while its paying company is live). Public-safe
 * fields only: never contact, billing or calendar details. Offers show as
 * a locked count; headlines, discounts and codes stay members-only.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const hit = await getPublicCompany(id).catch(() => null);
  if (!hit) return { title: "Company not found", robots: { index: false } };
  const { company } = hit;
  const description = company.description.replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${company.name}, Verified Company`,
    description,
    alternates: { canonical: `/companies/${company.id}` },
    openGraph: { title: `${company.name} | Aesthetic Success Network`, description },
  };
}

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Lock = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <rect x="3" y="7" width="10" height="7" rx="2" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);

export default async function PublicPartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hit = await getPublicCompany(id);
  if (!hit) notFound();
  const { company, expert } = hit;

  const [{ offerCount, spotlights }, more] = await Promise.all([companyExtras(id), otherCompanies(id, 3)]);
  const about = company.description.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    description: company.description.replace(/\s+/g, " ").slice(0, 300),
    logo: company.logo_url.startsWith("http") ? company.logo_url : `${SITE}${company.logo_url}`,
    url: company.website ?? `${SITE}/companies/${company.id}`,
    ...(expert ? { founder: { "@type": "Person", name: expert.name } } : {}),
  };

  return (
    <SitePage className="dx-page">
      <SiteNav active="/companies" />
      <JsonLd data={jsonLd} />

      <header className="dx-phero">
        <div className="dx-wrap dx-phero-grid dx-phero-grid--company">
          <div className="dx-logotile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={company.logo_url} alt={company.name} />
          </div>
          <div className="dx-phero-text">
            <nav className="dx-crumbs" aria-label="Breadcrumb">
              <Link href="/companies">Companies</Link>
              <span aria-hidden>/</span>
              <span>{company.name}</span>
            </nav>
            <div className="dx-eyebrow">
              <span className="dx-dot" />
              Verified company &middot; Aesthetic Success Network
            </div>
            <h1>{company.name}</h1>
            <div className="dx-ptopics">
              {company.category && <span>{company.category}</span>}
              {offerCount > 0 && <span className="dx-ptopic-gold">Member deal</span>}
            </div>
            <div className="dx-actions">
              <Link className="dx-btn dx-btn-gold" href="/join/member">
                Reserve a founding spot
              </Link>
              {company.website && (
                <a className="dx-btn dx-btn-ghost" href={company.website} target="_blank" rel="noopener noreferrer">
                  Visit {hostOf(company.website)}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="dx-wrap dx-pbody">
        <div className="dx-pmain">
          <section className="dx-block">
            <h2>About</h2>
            <div className="dx-prose">
              {about.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          <section className="dx-block">
            <h2>Member deal</h2>
            {offerCount > 0 ? (
              <div className="dx-deal">
                <div className="dx-deal-icon">
                  <Lock />
                </div>
                <div>
                  <b>
                    {offerCount} member-only offer{offerCount === 1 ? "" : "s"}
                  </b>
                  <p>
                    {company.name} gives members a deal at least as good as any offer it makes comparable customers.
                    The details and how to redeem are inside the member portal.
                  </p>
                </div>
              </div>
            ) : (
              <p className="dx-blocksub">
                Every verified company commits to a member-only deal. Details are shared with members inside the portal.
              </p>
            )}
          </section>

          {spotlights.length > 0 && (
            <section className="dx-block">
              <h2>Recent spotlights</h2>
              <ul className="dx-locked">
                {spotlights.map((s) => (
                  <li key={s.id}>
                    <span className="dx-blur" aria-hidden>
                      Member-only spotlight content
                    </span>
                    <span className="dx-lk">
                      <Lock /> {s.kind}
                      {s.dateLabel ? ` · ${s.dateLabel}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="dx-side">
          <div className="dx-sidecard dx-sidecard-dark">
            <div className="dx-sidecard-eyebrow">Member benefit</div>
            <h3>Get the {company.name} member deal</h3>
            <ul className="dx-checks">
              <li>
                <Tick /> Redeem the member-only offer from the portal
              </li>
              <li>
                <Tick /> Contact {company.name} directly, no middleman
              </li>
              <li>
                <Tick /> Every company is vetted by the ASN team
              </li>
            </ul>
            <Link className="dx-btn dx-btn-gold dx-btn-block" href="/join/member">
              Reserve your founding spot
            </Link>
            <p className="dx-sidecard-note">
              ${founding.priceMonthly} a month, locked in. Nothing to pay today.
            </p>
          </div>

          <div className="dx-sidecard">
            <dl className="dx-facts">
              {company.category && (
                <div>
                  <dt>Category</dt>
                  <dd>{company.category}</dd>
                </div>
              )}
              {company.website && (
                <div>
                  <dt>Website</dt>
                  <dd>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      {hostOf(company.website)}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd className="dx-verified">
                  <Tick /> Verified by the ASN team
                </dd>
              </div>
            </dl>
          </div>

          {expert && (
            <Link className="dx-sidecard dx-linkcard" href={`/experts/${expert.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={expert.headshot_url} alt="" className="dx-linkcard-photo" />
              <span>
                <small>Expert on the bench</small>
                <b>{expert.name}</b>
                <em>View expert profile &rarr;</em>
              </span>
            </Link>
          )}
        </aside>
      </main>

      {more.length > 0 && (
        <section className="dx-morerow">
          <div className="dx-wrap">
            <div className="dx-morerow-head">
              <h2>More companies</h2>
              <Link href="/companies#directory">View all &rarr;</Link>
            </div>
            <div className="dx-minis">
              {more.map((m) => (
                <Link key={m.id} href={`/companies/${m.id}`} className="dx-mini">
                  <span className="dx-mini-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image} alt="" loading="lazy" />
                  </span>
                  <span>
                    <b>{m.name}</b>
                    {m.sub && <small>{m.sub}</small>}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </SitePage>
  );
}
