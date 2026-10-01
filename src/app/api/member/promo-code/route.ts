import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveCheckoutMember } from "@/lib/auth/guards";
import { isPromoFullyClaimed } from "@/lib/promoCodes";
import { normalizeCode } from "@/lib/waitlist/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PromoRow = {
  id: string;
  code: string;
  active: boolean;
  trial_days: number;
  expert_id: string | null;
  vendor_id: string | null;
};

/**
 * POST /api/member/promo-code — { code? , ref? }
 *
 * Two modes for the /upgrade payment page:
 *   code — typed into the invitation-code field: validate it and return
 *          the "courtesy of" owner name.
 *   ref  — a referral code from a partner/expert link (?ref= param, or
 *          the asn_ref attribution cookie when the body has neither):
 *          resolve the link's owner and return THEIR promo code so it
 *          auto-applies — nothing to remember or type. Silent no-op when
 *          the owner has no active code.
 *
 * Checkout re-validates server-side regardless — this is UX only.
 */
export async function POST(req: Request) {
  const guard = await resolveCheckoutMember();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { code?: unknown; ref?: unknown };
  // Strict shape (CODE_RE) BEFORE any query: a value like "%" must never
  // reach a wildcard-capable lookup. Lookups below use exact `.eq()` on
  // the upper-cased code (member_promo_codes.code and referral_codes.code
  // are stored upper-case).
  const rawCode = typeof body.code === "string" ? body.code : "";
  const code = normalizeCode(rawCode);
  if (rawCode.trim() && !code) return NextResponse.json({ valid: false, reason: "invalid" });
  let ref = normalizeCode(typeof body.ref === "string" ? body.ref : "");
  if (!code && !ref) {
    // Attribution cookie set by middleware on first arrival via a
    // referral link — survives browsing before signup.
    const jar = await cookies();
    ref = normalizeCode(jar.get("asn_ref")?.value ?? "");
  }

  try {
    const sb = getSupabaseAdmin();

    let promo: PromoRow | null = null;
    if (code) {
      const { data } = await sb
        .from("member_promo_codes")
        .select("id, code, active, trial_days, expert_id, vendor_id")
        .eq("code", code)
        .maybeSingle();
      if (!data) return NextResponse.json({ valid: false, reason: "invalid" });
      if (!data.active) return NextResponse.json({ valid: false, reason: "inactive" });
      if (await isPromoFullyClaimed(data.id)) {
        return NextResponse.json({ valid: false, reason: "full" });
      }
      promo = data;
    } else if (ref) {
      const { data: refRow } = await sb
        .from("referral_codes")
        .select("expert_id, vendor_id")
        .eq("code", ref)
        .maybeSingle();
      if (!refRow || (!refRow.expert_id && !refRow.vendor_id)) {
        return NextResponse.json({ valid: false, reason: "invalid" });
      }
      // The owner's promo code — prefer a row matching either profile.
      const owner = refRow.expert_id
        ? sb.from("member_promo_codes").select("id, code, active, trial_days, expert_id, vendor_id").eq("expert_id", refRow.expert_id)
        : sb.from("member_promo_codes").select("id, code, active, trial_days, expert_id, vendor_id").eq("vendor_id", refRow.vendor_id!);
      const { data: promoRows } = await owner.limit(1);
      const row = promoRows?.[0] ?? null;
      if (!row || !row.active) return NextResponse.json({ valid: false, reason: "inactive" });
      // Auto-apply stays silent when the code's seats are gone.
      if (await isPromoFullyClaimed(row.id)) {
        return NextResponse.json({ valid: false, reason: "full" });
      }
      promo = row;
    } else {
      return NextResponse.json({ valid: false, reason: "invalid" });
    }

    // "Courtesy of {owner}" — company name for partners, person for
    // experts, null → the frontend says "the ASN team".
    let ownerName: string | null = null;
    if (promo.vendor_id) {
      const { data: v } = await sb
        .from("vendors")
        .select("display_name, company_name")
        .eq("id", promo.vendor_id)
        .maybeSingle();
      ownerName = v?.display_name || v?.company_name || null;
    }
    if (!ownerName && promo.expert_id) {
      const { data: e } = await sb
        .from("experts")
        .select("display_name, full_name")
        .eq("id", promo.expert_id)
        .maybeSingle();
      ownerName = e?.display_name || e?.full_name || null;
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      trialDays: promo.trial_days,
      ownerName,
    });
  } catch {
    // Table missing (migration 0054 not run) or transient failure — treat
    // as invalid rather than erroring the payment page.
    return NextResponse.json({ valid: false, reason: "invalid" });
  }
}
