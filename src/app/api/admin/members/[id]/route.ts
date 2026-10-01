import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getStripe } from "@/lib/stripe";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET    /api/admin/members/[id] — full member row
 * PATCH  /api/admin/members/[id] — { action: "deactivate" | "reactivate" }
 *        Deactivate cancels the Stripe sub at period end and sets status='paused'.
 *        Reactivate flips status back to 'active' (does not resubscribe — the
 *        member needs to checkout again if their Stripe sub already ended).
 * DELETE /api/admin/members/[id] — hard delete. Cancels Stripe sub immediately,
 *        removes the members row, and deletes the matching auth.users entry.
 *
 * All three require an authenticated admin (see requireAdmin guard).
 */

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("members").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ member: data });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/members/[id]" });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "deactivate" && body.action !== "reactivate") {
    return NextResponse.json(
      { error: "action must be 'deactivate' or 'reactivate'" },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data: member, error: getErr } = await sb
    .from("members")
    .select("id, stripe_subscription_id, subscription_status")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return serverError(getErr, { route: "PATCH /api/admin/members/[id]" });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (body.action === "deactivate") {
    // Best-effort: cancel the Stripe subscription at period end so they keep
    // access until they're already paid through. We don't fail the whole
    // request if Stripe is unreachable — local state is the source of truth.
    if (member.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.update(member.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (err) {
        console.error("[admin:deactivate] stripe cancel failed:", err);
      }
    }
    const { error: upErr } = await sb
      .from("members")
      .update({ status: "paused", cancel_at_period_end: true })
      .eq("id", id);
    if (upErr) return serverError(upErr, { route: "PATCH /api/admin/members/[id]" });
    return NextResponse.json({ ok: true, action: "deactivated" });
  }

  // reactivate
  if (member.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(member.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
    } catch (err) {
      console.error("[admin:reactivate] stripe update failed:", err);
    }
  }
  const { error: upErr } = await sb
    .from("members")
    .update({ status: "active", cancel_at_period_end: false })
    .eq("id", id);
  if (upErr) return serverError(upErr, { route: "PATCH /api/admin/members/[id]" });
  return NextResponse.json({ ok: true, action: "reactivated" });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: member, error: getErr } = await sb
    .from("members")
    .select("id, auth_user_id, stripe_subscription_id, email")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return serverError(getErr, { route: "DELETE /api/admin/members/[id]" });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Cancel Stripe sub IMMEDIATELY (not at period end) — they're being deleted.
  if (member.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(member.stripe_subscription_id);
    } catch (err) {
      console.error("[admin:delete] stripe cancel failed:", err);
    }
  }

  // Delete the member row first (FK to auth.users may be SET NULL).
  const { error: delErr } = await sb.from("members").delete().eq("id", id);
  if (delErr) return serverError(delErr, { route: "DELETE /api/admin/members/[id]" });

  // Best-effort: also delete the auth.users entry so the email can re-signup.
  if (member.auth_user_id) {
    try {
      await sb.auth.admin.deleteUser(member.auth_user_id);
    } catch (err) {
      console.error("[admin:delete] auth.users delete failed:", err);
    }
  }

  return NextResponse.json({ ok: true, action: "deleted", email: member.email });
}
