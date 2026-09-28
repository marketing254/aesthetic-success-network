import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/spotlights
 *
 * Network-wide "what's new": the latest published spotlights across all
 * experts and partners, newest first. Powers the animated Spotlight
 * carousel on the member dashboard. Member-safe fields only.
 */
export async function GET() {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profile_spotlights")
      .select("id, kind, title, body, link_url, link_label, image_url, event_date, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12);
    if (error) throw error;

    return NextResponse.json({ spotlights: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/spotlights" });
  }
}
