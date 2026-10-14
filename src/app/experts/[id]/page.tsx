import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/seo/JsonLd";
import { founding } from "@/lib/content";
import { protocolsFor } from "@/lib/foundingExperts";
import { expertExtras, getPublicExpert, hostOf, otherExperts } from "@/lib/directoryProfiles";
import "@/app/directory.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "https://www.aestheticsuccessnetwork.com";

/**
 * /experts/[id]: PUBLIC profile for an expert on the bench. Same publish
 * gate as the directory (active + headshot + bio, not hidden). Public-safe
 * fields only: never email, phone, billing or the booking link (booking is
 * a member benefit). Kit titles and spotlight kinds are public teasers.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const hit = await getPublicExpert(id).catch(() => null);
  if (!hit) return { title: "Expert not found", robots: { index: false } };
  const { expert } = hit;
  const description = expert.bio.replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${expert.name}, ASN Expert`,
    description,
    alternates: { canonical: `/experts/${expert.id}` },
    openGraph: { title: `${expert.name} | Aesthetic Success Network`, description, images: [{ url: expert.headshot_url }] },
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

export default async function PublicExpertProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hit = await getPublicExpert(id);
  if (!hit) notFound();
  const { expert, company } = hit;

  const [{ kits, spotlights }, more] = await Promise.all([expertExtras(id), otherExperts(id, 3)]);
  const protocols = protocolsFor(expert.name);
  const bio = expert.bio.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  const role = [expert.specialty, expert.company_name].filter(Boolean).join(" · ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: expert.name,
    description: expert.bio.replace(/\s+/g, " ").slice(0, 300),
    image: expert.headshot_url.startsWith("http") ? expert.headshot_url : `${SITE}${expert.headshot_url}`,
    url: `${SITE}/experts/${expert.id}`,
    ...(expert.company_name ? { worksFor: { "@type": "Organization", name: expert.company_name } } : {}),
    ...(expert.website ? { sameAs: [expert.website] } : {}),
  };

  return (
    <SitePage className="dx-page">
      <SiteNav active="/experts" />
      <JsonLd data={jsonLd} />

      <header className="dx-phero">
        <div className="dx-wrap dx-phero-grid">
          <div className="dx-portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expert.headshot_url} alt={expert.name} />
          </div>
          <div className="dx-phero-text">
            <nav className="dx-crumbs" aria-label="Breadcrumb">
              <Link href="/experts">Experts</Link>
              <span aria-hidden>/</span>
              <span>{expert.name}</span>
            </nav>
            <div className="dx-eyebrow">
              <span className="dx-dot" />
              Vetted expert &middot; Aesthetic Success Network
            </div>
            <h1>{expert.name}</h1>
            {role && <p className="dx-role">{role}</p>}
            {expert.topics.length > 0 && (
              <div className="dx-ptopics">
                {expert.topics.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
            <div className="dx-actions">
              <Link className="dx-btn dx-btn-gold" href="/join/member">
                Reserve a founding spot
              </Link>
              {expert.website && (
                <a className="dx-btn dx-btn-ghost" href={expert.website} target="_blank" rel="noopener noreferrer">
                  Visit {hostOf(expert.website)}
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
              {bio.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          {protocols.length > 0 && (
            <section className="dx-block">
              <h2>Protocols</h2>
              <p className="dx-blocksub">
                Part of the Expert Signature Series. The full Protocols (videos, guides, scripts and checklists) are
                available to members.
              </p>
              <div className="dx-protocols">
                {protocols.map((p) => (
                  <figure key={p.src}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
                    <figcaption>{p.title}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {kits.length > 0 && (
            <section className="dx-block">
              <h2>In the library</h2>
              <ul className="dx-locked">
                {kits.map((k) => (
                  <li key={k}>
                    <span>{k}</span>
                    <span className="dx-lk">
                      <Lock /> Members only
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
            <h3>Work with {expert.name}</h3>
            <ul className="dx-checks">
              <li>
                <Tick /> Book time with {expert.name} from the member portal
              </li>
              {protocols.length > 0 || kits.length > 0 ? (
                <li>
                  <Tick /> Watch the full Protocols and use the templates
                </li>
              ) : null}
              <li>
                <Tick /> Get an instant, AI-assisted answer from the Expert Hotline
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
              {expert.company_name && (
                <div>
                  <dt>Company</dt>
                  <dd>{company ? <Link href={`/companies/${company.id}`}>{expert.company_name}</Link> : expert.company_name}</dd>
                </div>
              )}
              {expert.specialty && (
                <div>
                  <dt>Specialty</dt>
                  <dd>{expert.specialty}</dd>
                </div>
              )}
              {expert.website && (
                <div>
                  <dt>Website</dt>
                  <dd>
                    <a href={expert.website} target="_blank" rel="noopener noreferrer">
                      {hostOf(expert.website)}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd className="dx-verified">
                  <Tick /> Vetted by the ASN team
                </dd>
              </div>
            </dl>
          </div>

          {company && (
            <Link className="dx-sidecard dx-linkcard" href={`/companies/${company.id}`}>
              <span className="dx-linkcard-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={company.logo_url} alt="" />
              </span>
              <span>
                <small>Also on the network</small>
                <b>{company.name}</b>
                <em>View company profile &rarr;</em>
              </span>
            </Link>
          )}
        </aside>
      </main>

      {more.length > 0 && (
        <section className="dx-morerow">
          <div className="dx-wrap">
            <div className="dx-morerow-head">
              <h2>More experts</h2>
              <Link href="/experts#bench">View all &rarr;</Link>
            </div>
            <div className="dx-minis">
              {more.map((m) => (
                <Link key={m.id} href={`/experts/${m.id}`} className="dx-mini">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="" className="dx-mini-photo" loading="lazy" />
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
