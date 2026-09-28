import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";
import { sortPartnersHouseFirst } from "@/lib/houseOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/directory/partners?page=1&pageSize=6
 *
 * PUBLIC — powers the founding-partners directory on the marketing site.
 * Only live partners (approved + verified) are listed; a covered company
 * (multi-company partner) shows only while its paying partner is live.
 * Public-safe fields only — never contact email/phone or billing.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(24, Math.max(1, Number(url.searchParams.get("pageSize")) || 6));

    const sb = getSupabaseAdmin();
    // Fetch all live partners once (small set), filter covered companies whose
    // parent isn't live, then paginate in memory so the covered-parent rule
    // can't be broken by range math.
    // PUBLISH-READY gate: approved+verified AND has a logo AND a description.
    // Internal test vendors (no profile assets) never reach the public site.
    const { data, error } = await sb
      .from("vendors")
      .select("id, company_name, display_name, category, description, logo_url, avatar_url, website, billing_parent_id")
      .eq("status", "approved")
      .eq("verified", true)
      .not("logo_url", "is", null)
      .not("description", "is", null)
      .order("display_name", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const liveIds = new Set((data ?? []).map((v) => v.id));
    const visible = sortPartnersHouseFirst(
      (data ?? []).filter((v) => !v.billing_parent_id || liveIds.has(v.billing_parent_id)),
      (v) => v.display_name || v.company_name,
    );

    const from = (page - 1) * pageSize;
    const pageRows = visible.slice(from, from + pageSize);

    return NextResponse.json({
      partners: pageRows.map((v) => ({
        id: v.id,
        name: v.display_name || v.company_name || "(unnamed partner)",
        category: v.category,
        description: v.description,
        logo_url: v.logo_url ?? v.avatar_url ?? null,
        website: v.website,
      })),
      total: visible.length,
      page,
      pageSize,
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/directory/partners" });
  }
}
