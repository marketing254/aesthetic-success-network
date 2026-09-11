import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/directory/experts — PUBLIC. Powers the "Meet the experts"
 * directory section on /experts and the /experts/[id] detail pages.
 *
 * Publish-ready gate: status = 'approved' AND bio is filled in. Never
 * returns email, phone, or billing fields.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_applications")
      .select("id, full_name, display_name, company, topics, bio, headshot_url, website, booking_link")
      .eq("status", "approved")
      .not("bio", "is", null)
      .order("full_name", { ascending: true });
    if (error) throw error;

    const experts = (data ?? []).map((e) => ({
      id: e.id as string,
      name: (e.display_name as string) || (e.full_name as string) || "Network expert",
      company: (e.company as string) ?? null,
      topics: (e.topics as string) ?? null,
      bio: (e.bio as string) ?? null,
      headshotUrl: (e.headshot_url as string) ?? null,
      website: (e.website as string) ?? null,
      bookingLink: (e.booking_link as string) ?? null,
    }));

    return NextResponse.json({ experts, total: experts.length });
  } catch (err) {
    console.error("[directory:experts] failed:", err);
    return NextResponse.json({ error: "Could not load experts right now." }, { status: 500 });
  }
}
