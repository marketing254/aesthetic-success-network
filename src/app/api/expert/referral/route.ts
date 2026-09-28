import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import { getOrCreateExpertReferral } from "@/lib/referral";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expert/referral
 *
 * Returns the expert's referral code (creates one on first call) plus
 * lifetime + last-30-day signup counts so the portal card can show the
 * traction at a glance.
 */
export async function GET() {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data: expert } = await admin
      .from("experts")
      .select("display_name, full_name")
      .eq("id", guard.expertId)
      .maybeSingle();
    const name = expert?.display_name || expert?.full_name || "ASN";
    const { code, slug } = await getOrCreateExpertReferral(guard.expertId, name);

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
    // here; the team controls activation from the admin console. Absent
    // until migration 0054 runs / the admin console generates codes.
    let promo: { code: string; active: boolean; trialDays: number; uses: number } | null = null;
    try {
      const { data: promoRow } = await admin
        .from("member_promo_codes")
        .select("id, code, active, trial_days")
        .eq("expert_id", guard.expertId)
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

    return NextResponse.json({
      code,
      slug, // vanity handle → www.aestheticsuccessnetwork.com/<slug>
      signupsLifetime,
      signupsLast30,
      conversions,
      promo,
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/referral" });
  }
}
