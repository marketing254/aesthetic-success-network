"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "@/app/directory.css";

/** Public-safe shape returned by GET /api/directory/partners. */
type Company = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  has_offer?: boolean;
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
 * "Meet the companies" on /companies. Reads the public
 * /api/directory/partners (approved + verified companies with a logo and a
 * description; never contact or billing details). Logo-led cards with
 * search and category filters. An honest note while the roster is empty.
 */
export default function PartnerDirectory() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

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

  const categories = useMemo(
    () => [...new Set((companies ?? []).map((c) => c.category?.trim()).filter((c): c is string => !!c))],
    [companies],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (companies ?? []).filter((c) => {
      if (category && c.category?.trim() !== category) return false;
      if (!q) return true;
      return [c.name, c.category, c.description].some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [companies, query, category]);

  if (companies === null) {
    return (
      <div className="dx">
        <div className="dx-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dx-card dx-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="dx">
        <div className="dx-empty">
          <b>Our founding company roster is being built right now.</b>
          Verified companies land here as they&rsquo;re approved.
        </div>
      </div>
    );
  }

  return (
    <div className="dx">
      {companies.length > 1 && (
        <div className="dx-toolbar">
          <label className="dx-search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search companies or categories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search companies"
            />
          </label>
          {categories.length > 1 && (
            <div className="dx-chips" role="group" aria-label="Filter by category">
              <button type="button" className={category === null ? "on" : undefined} onClick={() => setCategory(null)}>
                All
              </button>
              {categories.map((c) => (
                <button key={c} type="button" className={category === c ? "on" : undefined} onClick={() => setCategory(category === c ? null : c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="dx-empty">
          <b>No companies match that search.</b>
          <button type="button" className="dx-reset" onClick={() => { setQuery(""); setCategory(null); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="dx-grid">
          {shown.map((c) => (
            <article key={c.id} className="dx-card dx-ccard">
              <Link href={`/companies/${c.id}`} className="dx-ccard-logo" aria-label={`${c.name} profile`}>
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo_url} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="dx-initials">{initials(c.name)}</span>
                )}
              </Link>
              <div className="dx-body">
                <div className="dx-tags">
                  {c.category && <span className="dx-tag">{c.category}</span>}
                  {c.has_offer && <span className="dx-tag dx-tag-gold">Member deal</span>}
                </div>
                <h3>
                  <Link href={`/companies/${c.id}`}>{c.name}</Link>
                  <span className="dx-tick" title="Verified by the ASN team" aria-label="Verified">
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                      <path d="M2.5 6.2l2.2 2.2L9.6 3.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </h3>
                {c.description && <p className="dx-text">{c.description}</p>}
                <div className="dx-foot">
                  <Link href={`/companies/${c.id}`} className="dx-more">
                    View profile
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="dx-site">
                      {hostOf(c.website)}
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="dx-count">
        {shown.length === companies.length
          ? `${companies.length} verified compan${companies.length === 1 ? "y" : "ies"}`
          : `Showing ${shown.length} of ${companies.length}`}
        {total > companies.length ? ". The full directory is inside the member portal." : ""}
      </p>
    </div>
  );
}
