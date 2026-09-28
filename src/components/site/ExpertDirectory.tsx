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
      <div className="directory-grid">
        {experts.map((e) => (
          <Link key={e.id} className="dcard" href={`/experts/${e.id}`}>
            <div className="dc-avatar">
              {e.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.headshot_url} alt={e.name} />
              ) : (
                initials(e.name)
              )}
            </div>
            <h3>{e.name}</h3>
            {(e.specialty || e.company_name) && (
              <div className="dc-sub">{e.specialty ?? e.company_name}</div>
            )}
            {e.bio && <p>{e.bio}</p>}
          </Link>
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
