import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateWaitlist } from "@/lib/waitlist/validate";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { notifySignup } from "@/lib/email/teamNotify";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { resolveReferralCode } from "@/lib/referral";
import { REFERRAL_COOKIE, SIGNUP_CHECKOUT_COOKIE, signCheckoutToken } from "@/lib/auth/guards";
import { appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/signup
 *
 * Self-serve member signup. Replaces the old "fill form → admin reviews →
 * admin activates" flow. Now:
 *
 *   1. Validate the form payload (reuses validateWaitlist for shape).
 *   2. Check if a members row already exists for that email — if so,
 *      just resend the magic link rather than erroring (idempotent
 *      double-submits, support re-onboarding).
 *   3. Insert the members row with status='active' so the auth gate
 *      passes the moment they verify their email.
 *   4. Pre-create the Supabase auth user (email_confirm:true) so
 *      shouldCreateUser:false on /api/member/login still works.
 *   5. Send a magic-link sign-in email via signInWithOtp.
 *      The link points at /auth/callback?next=/upgrade so the user
 *      lands on the plan picker after verifying their email.
 *   6. They pay via Stripe Checkout; the webhook then flips
 *      subscription_status='active' which unlocks /dashboard.
 *
 * Admins no longer need to activate new members. They CAN deactivate
 * existing ones via /api/admin/members/[id] PATCH action=deactivate
 * (sets status='paused' which middleware blocks immediately).
 *
 * Rate-limited per IP+email so a bot can't spray.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

function splitName(fullName: string): { first: string; last: string | null } {
  const t = fullName.trim();
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return { first: t || "Member", last: null };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export async function POST(req: Request) {
  const route = "POST /api/member/signup";

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError.badRequest();
  }

  const result = validateWaitlist(json);
  if (!result.ok) {
    return apiError.validation(result.error, route);
  }
  const payload = result.data;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`member-signup:${ip}:${payload.email}`);
  if (!rl.allowed) {
    return apiError.rateLimited(route);
  }

  const sb = getSupabaseAdmin();
  const email = payload.email;
  const { first, last } = splitName(payload.fullName);

  try {
    // 1. Is there an existing members row for this email? Idempotent path.
    const { data: existing } = await sb
      .from("members")
      .select("id, status, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    let memberId: string;
    let alreadyExisted = false;

    if (existing) {
      memberId = existing.id;
      alreadyExisted = true;

      // If the row was previously paused/churned, reactivate it as
      // part of self-serve resignup. Admin can always deactivate again.
      if (existing.status !== "active") {
        await sb
          .from("members")
          .update({ status: "active" })
          .eq("id", memberId);
      }
    } else {
      // 2. Fresh signup — create the members row.
      // utm + practice info captured so the team can see acquisition
      // context per row.
      const utm =
        payload.utm && typeof payload.utm === "object"
          ? (payload.utm as Record<string, string>)
          : null;

      // Capture the referral. Priority:
      //   1. payload.ref     — the form read ?ref straight off the URL
      //   2. utm.ref         — legacy path
      //   3. dmn_ref cookie  — set by middleware when they FIRST arrived via
      //      a referral link, so attribution survives them browsing around
      //      and registering from any page. This is the robust fallback that
      //      fixes the "lost the referral" leak.
      const cookieStore = await cookies();
      const cookieRef = cookieStore.get(REFERRAL_COOKIE)?.value;
      const refCandidate =
        (payload as { ref?: string }).ref ??
        (utm && typeof utm === "object" ? utm.ref : undefined) ??
        cookieRef;
      const referralCodeId = await resolveReferralCode(refCandidate ?? null);

      const { data: inserted, error: insErr } = await sb
        .from("members")
        .insert({
          first_name: first,
          last_name: last,
          email,
          phone: payload.phone ?? null,
          practice_name: payload.practiceName ?? null,
          city: payload.cityState ?? null,
          status: "active",
          tier: "founding",
          practice_role: utm?.role_label ?? null,
          sms_consent_at: payload.smsConsentAt ?? null,
          sms_consent_text: payload.smsConsentText ?? null,
          referral_code_id: referralCodeId,
        })
        .select("id")
        .single();
      // Form answers used for the personalized onboarding email + admin
      // view. Separate best-effort update so signup keeps working in an
      // environment where migration 0055 hasn't run yet.
      if (inserted?.id && (utm?.locations || utm?.biggest_challenge || utm?.heard_about)) {
        try {
          await sb
            .from("members")
            .update({
              locations: utm?.locations ?? null,
              biggest_challenge: utm?.biggest_challenge ?? null,
              heard_about: utm?.heard_about ?? null,
            })
            .eq("id", inserted.id);
        } catch {
          /* columns not present yet */
        }
      }
      if (insErr) {
        return serverError(insErr, { route, extra: { stage: "members_insert" } });
      }
      memberId = inserted.id;

      // Record the attribution row so the analytics dashboard can count
      // signups per code without re-joining through members each time.
      if (referralCodeId) {
        try {
          await sb.from("referral_signups").insert({
            code_id: referralCodeId,
            member_id: memberId,
          });
        } catch { /* best-effort */ }
      }
    }

    // 3. Pre-create the Supabase auth user. shouldCreateUser:false on
    //    /api/member/login means this user MUST exist before they can
    //    request a magic link to sign in.
    try {
      const { error: createErr } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { user_type: "member", member_id: memberId },
      });
      if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[member:signup] auth user create failed:", createErr);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[member:signup] auth user create threw:", err);
      }
      // Continue — magic-link send will give us the real error if any.
    }

    // 4. NO OTP is sent at signup anymore. Pay-first flow: the member goes
    //    straight to the plan picker + Stripe checkout (identified by the
    //    dmn_checkout cookie set below), and only logs in — with a fresh
    //    code — AFTER paying. Sending a code here would just expire during
    //    checkout and confuse them.

    // 5. Audit trail.
    await sb.from("auth_audit").insert({
      event: alreadyExisted ? "signup_resend" : "signup_new",
      email,
      user_type: "member",
      metadata: {
        member_id: memberId,
        existed: alreadyExisted,
        source: payload.source ?? null,
      },
    });

    // Alert the team on brand-new members only — a resend/re-login
    // (alreadyExisted) shouldn't re-notify everyone.
    if (!alreadyExisted) {
      const utm =
        payload.utm && typeof payload.utm === "object"
          ? (payload.utm as Record<string, string>)
          : null;
      void notifySignup({
        role: "member",
        name: payload.fullName,
        email,
        adminLink: appUrl("/admin/members?filter=new"),
        fields: [
          { label: "Full name", value: payload.fullName },
          { label: "Email", value: email },
          { label: "Phone", value: payload.phone },
          { label: "Practice name", value: payload.practiceName },
          { label: "Role", value: utm?.role_label },
          { label: "Number of locations", value: utm?.locations },
          { label: "City / state", value: payload.cityState },
          { label: "Biggest challenge", value: utm?.biggest_challenge },
          { label: "How they heard about us", value: utm?.heard_about },
          { label: "SMS consent", value: payload.smsConsent ? "Yes" : "No" },
          { label: "Source", value: payload.source ?? null },
        ],
      });
    }

    const response = NextResponse.json({
      ok: true,
      member_id: memberId,
      existed: alreadyExisted,
      // Client redirects to /upgrade (the plan picker) next — no code yet.
      next: "/upgrade",
      message: "You're signed up. Choose a plan to activate your membership.",
    });
    // Pay-first: a short-lived cookie lets this brand-new member reach the
    // plan picker + Stripe checkout before logging in. It only unlocks the
    // checkout surface; the portal stays OTP-gated. 2 hours is plenty to
    // finish a checkout, and the login step (after paying) supersedes it.
    response.cookies.set(SIGNUP_CHECKOUT_COOKIE, signCheckoutToken(memberId), {
      maxAge: 60 * 60 * 2,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    // Referral has been recorded (or wasn't present) — clear the cookie so a
    // later, unrelated signup from the same browser isn't mis-attributed.
    // Harmless when no cookie was set (single-use attribution).
    response.cookies.delete(REFERRAL_COOKIE);
    return response;
  } catch (err) {
    return serverError(err, { route });
  }
}
