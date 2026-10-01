import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/seeker/applications
 *
 * Everything this applicant has applied for, newest first. This is the
 * "check your progress" surface — the thing we promised in exchange for
 * making them register, so it has to actually be worth opening.
 *
 * What it deliberately does NOT return: cv_path. The applicant already
 * has their own CV and shipping the storage path to the browser adds an
 * object reference for no gain.
 */
export async function GET() {
  const route = "GET /api/seeker/applications";

  const guard = await requireApplicant();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("job_applications")
      .select(
        "id, status, status_changed_at, created_at, delivered_at, cv_filename, " +
          "job_posts(slug, practice_name, role, role_other, location, status)",
      )
      .eq("applicant_member_id", guard.memberId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      applications: data ?? [],
      seeker: { first_name: guard.firstName, email: guard.email },
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
