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

/**
 * "Meet the companies" grid on /partners. Reads DMN's public
 * /api/directory/partners (approved + verified companies with a logo and a
 * description; never contact or billing details). Renders an honest note
 * while the roster is empty: no placeholder listings.
 */
export default function PartnerDirectory() {
  const [companies, setPartners] = useState<Company[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/partners?page=1&pageSize=24", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { companies: [], total: 0 }))
      .then((body: { companies?: Company[]; total?: number }) => {
        if (!active) return;
        setPartners(body.companies ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => {
        if (active) setPartners([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (companies === null) return null;

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
      <div className="directory-grid">
        {companies.map((p) => (
          <Link key={p.id} className="dcard" href={`/companies/${p.id}`}>
            <div className="dc-avatar">
              {p.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logo_url} alt={p.name} />
              ) : (
                initials(p.name)
              )}
            </div>
            <h3>{p.name}</h3>
            {p.category && <div className="dc-sub">{p.category}</div>}
            {p.description && <p>{p.description}</p>}
          </Link>
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
