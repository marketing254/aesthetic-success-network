"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Expert = {
  id: string;
  name: string;
  company: string | null;
  topics: string | null;
  bio: string | null;
  headshotUrl: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

/**
 * "Meet the experts" directory grid on /experts. Reads the public
 * /api/directory/experts endpoint (status='approved' + bio filled in).
 * Renders nothing but a quiet placeholder note when the bench is empty
 * — there are no fake profiles here.
 */
export default function ExpertDirectory() {
  const [experts, setExperts] = useState<Expert[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/directory/experts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { experts: [] }))
      .then((body: { experts?: Expert[] }) => {
        if (active) setExperts(body.experts ?? []);
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
        Our founding bench is being built right now &mdash; the first profiles land here as
        experts come on board.
      </p>
    );
  }

  return (
    <div className="directory-grid">
      {experts.map((e) => (
        <Link key={e.id} className="dcard" href={`/experts/${e.id}`}>
          <div className="dc-avatar">
            {e.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.headshotUrl} alt={e.name} />
            ) : (
              initials(e.name)
            )}
          </div>
          <h3>{e.name}</h3>
          {(e.topics || e.company) && <div className="dc-sub">{e.topics ?? e.company}</div>}
          {e.bio && <p>{e.bio}</p>}
        </Link>
      ))}
    </div>
  );
}
