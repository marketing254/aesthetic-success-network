import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/lead-magnets[?slug=<magnet-slug>]
 *
 * Returns every captured lead, newest first, capped at 500.
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from("lead_magnet_leads")
      .select("id, magnet_slug, email, full_name, source, contacted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (slug) query = query.eq("magnet_slug", slug);
    const { data, error } = await query;
    if (error) throw error;

    // Per-magnet summary so the tile row above the table can show counts
    // without the page re-grouping in JS.
    const summary = new Map<string, { magnet_slug: string; count: number; contacted: number }>();
    for (const r of data ?? []) {
      const cur = summary.get(r.magnet_slug) ?? {
        magnet_slug: r.magnet_slug,
        count: 0,
        contacted: 0,
      };
      cur.count += 1;
      if (r.contacted_at) cur.contacted += 1;
      summary.set(r.magnet_slug, cur);
    }

    return NextResponse.json({ leads: data ?? [], summary: Array.from(summary.values()) });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/lead-magnets" });
  }
}

/**
 * PATCH /api/admin/lead-magnets   { id, contacted: boolean }
 *
 * Marks a lead as contacted (or un-marks). Cheap manual tracking — the
 * team flips this when they've followed up.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; contacted?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }
  if (!body.id) return apiError.validation("Missing id.");

  try {
    const admin = getSupabaseAdmin();
    await admin
      .from("lead_magnet_leads")
      .update({ contacted_at: body.contacted ? new Date().toISOString() : null })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/lead-magnets" });
  }
}
