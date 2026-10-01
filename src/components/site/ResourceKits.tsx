"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** Shape returned by DMN's public GET /api/resources (locked-card metadata only). */
type Kit = {
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  resourceCardUrl: string | null;
  videoCount: number;
  itemCount: number;
  isFree: boolean;
  previewVideoUrl: string | null;
  featured: boolean;
};

/**
 * Locked kit teasers for /resources (ASN design). Titles, categories and
 * card art only: the kit files never reach the public page. Every card
 * sends the visitor to the DMN member signup. Honest empty state while the
 * library is being built.
 */
export default function ResourceKits() {
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let active = true;
    fetch("/api/resources", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { kits: [] }))
      .then((body: { kits?: Kit[] }) => {
        if (active) setKits(body.kits ?? []);
      })
      .catch(() => {
        if (active) setKits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const k of kits ?? []) if (k.category) set.add(k.category);
    return Array.from(set).sort();
  }, [kits]);

  if (kits === null) return null;

  if (kits.length === 0) {
    return (
      <p className="lead">
        The library is being built by our founding experts. New kits land weekly once the
        network opens, and members see them in the portal as they go live.
      </p>
    );
  }

  const visible = filter === "All" ? kits : kits.filter((k) => k.category === filter);

  return (
    <>
      {categories.length > 1 && (
        <div className="filter-row">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              className={c === filter ? "on" : undefined}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="feature-grid--cards resource-grid">
        {visible.map((k) => (
          <Link key={k.slug} className="feat kit-card" href="/join/member">
            <div
              className="kc-art"
              style={k.resourceCardUrl ? { backgroundImage: `url("${k.resourceCardUrl}")` } : undefined}
            >
              <span className="kc-lock">Join to unlock</span>
            </div>
            {k.category ? <span className="rc-kind">{k.category}</span> : null}
            <h3>{k.title}</h3>
            <p>{k.summary ?? "Training video, action guide and worksheet."}</p>
            <div className="kc-meta">
              {k.itemCount} {k.itemCount === 1 ? "resource" : "resources"}
              {k.videoCount > 0 ? ` · ${k.videoCount} video${k.videoCount === 1 ? "" : "s"}` : ""}
              {" · Members only"}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
