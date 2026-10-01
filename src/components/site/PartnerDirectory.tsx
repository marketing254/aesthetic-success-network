"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Public-safe shape returned by GET /api/directory/partners. */
type Company = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * "Meet the companies" grid on /companies. Reads the public
 * /api/directory/partners (approved + verified companies with a logo and a
 * description; never contact or billing details). Renders an honest note
 * while the roster is empty: no placeholder listings.
 */
export default function PartnerDirectory() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/partners?page=1&pageSize=24", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { partners: [], total: 0 }))
      .then((body: { partners?: Company[]; companies?: Company[]; total?: number }) => {
        if (!active) return;
        setCompanies(body.partners ?? body.companies ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => {
        if (active) setCompanies([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (companies === null) {
    return (
      <div className="directory-grid company-grid" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ccard ccard-skeleton" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <p className="lead" style={{ margin: "34px auto 0" }}>
        Our founding company roster is being built right now. Verified companies land here as
        they&rsquo;re approved.
      </p>
    );
  }

  return (
    <>
      <div className="directory-grid company-grid">
        {companies.map((c) => (
          <article key={c.id} className="ccard">
            <Link href={`/companies/${c.id}`} className="cc-logo" aria-label={`${c.name} profile`}>
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt={c.name} loading="lazy" />
              ) : (
                <span className="cc-initials">{initials(c.name)}</span>
              )}
            </Link>
            <div className="cc-body">
              <div className="cc-top">
                <h3>
                  <Link href={`/companies/${c.id}`}>{c.name}</Link>
                </h3>
                <span className="cc-verified" title="Reviewed and verified by the ASN team">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 6.2l2.2 2.2L9.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified
                </span>
              </div>
              {c.category && <span className="cc-cat">{c.category}</span>}
              {c.description && <p>{c.description}</p>}
              <div className="cc-actions">
                <Link href={`/companies/${c.id}`} className="cc-link">
                  View profile and member offer &rarr;
                </Link>
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="cc-site">
                    {hostOf(c.website)}
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {total > companies.length && (
        <p className="lead" style={{ margin: "24px auto 0", fontSize: 14 }}>
          Showing {companies.length} of {total} companies. The full directory is inside the
          member portal.
        </p>
      )}
    </>
  );
}
