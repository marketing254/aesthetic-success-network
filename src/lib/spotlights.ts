import "server-only";
import type { getSupabaseAdmin } from "@/lib/supabase/server";
import type { SpotlightKind } from "@/lib/supabase/types";

type SB = ReturnType<typeof getSupabaseAdmin>;

/** The member-safe shape of a spotlight shown on a profile. */
export type MemberSpotlight = {
  id: string;
  kind: SpotlightKind;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  event_date: string | null;
  published_at: string | null;
};

/**
 * Published spotlights for one owner (expert OR partner), newest first.
 * Used by the member profile APIs. Service-role read (routes are guarded).
 */
export async function fetchPublishedSpotlights(
  admin: SB,
  owner: { expertId: string } | { vendorId: string },
): Promise<MemberSpotlight[]> {
  const base = admin
    .from("profile_spotlights")
    .select("id, kind, title, body, link_url, link_label, image_url, event_date, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(20);
  const q = "expertId" in owner ? base.eq("expert_id", owner.expertId) : base.eq("vendor_id", owner.vendorId);
  const { data } = await q;
  return (data ?? []) as MemberSpotlight[];
}
