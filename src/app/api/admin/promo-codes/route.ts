import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { ensurePromoCodesForOwners, isMissingPromoTables, promoBaseFromName } from "@/lib/promoCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin console — member promotional codes.
 *
 *   GET    → ensure every expert/partner has a code (idempotent sweep),
 *            then list all codes with owner names + redemption counts.
 *   POST   → { label, code?, trial_days? } — create a TEAM code (no owner),
 *            e.g. TEAM10. Starts inactive.
 *   PATCH  → { id, action: "activate" | "deactivate" }.
 *
 * A code only works at member checkout while active. Deactivating takes
 * effect immediately — the payment page rejects it on the next attempt.
 */

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "GET /api/admin/promo-codes";

  try {
    const sb = getSupabaseAdmin();
    const created = await ensurePromoCodesForOwners();

    const { data: codes, error } = await sb
      .from("member_promo_codes")
      .select("id, code, label, expert_id, vendor_id, active, trial_days, max_uses, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const expertIds = (codes ?? []).map((c) => c.expert_id).filter(Boolean) as string[];
    const vendorIds = (codes ?? []).map((c) => c.vendor_id).filter(Boolean) as string[];
    const [{ data: experts }, { data: vendors }, { data: redemptions }] = await Promise.all([
      expertIds.length
        ? sb.from("experts").select("id, display_name, full_name").in("id", expertIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; full_name: string | null }[] }),
      vendorIds.length
        ? sb.from("vendors").select("id, display_name, company_name").in("id", vendorIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; company_name: string | null }[] }),
      sb.from("member_promo_redemptions").select("promo_code_id"),
    ]);

    const expertMap = new Map((experts ?? []).map((e) => [e.id, e.display_name || e.full_name || "(unnamed)"]));
    const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.display_name || v.company_name || "(unnamed)"]));
    const useCounts = new Map<string, number>();
    for (const r of redemptions ?? []) {
      useCounts.set(r.promo_code_id, (useCounts.get(r.promo_code_id) ?? 0) + 1);
    }

    return NextResponse.json({
      created,
      codes: (codes ?? []).map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        active: c.active,
        trial_days: c.trial_days,
        max_uses: c.max_uses,
        created_at: c.created_at,
        owner:
          c.expert_id && c.vendor_id
            ? {
                kind: "both" as const,
                name: `${expertMap.get(c.expert_id) ?? "(expert)"} · ${vendorMap.get(c.vendor_id) ?? "(partner)"}`,
              }
            : c.expert_id
              ? { kind: "expert" as const, name: expertMap.get(c.expert_id) ?? "(unknown expert)" }
              : c.vendor_id
                ? { kind: "partner" as const, name: vendorMap.get(c.vendor_id) ?? "(unknown partner)" }
                : { kind: "team" as const, name: c.label ?? "Team" },
        uses: useCounts.get(c.id) ?? 0,
      })),
    });
  } catch (err) {
    if (isMissingPromoTables(err)) {
      return NextResponse.json(
        { error: "Promo-code tables not found. Run supabase/migrations/0054_member_promo_codes.sql in the Supabase SQL editor first." },
        { status: 503 },
      );
    }
    return serverError(err, { route });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/promo-codes";

  let body: { label?: string; code?: string; trial_days?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const label = (body.label ?? "").trim();
  if (label.length < 2) return apiError.badRequest("Add a label (who/what this code promotes).", route);
  const code = (body.code ?? "").trim().toUpperCase() || promoBaseFromName(label);
  if (!/^[A-Z0-9][A-Z0-9-]{1,15}[A-Z0-9]$/.test(code)) {
    return apiError.badRequest("Codes are 3 to 17 letters/numbers, hyphens allowed inside (e.g. MAYA or MAYA-GLOW).", route);
  }
  const trialDays = Number.isFinite(body.trial_days) ? Math.min(Math.max(Number(body.trial_days), 7), 365) : 90;

  try {
    const sb = getSupabaseAdmin();
    const { data: clash } = await sb
      .from("member_promo_codes")
      .select("id")
      .ilike("code", code)
      .maybeSingle();
    if (clash) return apiError.badRequest(`Code ${code} is already taken.`, route);

    const { data: row, error } = await sb
      .from("member_promo_codes")
      .insert({ code, label, trial_days: trialDays, created_by: guard.adminId })
      .select("id, code")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: row.id, code: row.code });
  } catch (err) {
    if (isMissingPromoTables(err)) {
      return NextResponse.json(
        { error: "Promo-code tables not found. Run migration 0054 first." },
        { status: 503 },
      );
    }
    return serverError(err, { route });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "PATCH /api/admin/promo-codes";

  let body: { id?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }
  if (!body.id || (body.action !== "activate" && body.action !== "deactivate")) {
    return apiError.badRequest("id and a valid action are required.", route);
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: existing } = await sb
      .from("member_promo_codes")
      .select("id, code")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing) return apiError.notFound(route);

    const { error } = await sb
      .from("member_promo_codes")
      .update({ active: body.action === "activate", updated_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}
