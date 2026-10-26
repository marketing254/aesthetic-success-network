"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "@/app/directory.css";

/** Public-safe shape returned by GET /api/directory/experts. */
type Expert = {
  id: string;
  name: string;
  specialty: string | null;
  company_name: string | null;
  bio: string | null;
  headshot_url: string | null;
  website: string | null;
};

function initials(name: string): string {
  const parts = name.replace(/^dr\.?\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

function tidy(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

/**
 * "Meet the experts" on /experts. Reads the public /api/directory/experts
 * (active experts with a headshot and a bio; never email, phone, billing or
 * booking links). Portrait cards with search and specialty filters. An
 * honest note while the bench is empty: no placeholder profiles.
 */
export default function ExpertDirectory() {
  const [experts, setExperts] = useState<Expert[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/experts?page=1&pageSize=24", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { experts: [], total: 0 }))
      .then((body: { experts?: Expert[]; total?: number }) => {
        if (!active) return;
        setExperts(body.experts ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => {
        if (active) setExperts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const topics = useMemo(
    () => [...new Set((experts ?? []).map((e) => tidy(e.specialty)).filter((t): t is string => !!t))],
    [experts],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (experts ?? []).filter((e) => {
      if (topic && tidy(e.specialty) !== topic) return false;
      if (!q) return true;
      return [e.name, e.company_name, e.specialty, e.bio].some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [experts, query, topic]);

  if (experts === null) {
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

  if (experts.length === 0) {
    return (
      <div className="dx">
        <div className="dx-empty">
          <b>Our founding bench is being built right now.</b>
          The first profiles land here as experts come on board.
        </div>
      </div>
    );
  }

  return (
    <div className="dx">
      {experts.length > 1 && (
        <div className="dx-toolbar">
          <label className="dx-search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search experts, companies or topics"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search experts"
            />
          </label>
          {topics.length > 1 && (
            <div className="dx-chips" role="group" aria-label="Filter by specialty">
              <button type="button" className={topic === null ? "on" : undefined} onClick={() => setTopic(null)}>
                All
              </button>
              {topics.map((t) => (
                <button key={t} type="button" className={topic === t ? "on" : undefined} onClick={() => setTopic(topic === t ? null : t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="dx-empty">
          <b>No experts match that search.</b>
          <button type="button" className="dx-reset" onClick={() => { setQuery(""); setTopic(null); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="dx-grid">
          {shown.map((e) => (
            <article key={e.id} className="dx-card dx-ecard">
              <Link href={`/experts/${e.id}`} className="dx-ecard-photo" aria-label={`${e.name} profile`}>
                {e.headshot_url ? (
                  <Image src={e.headshot_url} alt={`${e.name}, ${tidy(e.specialty) ?? "ASN expert"}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px" style={{ objectFit: "cover", objectPosition: "center 22%" }} />
                ) : (
                  <span className="dx-initials">{initials(e.name)}</span>
                )}
                <span className="dx-badge">
                  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2.5 6.2l2.2 2.2L9.6 3.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Vetted expert
                </span>
              </Link>
              <div className="dx-body">
                {e.company_name && <div className="dx-over">{e.company_name}</div>}
                <h3>
                  <Link href={`/experts/${e.id}`}>{e.name}</Link>
                </h3>
                {e.specialty && <div className="dx-spec">{tidy(e.specialty)}</div>}
                {e.bio && <p className="dx-text">{e.bio}</p>}
                <div className="dx-foot">
                  <Link href={`/experts/${e.id}`} className="dx-more">
                    View profile
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="dx-count">
        {shown.length === experts.length
          ? `${experts.length} vetted expert${experts.length === 1 ? "" : "s"}`
          : `Showing ${shown.length} of ${experts.length}`}
        {total > experts.length ? ". The full bench is inside the member portal." : ""}
      </p>
    </div>
  );
}
