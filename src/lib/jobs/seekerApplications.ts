"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/lib/jobs/useLiveRefresh";

/**
 * Shared loader for the job seeker's portal pages. One fetch shape, one
 * redirect rule (signed out → login, back here afterwards), one
 * auto-refresh so a status the practice sets appears without a reload.
 */

export type SeekerJobRef = {
  slug: string;
  practice_name: string;
  role: string;
  role_other: string | null;
  location: string;
  status: string;
};

export type SeekerApplication = {
  id: string;
  status: string;
  status_changed_at: string | null;
  created_at: string;
  delivered_at: string | null;
  cv_filename: string | null;
  // supabase-js types an embedded relation as an array or an object
  // depending on the shape it infers; normalise on read.
  job_posts: SeekerJobRef | SeekerJobRef[] | null;
};

export type SeekerInfo = { first_name: string; email: string };

export function jobOf(row: SeekerApplication): SeekerJobRef | null {
  if (!row.job_posts) return null;
  return Array.isArray(row.job_posts) ? (row.job_posts[0] ?? null) : row.job_posts;
}

export function useSeekerApplications(returnTo: string) {
  const router = useRouter();
  const [rows, setRows] = useState<SeekerApplication[] | null>(null);
  const [seeker, setSeeker] = useState<SeekerInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/seeker/applications", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace(`/seeker/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      const body = (await res.json()) as { ok?: boolean; applications?: SeekerApplication[]; seeker?: SeekerInfo; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Couldn't load your applications.");
        return;
      }
      setRows(body.applications ?? []);
      if (body.seeker) setSeeker(body.seeker);
      setErr(null);
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    }
  }, [router, returnTo]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load);

  return { rows, seeker, err, reload: load };
}
