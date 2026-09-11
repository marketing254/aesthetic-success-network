"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Partner = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

/**
 * "Meet the partners" directory grid on /partners. Reads the public
 * /api/directory/partners endpoint (status='approved' + description
 * filled in). Renders a quiet placeholder note when there are no live
 * partners yet — no fake vendor listings.
 */
export default function PartnerDirectory() {
  const [partners, setPartners] = useState<Partner[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/partners", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { partners: [] }))
      .then((body: { partners?: Partner[] }) => {
        if (active) setPartners(body.partners ?? []);
      })
      .catch(() => {
        if (active) setPartners([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (partners === null) return null;

  if (partners.length === 0) {
    return (
      <p className="lead" style={{ margin: "34px auto 0" }}>
        Our founding partner roster is being built right now &mdash; verified vendors land here
        as they&rsquo;re approved.
      </p>
    );
  }

  return (
    <div className="directory-grid">
      {partners.map((p) => (
        <Link key={p.id} className="dcard" href={`/partners/${p.id}`}>
          <div className="dc-avatar">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt={p.name} />
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
  );
}
