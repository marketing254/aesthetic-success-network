import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/companies
 *
 * The signed-in partner's company family: the row they're logged into,
 * its paying principal (if they're a covered company), and every covered
 * company under that principal. Powers the "Your companies" switcher in
 * the partner portal.
 *
 * Switching companies = signing in with that company's contact email
 * (one OTP → that inbox). This is deliberate: access to a company's
 * listing is proven by control of its email. A principal who manages
 * everything uses plus-aliases that land in their own inbox; a company
 * with its own manager keeps its own address — both models work with no
 * shared-session leakage.
 */
export async function GET() {
  const guard = await requirePaidVendor();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    // Resolve the family root: me, or my paying principal.
    const { data: me } = await admin
      .from("vendors")
      .select("id, billing_parent_id")
      .eq("id", guard.vendorId)
      .maybeSingle();
    if (!me) return NextResponse.json({ companies: [] });
    const rootId = me.billing_parent_id ?? me.id;

    const { data: family, error } = await admin
      .from("vendors")
      .select("id, company_name, display_name, category, logo_url, avatar_url, status, verified, contact_email, billing_parent_id")
      .or(`id.eq.${rootId},billing_parent_id.eq.${rootId}`)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      companies: (family ?? []).map((v) => ({
        id: v.id,
        name: v.display_name || v.company_name,
        category: v.category,
        logo_url: v.logo_url ?? v.avatar_url ?? null,
        status: v.status,
        verified: !!v.verified,
        contact_email: v.contact_email,
        is_current: v.id === guard.vendorId,
        is_principal: !v.billing_parent_id,
      })),
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/vendor/companies" });
  }
}
