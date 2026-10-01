import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { validateSeekerInput } from "@/lib/jobs/validateSeeker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/seeker/signup
 *
 * Free account for a job seeker. This is the change the 1 Sep huddle
 * asked for: an applicant used to mailto the practice and vanish, and
 * now they register first so we hold a contactable record.
 *
 * FREE. There is no plan picker, no Stripe, no checkout cookie, and no
 * path from here to a payment page. If that ever changes it should be a
 * product decision made out loud, not a quiet edit to this file.
 *
 * How it differs from /api/member/signup, which it otherwise resembles:
 *
 *   - account_type = 'job_seeker'. This is the load-bearing field. It is
 *     what keeps the row out of every member surface (see requireMember
 *     in src/lib/auth/guards.ts and §1 of migration 0060).
 *   - tier stays null. Tier means a paid tier.
 *   - There is no checkout step in between. Member signup is pay-first
 *     and routes to the plan picker; this one goes straight to sign-in,
 *     because there is nothing to pay for.
 *
 * An email that already belongs to a PAYING member is refused rather
 * than converted — downgrading a subscriber's row because they clicked
 * the wrong form would be a genuinely bad outcome, and they can already
 * apply with the account they have.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const route = "POST /api/seeker/signup";

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError.badRequest();
  }

  const parsed = validateSeekerInput(json as Record<string, unknown>);
  if (!parsed.ok) return apiError.validation(parsed.error, route);
  const input = parsed.value;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`seeker-signup:${ip}:${input.email}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  const sb = getSupabaseAdmin();

  try {
    const { data: existing } = await sb
      .from("members")
      .select("id, status, account_type")
      .eq("email", input.email)
      .maybeSingle();

    let memberId: string;

    if (existing) {
      // Already a paying member. Don't touch the row — send them to the
      // member login instead. They can apply for jobs with that account;
      // requireApplicant accepts both account types.
      if (existing.account_type !== "job_seeker") {
        return NextResponse.json(
          {
            ok: false,
            error: "That email is already a member account. Sign in and you can apply straight away.",
            reason: "existing_member",
            next: "/member/login",
          },
          { status: 409 },
        );
      }

      // Idempotent re-signup: refresh whatever they retyped and
      // reactivate if an admin had switched them off.
      memberId = existing.id;
      await sb
        .from("members")
        .update({
          first_name: input.first_name,
          last_name: input.last_name,
          phone: input.phone,
          city: input.city,
          job_role_interest: input.job_role_interest,
          status: "active",
        })
        .eq("id", memberId);
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone,
          city: input.city,
          job_role_interest: input.job_role_interest,
          account_type: "job_seeker",
          // 'active' is required for the OTP login to work at all. It does
          // NOT mean "active member" — account_type is what carries that
          // distinction, and every member gate now checks it.
          status: "active",
          tier: null,
        })
        .select("id")
        .single();
      if (insErr) {
        return serverError(insErr, { route, extra: { stage: "seeker_insert" } });
      }
      memberId = inserted.id;
    }

    // Pre-create the auth user. /api/seeker/login uses
    // shouldCreateUser:false, same as every other login in the app, so
    // the user must exist before a code can be requested.
    try {
      const { error: createErr } = await sb.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: { user_type: "job_seeker", member_id: memberId },
      });
      if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[seeker:signup] auth user create failed:", createErr);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[seeker:signup] auth user create threw:", err);
      }
      // Continue — a missing auth user surfaces as "unknown email" on the
      // login step, which is recoverable, and failing signup here would
      // strand an account row that was created fine.
    }

    // NO OTP is sent from here. The client redirects to /seeker/login,
    // which sends the code as its first act.
    //
    // Sending one here as well would put two live codes in flight: the
    // second issue invalidates the first, so whichever email the person
    // opens first is the one that fails. That is a genuinely confusing
    // bug to be on the receiving end of, and the fix is simply to have
    // one place responsible for issuing codes.
    try {
      await sb.from("auth_audit").insert({
        event: existing ? "signup_resend" : "signup_new",
        email: input.email,
        user_type: "job_seeker",
        metadata: { member_id: memberId, existed: !!existing },
      });
    } catch {
      /* audit best-effort */
    }

    // No team notification here. Members get one because a new member is
    // an event; job seekers arrive in volume and would turn the team
    // inbox into a firehose. They show up on the admin Job seekers page.

    return NextResponse.json({
      ok: true,
      member_id: memberId,
      existed: !!existing,
      // The client appends its own ?next= so the applicant lands back on
      // the job they were applying for.
      next: `/seeker/login?email=${encodeURIComponent(input.email)}`,
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
