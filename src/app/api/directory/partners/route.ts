import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/directory/partners — PUBLIC. Powers the "Meet the partners"
 * directory section on /partners and the /partners/[id] detail pages.
 *
 * Publish-ready gate: status = 'approved' AND description is filled in.
 * Never returns contact email, phone, or billing fields.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("partner_applications")
      .select("id, company_name, display_name, category, description, member_deal, logo_url, website, booking_link")
      .eq("status", "approved")
      .not("description", "is", null)
      .order("company_name", { ascending: true });
    if (error) throw error;

    const partners = (data ?? []).map((p) => ({
      id: p.id as string,
      name: (p.display_name as string) || (p.company_name as string) || "Network partner",
      category: (p.category as string) ?? null,
      description: (p.description as string) ?? null,
      memberDeal: (p.member_deal as string) ?? null,
      logoUrl: (p.logo_url as string) ?? null,
      website: (p.website as string) ?? null,
      bookingLink: (p.booking_link as string) ?? null,
    }));

    return NextResponse.json({ partners, total: partners.length });
  } catch (err) {
    console.error("[directory:partners] failed:", err);
    return NextResponse.json({ error: "Could not load partners right now." }, { status: 500 });
  }
}
