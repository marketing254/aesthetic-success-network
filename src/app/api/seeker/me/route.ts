import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/seeker/me?slug=<job-slug>
 *
 * Who is signed in, and have they already applied for this job.
 *
 * WHY THIS EXISTS AS AN ENDPOINT rather than being read on the server
 * inside /jobs/[slug]: that page renders the JobPosting structured data
 * for anonymous crawlers and has no auth in it at all. The apply panel
 * is a client component regardless (file upload, submit states), so
 * letting it resolve its own viewer here means the public page keeps
 * loading exactly as it did before applications existed.
 *
 * Never 401s. "Not signed in" is a normal answer here, not an error —
 * most people hitting a public job page are exactly that.
 */
export async function GET(req: Request) {
  const route = "GET /api/seeker/me";

  const guard = await requireApplicant();
  if (!guard.ok) {
    return NextResponse.json({ ok: true, signed_in: false });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  try {
    let alreadyApplied = false;

    if (slug && /^[a-z0-9-]{3,160}$/.test(slug)) {
      const admin = getSupabaseAdmin();
      const { data: job } = await admin
        .from("job_posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (job) {
        const { data: existing } = await admin
          .from("job_applications")
          .select("id")
          .eq("job_post_id", job.id)
          .eq("applicant_member_id", guard.memberId)
          .maybeSingle();
        alreadyApplied = !!existing;
      }
    }

    const fullName = [guard.firstName, guard.lastName].filter(Boolean).join(" ");

    return NextResponse.json({
      ok: true,
      signed_in: true,
      // Pre-fills the form. The applicant can still change any of it —
      // a different reply-to or phone for one specific application is a
      // legitimate thing to want.
      full_name: fullName,
      email: guard.email,
      phone: guard.phone,
      account_type: guard.accountType,
      already_applied: alreadyApplied,
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
