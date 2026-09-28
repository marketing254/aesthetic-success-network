import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { isApplicationStatus } from "@/lib/jobs/constants";
import type { JobApplicationsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Applications on one of the member's own job posts.
 *
 *   GET   — the applicant list, with a short-lived signed URL per CV
 *   PATCH — set the status on one application
 *
 * OWNERSHIP IS CHECKED ON EVERY CALL, against the post's member_id. RLS
 * would also stop a member reading someone else's applicants, but these
 * routes hold the service-role key and bypass RLS entirely — so the
 * ownership check here IS the access control, not a convenience on top
 * of it. Do not remove it on the grounds that "RLS covers this".
 */

// CVs live in a private bucket and are handed out as signed URLs that
// expire. Ten minutes is long enough to click and read, short enough
// that a URL pasted into a group chat stops working.
const CV_URL_TTL_SECONDS = 600;

async function ownedJob(memberId: string, jobId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("job_posts")
    .select("id, member_id, slug, practice_name, role, role_other")
    .eq("id", jobId)
    .maybeSingle();
  if (!data || data.member_id !== memberId) return null;
  return data;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const route = "GET /api/member/jobs/[id]/applications";

  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const job = await ownedJob(guard.memberId, id);
    // Deliberately a 404, not a 403: a member probing ids shouldn't be
    // able to tell "not yours" apart from "doesn't exist".
    if (!job) return apiError.notFound(route);

    const admin = getSupabaseAdmin();
    // Explicitly typed: supabase-js can't infer a row shape from a
    // concatenated select string, and the inferred union then breaks
    // every property access below.
    type Row = Pick<
      JobApplicationsRow,
      | "id"
      | "full_name"
      | "email"
      | "phone"
      | "message"
      | "cv_path"
      | "cv_filename"
      | "status"
      | "status_changed_at"
      | "delivered_at"
      | "created_at"
    >;

    const { data, error } = await admin
      .from("job_applications")
      .select(
        "id, full_name, email, phone, message, cv_path, cv_filename, status, " +
          "status_changed_at, delivered_at, created_at",
      )
      .eq("job_post_id", job.id)
      .order("created_at", { ascending: false })
      .returns<Row[]>();
    if (error) throw error;

    const applications = await Promise.all(
      (data ?? []).map(async (row) => {
        let cvUrl: string | null = null;
        if (row.cv_path) {
          const { data: signed } = await admin.storage
            .from("job-applications")
            .createSignedUrl(row.cv_path, CV_URL_TTL_SECONDS);
          cvUrl = signed?.signedUrl ?? null;
        }
        // Built field by field rather than by spreading the row, so
        // cv_path can't leak to the client by accident if a future
        // column is added to the select above.
        return {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          message: row.message,
          cv_filename: row.cv_filename,
          status: row.status,
          status_changed_at: row.status_changed_at,
          delivered_at: row.delivered_at,
          created_at: row.created_at,
          cv_url: cvUrl,
        };
      }),
    );

    return NextResponse.json({ ok: true, job, applications });
  } catch (err) {
    return serverError(err, { route });
  }
}

/**
 * PATCH — body: { application_id, status }
 *
 * This is what makes "check your application progress" mean anything:
 * whatever the practice sets here is what the applicant sees on
 * /seeker/applications.
 *
 * The status is the ONLY field a member may change. Everything the
 * applicant submitted is immutable — a practice editing a candidate's
 * own message or contact details would be indefensible, and the DB
 * guard trigger refuses those columns independently of this route.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const route = "PATCH /api/member/jobs/[id]/applications";

  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: { application_id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }

  if (!body.application_id) {
    return apiError.badRequest("Missing application.", route);
  }
  if (!isApplicationStatus(body.status)) {
    return apiError.validation("Unknown status.", route);
  }

  try {
    const job = await ownedJob(guard.memberId, id);
    if (!job) return apiError.notFound(route);

    const admin = getSupabaseAdmin();

    // Scope the update to this job as well as this application id, so a
    // valid application id from a DIFFERENT post can't be moved by
    // someone who happens to own this one.
    const { data, error } = await admin
      .from("job_applications")
      .update({
        status: body.status,
        status_changed_at: new Date().toISOString(),
        status_changed_by: guard.memberId,
      })
      .eq("id", body.application_id)
      .eq("job_post_id", job.id)
      .select("id, status, status_changed_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError.notFound(route);

    return NextResponse.json({ ok: true, application: data });
  } catch (err) {
    return serverError(err, { route });
  }
}
