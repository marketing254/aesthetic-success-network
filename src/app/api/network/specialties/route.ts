import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/network/specialties
 *
 * Returns the distinct expert specialties that currently have at least one
 * approved expert. Powers the category filter on the member network feed.
 * Sorted alphabetically.
 */
export async function GET() {
  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("experts")
      .select("specialty")
      .not("specialty", "is", null);
    if (error) throw error;
    const set = new Set<string>();
    for (const row of data ?? []) {
      const s = (row.specialty ?? "").trim();
      if (s) set.add(s);
    }
    const specialties = Array.from(set).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ specialties });
  } catch (err) {
    return serverError(err, { route: "GET /api/network/specialties" });
  }
}
