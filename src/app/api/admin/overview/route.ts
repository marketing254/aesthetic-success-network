import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { errMessage } from "@/lib/errMessage";
import { countRows } from "@/lib/supabase/counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — dashboard/sidebar KPIs in one round trip.
 *
 * Every figure here is a `head: true` COUNT: Postgres returns the number
 * in the Content-Range header and zero rows travel over the wire. The
 * previous version selected whole tables and called `.length` on them,
 * so the sidebar's 90-second refresh downloaded every signup, every
 * application, every hotline request and every deal, forever.
 *
 * `me` rides along too, so the admin shell doesn't need its own pair of
 * browser round trips just to render the user chip.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const PENDING = ["new", "in_review"];

    // Portal tables arrive in 0008 — countRows tolerates their absence so
    // the whole dashboard doesn't 500 on an install that hasn't run it yet.
    const [
      waitlistTotal,
      waitlistLast24h,
      expertsTotal,
      expertsPending,
      partnersTotal,
      partnersPending,
      hotlineTotal,
      hotlineNeedsRouting,
      hotlineWithExperts,
      dealsTotal,
      dealsPending,
      dealsPublished,
    ] = await Promise.all([
      countRows(supabase, "waitlist_signups"),
      countRows(supabase, "waitlist_signups", { gte: { created_at: dayAgo } }),
      countRows(supabase, "expert_applications"),
      countRows(supabase, "expert_applications", { in: { status: PENDING } }),
      countRows(supabase, "partner_applications"),
      countRows(supabase, "partner_applications", { in: { status: PENDING } }),
      countRows(supabase, "hotline_requests"),
      countRows(supabase, "hotline_requests", { eq: { status: "submitted" } }),
      countRows(supabase, "hotline_requests", { eq: { status: "assigned" } }),
      countRows(supabase, "vendor_deals"),
      countRows(supabase, "vendor_deals", { eq: { status: "pending_review" } }),
      countRows(supabase, "vendor_deals", { eq: { status: "published" } }),
    ]);

    return NextResponse.json({
      me: { email: guard.email, full_name: guard.fullName, role: guard.role },
      waitlist: { total: waitlistTotal, last24h: waitlistLast24h },
      experts: { total: expertsTotal, pending: expertsPending },
      partners: { total: partnersTotal, pending: partnersPending },
      hotline: {
        total: hotlineTotal,
        needsRouting: hotlineNeedsRouting,
        withExperts: hotlineWithExperts,
      },
      deals: { total: dealsTotal, pending: dealsPending, published: dealsPublished },
    });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
