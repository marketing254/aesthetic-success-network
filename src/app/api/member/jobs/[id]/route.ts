import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { validateJobInput } from "@/lib/jobs/validate";
import { notifyTeamNewJob } from "@/lib/email/jobEmails";
import { JOB_LIVE_DAYS, employmentLabel, roleLabel } from "@/lib/jobs/constants";
import { formatPay } from "@/lib/jobs/format";
import type { JobPostsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/jobs/[id]
 *
 * One of the member's own posts, whole, so /dashboard/jobs/[id]/edit can
 * populate the form. The list endpoint deliberately omits the long
 * fields (description, requirements, apply route, start date) because
 * the cards don't render them; the edit form needs all of them.
 *
 * Ownership is checked the same way every other action here checks it,
 * and a post belonging to someone else 404s rather than 403s — a 403
 * would confirm the id exists.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const route = "GET /api/member/jobs/[id]";
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const admin = getSupabaseAdmin();
    // select("*") because supabase-js only infers row types from a string
    // literal, and the edit form reads nearly every content column.
    const { data: job } = await admin.from("job_posts").select("*").eq("id", id).maybeSingle();
    if (!job || job.member_id !== guard.memberId) return apiError.notFound(route);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * PATCH /api/member/jobs/[id]
 *
 * The poster's own controls on their own post:
 *   action: "fill"      — mark as filled. Always available on a live
 *                         post; a board full of stale filled jobs is how
 *                         these things rot.
 *   action: "renew"     — reset the 30-day clock. Fired by the day-25
 *                         email's one-click link, or the dashboard.
 *   action: "unfill"    — undo a fill (they clicked it too early).
 *   action: "edit"      — update the content. Sends it BACK to review if
 *                         it was live: an approved post that can be
 *                         silently rewritten defeats the publish gate.
 *   action: "submit"    — send a draft to the review queue.
 *
 * Ownership is checked against the member's own id on every action, so
 * knowing another member's job id gets you nothing.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const route = "PATCH /api/member/jobs/[id]";
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    const admin = getSupabaseAdmin();

    const { data: job } = await admin
      .from("job_posts")
      .select("id, member_id, slug, status, role, role_other, expires_at, renewal_count, approved_at")
      .eq("id", id)
      .maybeSingle();

    // Same 404 for "doesn't exist" and "isn't yours" — no existence oracle.
    if (!job || job.member_id !== guard.memberId) return apiError.notFound(route);

    const now = new Date();
    const nowIso = now.toISOString();

    switch (action) {
      case "fill": {
        if (job.status !== "live") {
          return apiError.validation("Only a live post can be marked as filled.", route);
        }
        const { error } = await admin
          .from("job_posts")
          .update({ status: "filled", filled_at: nowIso })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, status: "filled" });
      }

      case "unfill": {
        if (job.status !== "filled") {
          return apiError.validation("That post isn't marked as filled.", route);
        }
        // If the original 30 days already ran out while it sat filled,
        // putting it back live with a past expiry would make it invisible
        // and confusing. Give it a fresh window instead.
        const stillInWindow = job.expires_at ? new Date(job.expires_at) > now : false;
        const patch: Partial<JobPostsRow> = stillInWindow
          ? { status: "live", filled_at: null }
          : {
              status: "live",
              filled_at: null,
              expires_at: new Date(now.getTime() + JOB_LIVE_DAYS * 86_400_000).toISOString(),
              // Fresh window means the day-25 email has to fire again.
              expiry_warning_sent_at: null,
            };
        const { error } = await admin.from("job_posts").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, status: "live" });
      }

      case "renew": {
        if (job.status !== "live" && job.status !== "expired") {
          return apiError.validation("Only a live or expired post can be renewed.", route);
        }
        // A renewal doesn't re-enter review — the content is unchanged
        // and it was already approved once. Clearing the warning stamp
        // is what re-arms the day-25 email for the new window.
        const { error } = await admin
          .from("job_posts")
          .update({
            status: "live",
            expires_at: new Date(now.getTime() + JOB_LIVE_DAYS * 86_400_000).toISOString(),
            renewed_at: nowIso,
            renewal_count: job.renewal_count + 1,
            expiry_warning_sent_at: null,
            // An expired post has an approved_at already; keep it, since
            // the live CHECK constraint needs it present.
          })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, status: "live" });
      }

      case "submit": {
        if (job.status !== "draft" && job.status !== "rejected") {
          return apiError.validation("That post has already been submitted.", route);
        }
        const { data: full, error: readErr } = await admin
          .from("job_posts")
          .select("practice_name, location, role, role_other, employment_type, pay_min, pay_max, pay_unit, post_format")
          .eq("id", id)
          .single();
        if (readErr) throw readErr;

        const { error } = await admin
          .from("job_posts")
          .update({
            status: "pending_review",
            submitted_at: nowIso,
            rejection_reason: null,
          })
          .eq("id", id);
        if (error) throw error;

        await notifyTeamNewJob({
          jobId: id,
          practiceName: full.practice_name,
          roleLabel: roleLabel(full.role, full.role_other),
          location: full.location,
          memberEmail: guard.email,
          memberName: guard.firstName || null,
          employmentLabel: employmentLabel(full.employment_type),
          payLine: formatPay(full.pay_min, full.pay_max, full.pay_unit),
          postFormat: full.post_format ?? "detailed",
        });
        return NextResponse.json({ ok: true, status: "pending_review" });
      }

      case "edit": {
        if (job.status === "expired") {
          return apiError.validation("Renew this post before editing it.", route);
        }
        const parsed = validateJobInput(body);
        if (!parsed.ok) return apiError.validation(parsed.error, route);

        // An edit to anything already public goes back through review.
        // The slug deliberately stays put: we promoted that URL to the
        // group and Google has it indexed.
        const wasPublic = job.status === "live" || job.status === "filled";
        const patch: Partial<JobPostsRow> = { ...parsed.value };
        if (wasPublic) {
          patch.status = "pending_review";
          patch.submitted_at = nowIso;
          patch.approved_at = null;
          patch.expires_at = null;
          patch.filled_at = null;
        }

        const { error } = await admin.from("job_posts").update(patch).eq("id", id);
        if (error) throw error;

        if (wasPublic) {
          await notifyTeamNewJob({
            jobId: id,
            practiceName: parsed.value.practice_name,
            roleLabel: roleLabel(parsed.value.role, parsed.value.role_other),
            location: parsed.value.location,
            memberEmail: guard.email,
            memberName: guard.firstName || null,
            employmentLabel: employmentLabel(parsed.value.employment_type),
            payLine: formatPay(parsed.value.pay_min ?? null, parsed.value.pay_max ?? null, parsed.value.pay_unit),
            postFormat: parsed.value.post_format ?? "detailed",
            resubmitted: true,
          });
        }
        return NextResponse.json({
          ok: true,
          status: wasPublic ? "pending_review" : job.status,
        });
      }

      default:
        return apiError.badRequest("Unknown action.", route);
    }
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * DELETE /api/member/jobs/[id]
 *
 * Only a draft can be deleted outright. Anything that has been through
 * review is kept for the record — "filled" and "expired" are the exits
 * for a post that's already been public.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const route = "DELETE /api/member/jobs/[id]";
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const admin = getSupabaseAdmin();
    const { data: job } = await admin
      .from("job_posts")
      .select("id, member_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!job || job.member_id !== guard.memberId) return apiError.notFound(route);
    if (job.status !== "draft") {
      return apiError.validation(
        "Only a draft can be deleted. Mark a live post as filled instead.",
        route,
      );
    }

    const { error } = await admin.from("job_posts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}
