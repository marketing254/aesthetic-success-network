"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

/**
 * "Meet the experts" grid on /experts. Reads DMN's public
 * /api/directory/experts (active experts with a headshot and a bio; never
 * email, phone, billing or booking links). Renders a quiet, honest note
 * while the bench is empty: there are no placeholder profiles here.
 */
export default function ExpertDirectory() {
  const [experts, setExperts] = useState<Expert[] | null>(null);
  const [total, setTotal] = useState(0);

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

  if (experts === null) return null;

  if (experts.length === 0) {
    return (
      <p className="lead" style={{ margin: "34px auto 0" }}>
        Our founding bench is being built right now. The first profiles land here as experts
        come on board.
      </p>
    );
  }

  return (
    <>
      <div className="directory-grid company-grid expert-grid">
        {experts.map((e) => (
          <article key={e.id} className="ccard ecard">
            <div className="cc-body">
              <div className="ec-head">
                <Link href={`/experts/${e.id}`} className="ec-photo" aria-label={`${e.name} profile`}>
                  {e.headshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.headshot_url} alt={e.name} loading="lazy" />
                  ) : (
                    <span className="cc-initials">{initials(e.name)}</span>
                  )}
                </Link>
                <div className="ec-id">
                  <h3>
                    <Link href={`/experts/${e.id}`}>{e.name}</Link>
                  </h3>
                  {e.company_name && <div className="ec-company">{e.company_name}</div>}
                  {e.specialty && <span className="cc-cat">{e.specialty}</span>}
                </div>
              </div>
              {e.bio && <p>{e.bio}</p>}
              <div className="cc-actions">
                <Link href={`/experts/${e.id}`} className="cc-link">
                  View profile &rarr;
                </Link>
                <span className="cc-verified" title="Reviewed and vetted by the ASN team">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 6.2l2.2 2.2L9.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Vetted expert
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {total > experts.length && (
        <p className="lead" style={{ margin: "24px auto 0", fontSize: 14 }}>
          Showing {experts.length} of {total} experts. The full bench is inside the member
          portal.
        </p>
      )}
    </>
  );
}
