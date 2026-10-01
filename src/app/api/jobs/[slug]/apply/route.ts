import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { roleLabel } from "@/lib/jobs/constants";
import {
  cvExtension,
  safeCvFilename,
  validateApplicationInput,
  validateCvFile,
} from "@/lib/jobs/validateApplication";
import {
  sendApplicationCopyToApplicant,
  sendApplicationToPractice,
} from "@/lib/email/jobEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/[slug]/apply
 *
 * Submit an application. Multipart, because it carries the CV.
 *
 * THE GATE: requireApplicant. There is no anonymous path through this
 * route, and that is the entire point of the phase-2 change — an
 * applicant who mailtos the practice is a visitor we never see again,
 * so applying now requires a free account. Applying is still free; the
 * guard checks that someone is signed in, never that they have paid.
 *
 * ORDER OF OPERATIONS, and why it is this way round:
 *
 *   1. Validate everything, including the file, before touching storage.
 *   2. Upload the CV.
 *   3. Insert the row.
 *   4. Send the emails, then stamp delivered_at.
 *
 * The row is written BEFORE the email goes out, so a dead SMTP box
 * costs us a delivery, not the application. delivered_at stays null and
 * job_applications_undelivered_idx exists precisely so those rows can be
 * found and retried. The opposite order — mail first, store after —
 * would lose applications silently on any insert failure, and the
 * applicant would have no way of knowing.
 */

// A CV is required. This is a job application; a practice that receives
// a name and a sentence has not received a candidate.
const CV_REQUIRED = "Attach your CV. Practices won't consider an application without one.";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const route = "POST /api/jobs/[slug]/apply";

  const guard = await requireApplicant();
  if (!guard.ok) return guard.response;

  const { slug } = await ctx.params;
  if (!slug || !/^[a-z0-9-]{3,160}$/.test(slug)) {
    return apiError.badRequest("Unknown job.", route);
  }

  // Each application uploads a CV and sends two emails, so cap submissions
  // per account (5 per 10 min, the shared public-route limit). Keyed on
  // the account, not the IP, because applying needs a session anyway.
  const rl = await checkRateLimit(`job-apply:${guard.memberId}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest("Couldn't read the form.", route);
  }

  const parsed = validateApplicationInput({
    full_name: form.get("full_name"),
    email: form.get("email"),
    phone: form.get("phone"),
    message: form.get("message"),
    copy_to_applicant: form.get("copy_to_applicant") === "true",
  });
  if (!parsed.ok) return apiError.validation(parsed.error, route);
  const input = parsed.value;

  const cvEntry = form.get("cv");
  if (!(cvEntry instanceof File)) {
    return apiError.validation(CV_REQUIRED, route);
  }
  const cvCheck = validateCvFile({
    name: cvEntry.name,
    size: cvEntry.size,
    type: cvEntry.type,
  });
  if (!cvCheck.ok) return apiError.validation(cvCheck.error, route);

  const admin = getSupabaseAdmin();

  try {
    // ---------------------------------------------------------------
    // The job. Only a LIVE post accepts applications: a filled or
    // expired post that still took applications would waste the
    // applicant's time, and a pending/rejected one isn't public at all.
    // ---------------------------------------------------------------
    const { data: job, error: jobErr } = await admin
      .from("job_posts")
      .select(
        "id, slug, status, practice_name, role, role_other, member_id, apply_email, apply_url",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (jobErr) throw jobErr;

    if (!job) return apiError.notFound(route);

    if (job.status !== "live") {
      return NextResponse.json(
        {
          error:
            job.status === "filled"
              ? "This role has been filled."
              : "This job is no longer accepting applications.",
          reason: "not_live",
        },
        { status: 409 },
      );
    }

    // Posts that only carry an external application link can't be
    // applied to through us — there is no inbox to deliver to. The page
    // renders the outbound link for these instead of the form, so
    // reaching here means the client is out of step.
    if (!job.apply_email) {
      return NextResponse.json(
        {
          error: "This practice takes applications on their own site.",
          reason: "external_only",
          apply_url: job.apply_url,
        },
        { status: 409 },
      );
    }

    // ---------------------------------------------------------------
    // Already applied? The unique index would catch this anyway, but a
    // clear message beats a constraint violation, and checking first
    // means we don't upload a CV we're about to throw away.
    // ---------------------------------------------------------------
    const { data: dupe } = await admin
      .from("job_applications")
      .select("id")
      .eq("job_post_id", job.id)
      .eq("applicant_member_id", guard.memberId)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json(
        {
          error: "You've already applied for this job.",
          reason: "already_applied",
        },
        { status: 409 },
      );
    }

    // ---------------------------------------------------------------
    // CV → private bucket. The id is generated here so the object path
    // and the row that points at it agree without a second round trip.
    // ---------------------------------------------------------------
    const applicationId = crypto.randomUUID();
    const storedName = `${job.id}/${applicationId}${cvExtension(cvEntry.name)}`;
    const cvBuffer = Buffer.from(await cvEntry.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from("job-applications")
      .upload(storedName, cvBuffer, {
        contentType: cvEntry.type,
        upsert: false,
      });
    if (uploadErr) {
      return serverError(uploadErr, { route, extra: { stage: "cv_upload" } });
    }

    const cvFilename = safeCvFilename(cvEntry.name);

    // ---------------------------------------------------------------
    // The row.
    // ---------------------------------------------------------------
    const { data: application, error: insErr } = await admin
      .from("job_applications")
      .insert({
        id: applicationId,
        job_post_id: job.id,
        applicant_member_id: guard.memberId,
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        message: input.message,
        cv_path: storedName,
        cv_filename: cvFilename,
        cv_size_bytes: cvEntry.size,
        copy_to_applicant: input.copy_to_applicant,
      })
      .select("id")
      .single();

    if (insErr) {
      // Don't leave the CV orphaned in the bucket if the row didn't land.
      try {
        await admin.storage.from("job-applications").remove([storedName]);
      } catch {
        /* the row is what matters; a stray object is a cleanup problem */
      }
      return serverError(insErr, { route, extra: { stage: "application_insert" } });
    }

    // ---------------------------------------------------------------
    // Delivery. Past this point the application EXISTS — every failure
    // below is recorded on the row and returned as a warning, never as
    // an error that would tell the applicant to submit again.
    // ---------------------------------------------------------------
    const role = roleLabel(job.role, job.role_other);
    let delivered = false;
    let deliveryError: string | null = null;

    // The practice email opens with the poster's first name (approved
    // draft). Best effort: a missing name falls back to "there".
    const { data: poster } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", job.member_id)
      .maybeSingle();

    try {
      delivered = await sendApplicationToPractice({
        to: job.apply_email,
        posterFirstName: poster?.first_name ?? null,
        posterLastName: poster?.last_name ?? null,
        jobId: job.id,
        jobSlug: job.slug,
        roleLabel: role,
        practiceName: job.practice_name,
        applicantName: input.full_name,
        applicantEmail: input.email,
        applicantPhone: input.phone,
        message: input.message,
        cv: {
          filename: cvFilename,
          content: cvBuffer,
          contentType: cvEntry.type,
        },
      });
      if (!delivered) deliveryError = "Mail transport reported failure.";
    } catch (err) {
      // Stored on the row for the admin queue only; never returned to the applicant.
      deliveryError = err instanceof Error ? err.message.slice(0, 500) : "Unknown send error";
    }

    await admin
      .from("job_applications")
      .update({
        delivered_at: delivered ? new Date().toISOString() : null,
        delivery_error: deliveryError,
      })
      .eq("id", application.id);

    if (input.copy_to_applicant) {
      // Best effort and deliberately unawaited into the failure path:
      // the applicant's own copy is a courtesy, and it must not turn a
      // successful application into an error on their screen.
      void sendApplicationCopyToApplicant({
        to: input.email,
        applicantName: input.full_name,
        applicantEmail: input.email,
        applicantPhone: input.phone,
        cvFilename,
        roleLabel: role,
        practiceName: job.practice_name,
        message: input.message,
      });
    }

    return NextResponse.json({
      ok: true,
      application_id: application.id,
      delivered,
      // Told plainly rather than hidden. If the practice's mail bounced,
      // the applicant should know their application is stored and that
      // we can chase it, instead of assuming it arrived.
      warning: delivered
        ? null
        : "Your application is saved, but we couldn't email the practice just yet. We'll retry; no need to apply again.",
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
