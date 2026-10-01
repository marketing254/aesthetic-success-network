import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";
import { FOUNDING_EXPERT_CAP } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expert billing exemption — admin control (MANUAL OVERRIDE ONLY).
 *
 * Up to FOUNDING_EXPERT_CAP (20) experts can be marked billing-exempt:
 * `experts.billing_exempt = true` means they are never charged, never
 * asked for a card, and never see the billing UI. Founding invites do NOT
 * set this: every expert (founding invite or website signup) gets the first
 * 12 months (founding) or 6 months (website) free from the member launch, then $39/month flat.
 *
 * Expert-side ONLY. A founding expert who also lists a company keeps
 * paying through their `vendors` row — this endpoint never touches it.
 *
 * Two invariants are enforced by database triggers, NOT here, because the
 * flag can also be set by the repair script or a future onboarding step:
 *   - 0042: an exemption can never be un-set (lifetime grant)
 *   - 0043: at most 20 exemptions can exist
 * We surface those trigger errors as clean 409s instead of a 500.
 */

type Body = { expertId?: string; email?: string; action?: string };

/** GET — how many billing-exemption overrides are used / left. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("experts")
      .select("id, email, display_name, full_name, billing_exempt, billing_exempt_reason, billing_exempt_granted_at")
      .eq("billing_exempt", true);
    if (error) return serverError(error, { route: "admin/experts/billing" });

    const used = data?.length ?? 0;
    return NextResponse.json({
      cap: FOUNDING_EXPERT_CAP,
      used,
      remaining: Math.max(0, FOUNDING_EXPERT_CAP - used),
      experts: data ?? [],
    });
  } catch (err) {
    return serverError(err, { route: "admin/experts/billing" });
  }
}

/**
 * PATCH — grant the billing exemption (manual override) to one expert.
 *
 * Body: { expertId | email, action: "grant_free" }
 *
 * There is deliberately no "revoke" action: the grant is a promise we
 * made to the founding cohort, and 0042's trigger blocks un-setting it
 * at the database level anyway.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "grant_free") {
    return NextResponse.json(
      { error: 'Unsupported action. Only "grant_free" is allowed. An exemption is a lifetime grant and cannot be revoked.' },
      { status: 400 },
    );
  }
  if (!body.expertId && !body.email) {
    return NextResponse.json({ error: "expertId or email is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const lookup = supabase
      .from("experts")
      .select("id, email, display_name, full_name, billing_exempt");
    const { data: expert, error: findErr } = body.expertId
      ? await lookup.eq("id", body.expertId).maybeSingle()
      : await lookup.ilike("email", body.email!).maybeSingle();

    if (findErr) return serverError(findErr, { route: "admin/experts/billing" });
    if (!expert) {
      return NextResponse.json(
        { error: "No expert found. They must be onboarded (have an experts row) before they can be made free." },
        { status: 404 },
      );
    }

    const name = expert.display_name || expert.full_name || expert.email;

    if (expert.billing_exempt) {
      return NextResponse.json({ ok: true, alreadyExempt: true, message: `${name} is already billing-exempt.` });
    }

    // Pre-flight so the common case gets a friendly message rather than a
    // raw trigger exception. The trigger is still the real enforcement.
    const { count } = await supabase
      .from("experts")
      .select("id", { count: "exact", head: true })
      .eq("billing_exempt", true);
    if ((count ?? 0) >= FOUNDING_EXPERT_CAP) {
      return NextResponse.json(
        {
          error: `All ${FOUNDING_EXPERT_CAP} billing-exemption overrides are used. ${name} stays on their normal expert billing.`,
          cap: FOUNDING_EXPERT_CAP,
          used: count ?? 0,
          remaining: 0,
        },
        { status: 409 },
      );
    }

    const { error: upErr } = await supabase
      .from("experts")
      .update({
        billing_exempt: true,
        billing_exempt_reason: `Billing exemption (manual admin override). Granted by ${guard.email}.`,
        billing_exempt_granted_at: new Date().toISOString(),
      })
      .eq("id", expert.id);

    if (upErr) {
      // 0043's cap trigger / 0042's revoke guard surface as raised
      // exceptions — report them as a conflict, not a server fault.
      if (/cap reached|cannot be un-set/i.test(upErr.message)) {
        return NextResponse.json({ error: upErr.message }, { status: 409 });
      }
      return serverError(upErr, { route: "admin/experts/billing" });
    }

    await supabase.from("review_actions").insert({
      target_type: "expert",
      target_id: expert.id,
      action: "grant_billing_exempt",
      note: `Billing exemption, manual override (cap ${FOUNDING_EXPERT_CAP})`,
      admin_id: guard.adminId,
    });

    const used = (count ?? 0) + 1;
    return NextResponse.json({
      ok: true,
      message: `${name} is now billing-exempt. ${FOUNDING_EXPERT_CAP - used} of ${FOUNDING_EXPERT_CAP} overrides left.`,
      cap: FOUNDING_EXPERT_CAP,
      used,
      remaining: Math.max(0, FOUNDING_EXPERT_CAP - used),
    });
  } catch (err) {
    return serverError(err, { route: "admin/experts/billing" });
  }
}
