import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "https://www.aestheticsuccessnetwork.com";

/**
 * /jobs/sitemap.xml — every live job page.
 *
 * Separate from the static app/sitemap.ts because these URLs are
 * generated, short-lived (30 days) and need real `lastModified` values.
 * Getting a new posting crawled quickly is most of the value of the
 * JobPosting markup; a sitemap that only refreshes on deploy would sit
 * on a new job for days.
 *
 * Only `live` posts are listed. Filled and expired pages stay reachable
 * but drop out of the sitemap, which is the signal we want: don't keep
 * pushing Google at a job nobody can apply for.
 */
export default async function jobsSitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("job_posts")
    .select("slug, approved_at, updated_at")
    .eq("status", "live")
    .order("approved_at", { ascending: false })
    .limit(5000);

  return (data ?? []).map((job) => ({
    url: `${SITE}/jobs/${job.slug}`,
    lastModified: new Date(job.updated_at ?? job.approved_at ?? Date.now()),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
}
