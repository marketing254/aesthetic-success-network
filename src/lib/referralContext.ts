import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isPromoFullyClaimed } from "@/lib/promoCodes";
import { normalizeCode } from "@/lib/waitlist/validate";

/**
 * Resolves a referral code into the public context for the personalized
 * invitation header on /join/member. Server-side so the header is in the
 * FIRST paint — no flash of the organic page before it appears.
 *
 * Returns ONLY what already appears on the owner's public directory
 * profile (name, specialty/category, headshot/logo) plus whether their
 * months-free offer is currently running. Never promo codes or seats.
 */

export type RefContext = {
  name: string;
  kind: "expert" | "partner" | "team";
  tagline: string | null;
  imageUrl: string | null;
  /** For dual-role people (expert who is also a partner, matched by
   *  email): the other hat's name: an expert's page mentions their
   *  company, the company's page mentions the expert. */
  pairedName: string | null;
  offerActive: boolean;
  offerMonths: number;
};

export async function getReferralContext(ref: string | undefined | null): Promise<RefContext | null> {
  // Strict shape check first (/^[A-Z0-9-]{4,16}$/i, upper-cased); never pass
  // raw input to .ilike(). Codes are stored upper-case, so .eq() is exact.
  const code = normalizeCode(ref);
  if (!code) return null;

  try {
    const sb = getSupabaseAdmin();
    const { data: rc } = await sb
      .from("referral_codes")
      .select("expert_id, vendor_id, active")
      .eq("code", code)
      .maybeSingle();
    if (!rc || !rc.active || (!rc.expert_id && !rc.vendor_id)) return null;

    let name: string | null = null;
    let kind: "expert" | "partner" = "expert";
    let tagline: string | null = null;
    let imageUrl: string | null = null;
    let pairedName: string | null = null;

    if (rc.expert_id) {
      const { data: e } = await sb
        .from("experts")
        .select("display_name, full_name, email, specialty, headshot_url, status")
        .eq("id", rc.expert_id)
        .maybeSingle();
      if (!e || e.status === "archived" || e.status === "suspended") return null;
      name = e.display_name || e.full_name;
      tagline = e.specialty;
      imageUrl = e.headshot_url;
      // Dual-role: their company's partner profile shares the same email.
      if (e.email) {
        const { data: pv } = await sb
          .from("vendors")
          .select("display_name, company_name, status")
          .ilike("contact_email", e.email)
          .maybeSingle();
        if (pv && pv.status !== "suspended") pairedName = pv.display_name || pv.company_name;
      }
    } else if (rc.vendor_id) {
      const { data: v } = await sb
        .from("vendors")
        .select("display_name, company_name, contact_email, category, logo_url, avatar_url, status")
        .eq("id", rc.vendor_id)
        .maybeSingle();
      if (!v || v.status === "suspended") return null;
      kind = "partner";
      name = v.display_name || v.company_name;
      tagline = v.category;
      imageUrl = v.logo_url ?? v.avatar_url;
      // Dual-role: the founder's expert profile shares the same email.
      if (v.contact_email) {
        const { data: pe } = await sb
          .from("experts")
          .select("display_name, full_name, status")
          .ilike("email", v.contact_email)
          .maybeSingle();
        if (pe && pe.status !== "archived" && pe.status !== "suspended") {
          pairedName = pe.display_name || pe.full_name;
        }
      }
    }
    if (!name) return null;

    // Is the owner's months-free promo actually running right now?
    let offerActive = false;
    let offerMonths = 3;
    try {
      const owner = rc.expert_id
        ? sb.from("member_promo_codes").select("id, active, trial_days").eq("expert_id", rc.expert_id)
        : sb.from("member_promo_codes").select("id, active, trial_days").eq("vendor_id", rc.vendor_id!);
      const { data: promoRows } = await owner.limit(1);
      const promo = promoRows?.[0];
      if (promo?.active && !(await isPromoFullyClaimed(promo.id))) {
        offerActive = true;
        offerMonths = Math.max(1, Math.round(promo.trial_days / 30));
      }
    } catch {
      /* promo tables absent — invitation renders without the offer */
    }

    return { name, kind, tagline, imageUrl, pairedName, offerActive, offerMonths };
  } catch {
    return null;
  }
}

/**
 * Same invitation-header treatment for direct promo-code arrivals
 * (?promo=DIRECT from the exit popup, or any owner-less team code). These codes have no expert/partner owner, so the header
 * renders as a gift from the ASN team — never an individual's name.
 * Owner-attached codes return null here; those arrive via ?ref= and get
 * the personalized header instead.
 */
export async function getPromoContext(promo: string | undefined | null): Promise<RefContext | null> {
  // Strict shape check first (/^[A-Z0-9-]{4,16}$/i, upper-cased); never pass
  // raw input to .ilike(). Codes are stored upper-case, so .eq() is exact.
  const code = normalizeCode(promo);
  if (!code) return null;

  try {
    const sb = getSupabaseAdmin();
    const { data: rows } = await sb
      .from("member_promo_codes")
      .select("id, active, trial_days, expert_id, vendor_id")
      .eq("code", code)
      .limit(1);
    const row = rows?.[0];
    if (!row || !row.active || row.expert_id || row.vendor_id) return null;
    if (await isPromoFullyClaimed(row.id)) return null;

    return {
      name: "Aesthetic Success Network",
      kind: "team",
      tagline: "We'd love to welcome you in",
      imageUrl: "/asn-app-icon.png",
      pairedName: null,
      offerActive: true,
      offerMonths: Math.max(1, Math.round((row.trial_days ?? 90) / 30)),
    };
  } catch {
    return null;
  }
}
