import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { JOB_EXPIRY_WARNING_DAY, JOB_LIVE_DAYS, roleLabel } from "@/lib/jobs/constants";
import { signRenewToken } from "@/lib/jobs/renewToken";
import { sendJobExpiring } from "@/lib/email/jobEmails";

/**
 * The 30-day lifecycle sweep, run daily by /api/cron/jobs.
 *
 * Two jobs, in this order:
 *   1. warn  — day 25 of 30, email the poster a one-click renewal link
 *   2. expire — anything past its expires_at comes off the board
 *
 * Both are idempotent. `expiry_warning_sent_at` is what stops a member
 * getting the same reminder every day for five days, and expiring an
 * already-expired post is a no-op because the query only looks at live
 * ones. Overlapping or manually triggered runs are safe.
 *
 * Auto-expiry is not housekeeping — it's the thing that keeps the board
 * honest. A board full of dead listings is exactly how these rot, and
 * stale postings are also what gets a site dropped from Google for Jobs.
 */

const WARNING_WINDOW_DAYS = JOB_LIVE_DAYS - JOB_EXPIRY_WARNING_DAY; // 5

export type ExpirySweepResult = {
  warned: number;
  expired: number;
  warnFailures: number;
};

export async function processJobExpiry(now: Date = new Date()): Promise<ExpirySweepResult> {
  const admin = getSupabaseAdmin();
  const result: ExpirySweepResult = { warned: 0, expired: 0, warnFailures: 0 };

  // ---------------------------------------------------------------
  // 1. Day-25 warning
  // ---------------------------------------------------------------
  const warnBefore = new Date(now.getTime() + WARNING_WINDOW_DAYS * 86_400_000).toISOString();

  const { data: expiring, error: expiringErr } = await admin
    .from("job_posts")
    .select("id, slug, member_id, role, role_other, practice_name, expires_at, view_count, application_count")
    .eq("status", "live")
    .is("expiry_warning_sent_at", null)
    .lte("expires_at", warnBefore)
    .gt("expires_at", now.toISOString())
    .limit(200);

  if (expiringErr) {
    console.error("[jobs:expiry] failed to read expiring posts", expiringErr);
  }

  for (const job of expiring ?? []) {
    const poster = await loadPoster(job.member_id);
    if (!poster) {
      // No mailbox to warn. Stamp it anyway so the sweep doesn't retry
      // this row every single day forever.
      await admin.from("job_posts").update({ expiry_warning_sent_at: now.toISOString() }).eq("id", job.id);
      continue;
    }

    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(job.expires_at!).getTime() - now.getTime()) / 86_400_000),
    );

    const sent = await sendJobExpiring({
      to: poster.email,
      firstName: poster.firstName,
      lastName: poster.lastName,
      roleLabel: roleLabel(job.role, job.role_other),
      practiceName: job.practice_name,
      slug: job.slug,
      daysLeft,
      viewCount: job.view_count ?? 0,
      applicationCount: job.application_count ?? 0,
      renewUrl: `${siteUrl()}/api/jobs/renew?t=${signRenewToken(job.id, now)}`,
    });

    if (sent) {
      // Only stamp on a successful send, so a transient SMTP outage
      // retries tomorrow instead of silently swallowing the reminder.
      await admin
        .from("job_posts")
        .update({ expiry_warning_sent_at: now.toISOString() })
        .eq("id", job.id);
      result.warned += 1;
    } else {
      result.warnFailures += 1;
    }
  }

  // ---------------------------------------------------------------
  // 2. Expire anything past its date
  // ---------------------------------------------------------------
  const { data: expiredRows, error: expireErr } = await admin
    .from("job_posts")
    .update({ status: "expired" })
    .eq("status", "live")
    .lte("expires_at", now.toISOString())
    .select("id");

  if (expireErr) {
    console.error("[jobs:expiry] failed to expire posts", expireErr);
  } else {
    result.expired = (expiredRows ?? []).length;
  }

  return result;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
}

async function loadPoster(memberId: string): Promise<{ email: string; firstName: string; lastName: string | null } | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("members")
    .select("email, first_name, last_name, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!data?.email) return null;
  // Don't email someone who has left. Their post still expires on
  // schedule — it just does it without a reminder they can't act on.
  if (data.status === "churned") return null;
  return { email: data.email, firstName: data.first_name || "there", lastName: data.last_name ?? null };
}
