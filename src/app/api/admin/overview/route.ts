import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/overview — dashboard/sidebar KPIs in one round trip. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const [waitlist, experts, partners] = await Promise.all([
      supabase.from("waitlist_signups").select("id, created_at"),
      supabase.from("expert_applications").select("id, status"),
      supabase.from("partner_applications").select("id, status"),
    ]);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const w = waitlist.data ?? [];
    const x = experts.data ?? [];
    const p = partners.data ?? [];

    return NextResponse.json({
      waitlist: {
        total: w.length,
        last24h: w.filter((r) => r.created_at >= dayAgo).length,
      },
      experts: {
        total: x.length,
        pending: x.filter((r) => r.status === "new" || r.status === "in_review").length,
      },
      partners: {
        total: p.length,
        pending: p.filter((r) => r.status === "new" || r.status === "in_review").length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
