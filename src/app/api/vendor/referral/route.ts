import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidVendor } from "@/lib/auth/guards";
import { getOrCreateVendorReferral } from "@/lib/referral";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/referral
 *
 * Same shape as the expert endpoint, scoped to the signed-in partner.
 */
export async function GET() {
  const guard = await requirePaidVendor();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data: vendor } = await admin
      .from("vendors")
      .select("display_name, company_name")
      .eq("id", guard.vendorId)
      .maybeSingle();
    const name = vendor?.display_name || vendor?.company_name || "ASN";
    const { code, slug } = await getOrCreateVendorReferral(guard.vendorId, name);

    const { data: row } = await admin
      .from("referral_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    let signupsLifetime = 0;
    let signupsLast30 = 0;
    let conversions = 0;
    if (row) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: signups } = await admin
        .from("referral_signups")
        .select("id, created_at, converted_at")
        .eq("code_id", row.id);
      signupsLifetime = (signups ?? []).length;
      signupsLast30 = (signups ?? []).filter((s) => s.created_at >= cutoff).length;
      conversions = (signups ?? []).filter((s) => !!s.converted_at).length;
    }

    // Promotional code (admin-activated 3-month-trial code) — read-only
    // here; activation is team-controlled. Absent until migration 0054.
    let promo: { code: string; active: boolean; trialDays: number; uses: number } | null = null;
    try {
      const { data: promoRow } = await admin
        .from("member_promo_codes")
        .select("id, code, active, trial_days")
        .eq("vendor_id", guard.vendorId)
        .maybeSingle();
      if (promoRow) {
        const { count } = await admin
          .from("member_promo_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("promo_code_id", promoRow.id);
        promo = {
          code: promoRow.code,
          active: promoRow.active,
          trialDays: promoRow.trial_days,
          uses: count ?? 0,
        };
      }
    } catch {
      /* promo tables not present yet — card simply hides */
    }

    return NextResponse.json({ code, slug, signupsLifetime, signupsLast30, conversions, promo });
  } catch (err) {
    return serverError(err, { route: "GET /api/vendor/referral" });
  }
}
