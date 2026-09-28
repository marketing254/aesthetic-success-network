import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";
import { verifyRenewToken } from "@/lib/jobs/renewToken";
import { JOB_LIVE_DAYS } from "@/lib/jobs/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/renew?t=<signed token>
 *
 * The day-25 email's one-click renewal. Deliberately a GET with no
 * session: the member taps it from their phone and it just works.
 * Authorisation is the signature on the token, not a cookie.
 *
 * Always redirects to the dashboard with a result flag rather than
 * returning JSON — a human clicked this, not a script.
 */
export async function GET(req: Request) {
  const route = "GET /api/jobs/renew";
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const back = (result: string) => NextResponse.redirect(`${base}/dashboard/jobs?renew=${result}`);

  const jobId = verifyRenewToken(url.searchParams.get("t"));
  if (!jobId) return back("invalid");

  try {
    const admin = getSupabaseAdmin();
    const { data: job } = await admin
      .from("job_posts")
      .select("id, status, renewal_count, approved_at")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return back("invalid");

    // Renewable from live (extend early) or expired (bring it back).
    // A filled post is not — they've hired, and re-listing it would put
    // a job nobody can apply for back in front of the group.
    if (job.status !== "live" && job.status !== "expired") return back("unavailable");

    const now = new Date();
    const { error } = await admin
      .from("job_posts")
      .update({
        status: "live",
        expires_at: new Date(now.getTime() + JOB_LIVE_DAYS * 86_400_000).toISOString(),
        renewed_at: now.toISOString(),
        renewal_count: job.renewal_count + 1,
        expiry_warning_sent_at: null,
      })
      .eq("id", jobId);
    if (error) throw error;

    return back("ok");
  } catch (err) {
    // A failed renewal still lands the member somewhere useful.
    serverError(err, { route });
    return back("error");
  }
}
