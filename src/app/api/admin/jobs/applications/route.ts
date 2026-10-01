import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import type { JobApplicationsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jobs/applications
 *
 * Every application on the board, newest first, with the job it was
 * for and a short-lived signed link to the CV. This is the admin's
 * record of what happened after a post went live: who applied, whether
 * the email to the practice went out, and what status the practice set.
 *
 * `?job=` narrows it to one post. Read-only — the practice owns the
 * status, the admin only watches.
 */
const CV_URL_TTL_SECONDS = 600;
const MAX_ROWS = 1000;

type Row = Pick<
  JobApplicationsRow,
  | "id"
  | "job_post_id"
  | "applicant_member_id"
  | "full_name"
  | "email"
  | "phone"
  | "message"
  | "cv_path"
  | "cv_filename"
  | "status"
  | "status_changed_at"
  | "delivered_at"
  | "delivery_error"
  | "copy_to_applicant"
  | "created_at"
>;

export async function GET(req: Request) {
  const route = "GET /api/admin/jobs/applications";
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const jobFilter = url.searchParams.get("job");

  try {
    const admin = getSupabaseAdmin();

    let query = admin
      .from("job_applications")
      .select(
        "id, job_post_id, applicant_member_id, full_name, email, phone, message, cv_path, cv_filename, status, " +
          "status_changed_at, delivered_at, delivery_error, copy_to_applicant, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (jobFilter && /^[0-9a-f-]{36}$/i.test(jobFilter)) query = query.eq("job_post_id", jobFilter);

    const { data, error } = await query.returns<Row[]>();
    if (error) throw error;
    const rows = data ?? [];

    // Job + poster context in one pass each, not per row.
    const jobIds = Array.from(new Set(rows.map((r) => r.job_post_id)));
    const jobs = new Map<
      string,
      { id: string; slug: string; practice_name: string; role: string; role_other: string | null; location: string; status: string; apply_email: string | null; member_id: string }
    >();
    if (jobIds.length > 0) {
      const { data: jobRows } = await admin
        .from("job_posts")
        .select("id, slug, practice_name, role, role_other, location, status, apply_email, member_id")
        .in("id", jobIds);
      for (const j of jobRows ?? []) jobs.set(j.id, j);
    }
    const posterIds = Array.from(new Set(Array.from(jobs.values()).map((j) => j.member_id)));
    const posters = new Map<string, { name: string; email: string }>();
    if (posterIds.length > 0) {
      const { data: members } = await admin.from("members").select("id, first_name, last_name, email").in("id", posterIds);
      for (const m of members ?? []) posters.set(m.id, { name: [m.first_name, m.last_name].filter(Boolean).join(" "), email: m.email });
    }

    const applications = await Promise.all(
      rows.map(async (r) => {
        let cvUrl: string | null = null;
        if (r.cv_path) {
          const { data: signed } = await admin.storage.from("job-applications").createSignedUrl(r.cv_path, CV_URL_TTL_SECONDS);
          cvUrl = signed?.signedUrl ?? null;
        }
        const job = jobs.get(r.job_post_id) ?? null;
        return {
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          message: r.message,
          cv_filename: r.cv_filename,
          cv_url: cvUrl,
          status: r.status,
          status_changed_at: r.status_changed_at,
          delivered_at: r.delivered_at,
          delivery_error: r.delivery_error,
          copy_to_applicant: r.copy_to_applicant,
          created_at: r.created_at,
          job: job
            ? {
                id: job.id,
                slug: job.slug,
                practice_name: job.practice_name,
                role: job.role,
                role_other: job.role_other,
                location: job.location,
                status: job.status,
                apply_email: job.apply_email,
                poster: posters.get(job.member_id) ?? null,
              }
            : null,
        };
      }),
    );

    const stats = {
      total: applications.length,
      undelivered: applications.filter((a) => !a.delivered_at).length,
      shortlisted: applications.filter((a) => a.status === "shortlisted").length,
      hired: applications.filter((a) => a.status === "hired").length,
    };

    return NextResponse.json({ ok: true, applications, stats, truncated: rows.length === MAX_ROWS });
  } catch (err) {
    return serverError(err, { route });
  }
}
