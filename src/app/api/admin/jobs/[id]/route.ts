import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { validateJobInput } from "@/lib/jobs/validate";
import { JOB_LIVE_DAYS, roleLabel } from "@/lib/jobs/constants";
import { sendJobApproved, sendJobRejected } from "@/lib/email/jobEmails";
import type { JobPostsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/jobs/[id]
 *
 * The publish gate and the promotion queue.
 *
 *   approve      — put it live, start the 30-day clock, email the poster
 *   reject       — requires a reason, always emails the poster. Never
 *                  reject silently: someone paid for this feature.
 *   edit         — fix a typo, add missing pay, tidy formatting BEFORE
 *                  approving. Runs the same validator as the member form
 *                  so an admin can't approve a shape the form rejects.
 *   promote      — tick a channel as done (facebook | email). Phase 1
 *                  posts by hand; this records that it happened. There
 *                  is deliberately no Facebook API call here.
 *   expire       — force it off the board immediately.
 *
 * Every branch is admin-gated. The member's own controls live on
 * /api/member/jobs/[id] and can't reach any of this.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const route = "PATCH /api/admin/jobs/[id]";
  const guard = await requireAdmin();
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
      .select(
        "id, member_id, slug, status, role, role_other, practice_name, location, approved_at, expires_at, apply_email, apply_url",
      )
      .eq("id", id)
      .maybeSingle();
    if (!job) return apiError.notFound(route);

    const now = new Date();
    const nowIso = now.toISOString();

    switch (action) {
      case "approve": {
        if (job.status !== "pending_review" && job.status !== "rejected") {
          return apiError.validation("Only a post awaiting review can be approved.", route);
        }
        const expiresAt = new Date(now.getTime() + JOB_LIVE_DAYS * 86_400_000).toISOString();
        const { error } = await admin
          .from("job_posts")
          .update({
            status: "live",
            approved_at: nowIso,
            reviewed_at: nowIso,
            reviewed_by: guard.adminId,
            rejection_reason: null,
            expires_at: expiresAt,
            expiry_warning_sent_at: null,
          })
          .eq("id", id);
        if (error) throw error;

        // The email is a courtesy on top of an approval that already
        // committed. A dead mailbox must not un-publish the post.
        const poster = await loadPoster(admin, job.member_id);
        if (poster) {
          await sendJobApproved({
            to: poster.email,
            firstName: poster.firstName,
            lastName: poster.lastName,
            roleLabel: roleLabel(job.role, job.role_other),
            practiceName: job.practice_name,
            slug: job.slug,
            location: job.location,
            expiresAt,
            applyEmail: job.apply_email,
            applyUrl: job.apply_url,
          });
        }

        return NextResponse.json({ ok: true, status: "live" });
      }

      case "reject": {
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        // Enforced here as well as by a CHECK constraint. A rejection
        // with no reason is the single most annoying thing a moderated
        // board can do to someone who's paying for it.
        if (reason.length < 5 || reason.length > 1000) {
          return apiError.validation(
            "Give the poster a reason. A sentence is enough. They get it by email.",
            route,
          );
        }
        if (job.status === "rejected") {
          return apiError.validation("That post is already rejected.", route);
        }

        const { error } = await admin
          .from("job_posts")
          .update({
            status: "rejected",
            rejection_reason: reason,
            reviewed_at: nowIso,
            reviewed_by: guard.adminId,
            approved_at: null,
            expires_at: null,
          })
          .eq("id", id);
        if (error) throw error;

        const poster = await loadPoster(admin, job.member_id);
        if (poster) {
          await sendJobRejected({
            to: poster.email,
            firstName: poster.firstName,
            lastName: poster.lastName,
            roleLabel: roleLabel(job.role, job.role_other),
            practiceName: job.practice_name,
            reason,
          });
        }

        return NextResponse.json({ ok: true, status: "rejected" });
      }

      case "edit": {
        const parsed = validateJobInput(body);
        if (!parsed.ok) return apiError.validation(parsed.error, route);
        // The slug is never regenerated, even if the role or location
        // changed — a live post's URL is already in the group and in
        // Google, and moving it breaks both.
        const { error } = await admin.from("job_posts").update(parsed.value).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "promote": {
        const channel = typeof body.channel === "string" ? body.channel : "";
        if (channel !== "facebook" && channel !== "email") {
          return apiError.badRequest("Unknown promotion channel.", route);
        }
        if (job.status !== "live") {
          return apiError.validation("Only a live post can be marked as promoted.", route);
        }
        // Toggle, so a mis-click is recoverable.
        const column = channel === "facebook" ? "promoted_facebook_at" : "promoted_email_at";
        const { data: current } = await admin
          .from("job_posts")
          .select(column)
          .eq("id", id)
          .single();
        const already = (current as Record<string, string | null> | null)?.[column] ?? null;

        const patch: Partial<JobPostsRow> = { [column]: already ? null : nowIso };
        const { error } = await admin.from("job_posts").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, promoted: !already });
      }

      case "expire": {
        // "Force expire or unpublish anything, immediately" — so this
        // reaches a pending post too, not just a public one. Pulling
        // something out of the queue this way is SILENT, which is why
        // Reject (reason + email) stays the default and the UI labels
        // this one for what it's for: spam that deserves no reply.
        if (job.status !== "live" && job.status !== "filled" && job.status !== "pending_review") {
          return apiError.validation("That post isn't on the board or in the queue.", route);
        }
        const { error } = await admin
          .from("job_posts")
          .update({
            status: "expired",
            reviewed_at: nowIso,
            reviewed_by: guard.adminId,
          })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, status: "expired" });
      }

      default:
        return apiError.badRequest("Unknown action.", route);
    }
  } catch (err) {
    return serverError(err, { route });
  }
}

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

async function loadPoster(
  admin: AdminClient,
  memberId: string,
): Promise<{ email: string; firstName: string; lastName: string | null } | null> {
  const { data } = await admin
    .from("members")
    .select("email, first_name, last_name")
    .eq("id", memberId)
    .maybeSingle();
  if (!data?.email) return null;
  return { email: data.email, firstName: data.first_name || "there", lastName: data.last_name ?? null };
}
