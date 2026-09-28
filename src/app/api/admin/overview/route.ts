import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview
 *
 * Aggregates dashboard KPIs in one round trip. Admin-gated.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();

    const [
      vendors,
      members,
      waitlist,
      offers,
      catalog,
      redemptions,
      recentApplications,
      pendingOffers,
      experts,
    ] = await Promise.all([
      supabase
        .from("vendors")
        .select("id, status, verified, created_at, plan_id"),
      // Free job-seeker accounts (0063) are never members and must not
      // inflate any membership number on this page.
      supabase
        .from("members")
        .select("id, email, status, tier, joined_at, created_at, activated_at, stripe_subscription_id")
        .neq("account_type", "job_seeker"),
      supabase
        .from("waitlist_signups")
        .select("id, role, created_at"),
      supabase
        .from("offers")
        .select("id, headline, discount_value, vendor_id, review_status, submitted_for_review_at, created_at"),
      supabase
        .from("catalog_items")
        .select("id, name, vendor_id, review_status, submitted_for_review_at, created_at"),
      supabase
        .from("redemptions")
        .select("id, amount_saved, redeemed_on, created_at"),
      supabase
        .from("vendor_applications")
        .select("id, company_name, contact_name, contact_email, status, created_at, vendor_id")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("offers")
        .select("id, headline, discount_value, vendor_id, review_status, submitted_for_review_at, created_at, catalog_items(name, type)")
        .eq("review_status", "pending_review")
        .order("submitted_for_review_at", { ascending: false, nullsFirst: false })
        .limit(6),
      supabase
        .from("expert_applications")
        .select("id, status, created_at"),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const v = vendors.data ?? [];
    const m = members.data ?? [];
    const w = waitlist.data ?? [];
    const o = offers.data ?? [];
    const c = catalog.data ?? [];
    const r = redemptions.data ?? [];
    const e = experts.data ?? [];

    const vendorCounts = {
      total: v.length,
      pending: v.filter((x) => x.status === "pending_review").length,
      approved: v.filter((x) => x.status === "approved").length,
      suspended: v.filter((x) => x.status === "suspended").length,
      rejected: v.filter((x) => x.status === "rejected").length,
      verified: v.filter((x) => x.verified).length,
    };

    // Started-but-unpaid signups (pay-first flows create the row at the
    // payment step) are NOT members — they get their own tab and badge.
    const isPending = (x: { activated_at: string | null; stripe_subscription_id: string | null }) =>
      !x.activated_at && !x.stripe_subscription_id;
    let capturedWithoutMember = 0;
    try {
      const known = new Set(m.map((x) => x.email.toLowerCase()));
      const { data: captured } = await (supabase as unknown as SupabaseClient)
        .from("pending_registrations")
        .select("email")
        .limit(500);
      const seen = new Set<string>();
      for (const c of (captured ?? []) as { email: string }[]) {
        const k = c.email.toLowerCase();
        if (known.has(k) || seen.has(k)) continue;
        seen.add(k);
        capturedWithoutMember += 1;
      }
    } catch {
      /* table absent */
    }
    const realMembers = m.filter((x) => !isPending(x));
    const memberCounts = {
      total: realMembers.length,
      active: realMembers.filter((x) => x.status === "active").length,
      thisWeek: realMembers.filter((x) => x.created_at >= weekAgo).length,
      // Same definition as the Pending members tab: unpaid members rows PLUS
      // people captured by the follow-up sequence before the payment step
      // (no members row yet). Purchased captures always have a members row,
      // so they are never double-counted.
      pending: m.filter(isPending).length + capturedWithoutMember,
    };

    const waitlistCounts = {
      total: w.length,
      members: w.filter((x) => x.role === "member").length,
      vendors: w.filter((x) => x.role === "vendor").length,
      last24h: w.filter((x) => x.created_at >= new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()).length,
    };

    const offerCounts = {
      pending: o.filter((x) => x.review_status === "pending_review").length,
      approved: o.filter((x) => x.review_status === "approved").length,
      total: o.length,
    };

    const catalogCounts = {
      pending: c.filter((x) => x.review_status === "pending_review").length,
      approved: c.filter((x) => x.review_status === "approved").length,
      total: c.length,
    };

    // `pending` here = new + reviewing (everything not yet resolved). That's
    // what the sidebar badge surfaces — the queue that still needs attention.
    const expertCounts = {
      total: e.length,
      pending: e.filter((x) => x.status === "new" || x.status === "reviewing").length,
      new: e.filter((x) => x.status === "new").length,
      reviewing: e.filter((x) => x.status === "reviewing").length,
      invited: e.filter((x) => x.status === "invited").length,
      declined: e.filter((x) => x.status === "declined").length,
      onboarded: e.filter((x) => x.status === "onboarded").length,
    };

    const redemptionStats = {
      lifetimeCount: r.length,
      thisMonthCount: r.filter((x) => (x.redeemed_on ?? "") >= monthStart).length,
      lifetimeSavings: Math.round(r.reduce((sum, x) => sum + (Number(x.amount_saved) || 0), 0)),
    };

    return NextResponse.json({
      vendors: vendorCounts,
      members: memberCounts,
      waitlist: waitlistCounts,
      offers: offerCounts,
      catalog: catalogCounts,
      experts: expertCounts,
      redemptions: redemptionStats,
      recentApplications: recentApplications.data ?? [],
      pendingOffers: pendingOffers.data ?? [],
      foundingCap: 1000,
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/overview" });
  }
}
