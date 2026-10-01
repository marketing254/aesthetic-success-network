import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { validateJobInput } from "@/lib/jobs/validate";
import { buildJobSlug } from "@/lib/jobs/slug";
import { notifyTeamNewJob } from "@/lib/email/jobEmails";
import { employmentLabel, roleLabel } from "@/lib/jobs/constants";
import { formatPay } from "@/lib/jobs/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Posting is MEMBERS ONLY — requirePaidMember, not requireMember.
 * Browsing the board is public (see /jobs), and that asymmetry is the
 * whole design: candidates would never pay to look for a job, but
 * getting your vacancy in front of the group is the part worth paying
 * for. Keep this guard as-is.
 */

/**
 * GET /api/member/jobs
 *
 * The member's own posts, every state included — they need to see
 * what's still in review and what got rejected, not just what's live.
 */
export async function GET() {
  const route = "GET /api/member/jobs";
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("job_posts")
      .select(
        "id, slug, practice_name, role, role_other, employment_type, location, workplace, " +
          "pay_min, pay_max, pay_unit, status, submitted_at, approved_at, rejection_reason, " +
          "expires_at, filled_at, renewal_count, view_count, application_count, " +
          "promoted_facebook_at, promoted_email_at, created_at",
      )
      .eq("member_id", guard.memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ ok: true, jobs: data ?? [] });
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * POST /api/member/jobs
 *
 * Create a post. It lands in `pending_review`, never live — every post
 * is reviewed by a human before it goes public, because a public page
 * carrying our name attracts spam the moment it ranks. `draft: true`
 * saves without submitting.
 */
export async function POST(req: Request) {
  const route = "POST /api/member/jobs";
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const parsed = validateJobInput(body);
  if (!parsed.ok) return apiError.validation(parsed.error, route);

  const draft = body.draft === true;

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: inserted, error } = await admin
      .from("job_posts")
      .insert({
        member_id: guard.memberId,
        slug: buildJobSlug(parsed.value),
        ...parsed.value,
        status: draft ? "draft" : "pending_review",
        submitted_at: draft ? null : now,
      })
      .select("id, slug, status")
      .single();
    if (error) throw error;

    // The queue only works if someone knows there's something in it.
    // Deliberately not awaited into the failure path: a dead SMTP box
    // must not turn a saved post into a 500 the member sees.
    if (!draft) {
      await notifyTeamNewJob({
        jobId: inserted.id,
        practiceName: parsed.value.practice_name,
        roleLabel: roleLabel(parsed.value.role, parsed.value.role_other),
        location: parsed.value.location,
        memberEmail: guard.email,
        memberName: guard.firstName || null,
        employmentLabel: employmentLabel(parsed.value.employment_type),
        payLine: formatPay(parsed.value.pay_min ?? null, parsed.value.pay_max ?? null, parsed.value.pay_unit),
        postFormat: parsed.value.post_format ?? "detailed",
      });
    }

    return NextResponse.json({ ok: true, job: inserted });
  } catch (err) {
    return serverError(err, { route });
  }
}
