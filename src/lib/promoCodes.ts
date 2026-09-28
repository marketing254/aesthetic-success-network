import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Member promotional codes (migration 0054).
 *
 * Naming convention (easy to say out loud / print on a slide):
 *   expert only      → first name         MARY
 *   partner only     → company word       COOP
 *   expert + partner → combined           MARY-COOP  (one code, linked to
 *                      both profiles so it shows in both portals)
 * Team codes have no owner.
 *
 * A code does nothing until the team ACTIVATES it from the admin console.
 * Active codes give a joining member a trial (default 90 days = 3 months)
 * at Stripe checkout: card collected up front, first charge after the
 * trial. Deactivating kills it at checkout immediately.
 */

const CODE_SUFFIX_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "Glow Aesthetics, med spa ops" → "GLOW"; "Dr. Maya Patel" → "MAYA". */
export function promoBaseFromName(name: string): string {
  const words = (name || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    // Drop honorifics/articles so "Dr. Maya" → MAYA, "The Glow Group" → GLOW.
    .filter((w, i) => !(i === 0 && ["DR", "THE", "A", "AN", "MR", "MRS", "MS"].includes(w)));
  const first = words[0] ?? "";
  // Too short to be memorable on its own ("JB") → pull in the next word.
  const base = first.length >= 3 ? first : `${first}${words[1] ?? ""}`;
  return base.slice(0, 10) || "ASN";
}

/** Find a free code: BASE, then BASE + 2–3 random chars on collision. */
async function allocatePromoCode(base: string, taken: Set<string>): Promise<string> {
  if (!taken.has(base)) return base;
  for (let i = 0; i < 12; i += 1) {
    let suffix = "";
    const len = i < 6 ? 2 : 3;
    for (let j = 0; j < len; j += 1) {
      suffix += CODE_SUFFIX_ALPHABET[Math.floor(Math.random() * CODE_SUFFIX_ALPHABET.length)];
    }
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/**
 * Ensure every non-archived expert and every non-suspended partner has a
 * promo code row. An expert whose email matches a partner's contact email
 * is the SAME person wearing both hats: they get ONE combined code
 * (MARY-COOP) linked to both profiles. Idempotent: safe to run on every
 * admin-console load. New codes start INACTIVE. Returns how many were
 * created.
 */
export async function ensurePromoCodesForOwners(): Promise<number> {
  const sb = getSupabaseAdmin();

  const [{ data: experts }, { data: vendors }, { data: existing }] = await Promise.all([
    sb
      .from("experts")
      .select("id, display_name, full_name, email, company_name, status")
      .not("status", "in", "(archived,suspended)"),
    sb
      .from("vendors")
      .select("id, company_name, display_name, contact_email, status")
      .neq("status", "suspended"),
    sb.from("member_promo_codes").select("code, expert_id, vendor_id"),
  ]);

  const taken = new Set((existing ?? []).map((r) => r.code.toUpperCase()));
  const haveExpert = new Set((existing ?? []).map((r) => r.expert_id).filter(Boolean));
  const haveVendor = new Set((existing ?? []).map((r) => r.vendor_id).filter(Boolean));

  // Pair expert ↔ partner profiles that belong to the same person.
  const vendorByEmail = new Map(
    (vendors ?? [])
      .filter((v) => v.contact_email)
      .map((v) => [v.contact_email!.toLowerCase(), v]),
  );

  type NewRow = {
    code: string;
    label: string;
    expert_id: string | null;
    vendor_id: string | null;
  };
  const rows: NewRow[] = [];
  const pairedVendorIds = new Set<string>();

  for (const e of experts ?? []) {
    const name = e.display_name || e.full_name || "Expert";
    const firstName = promoBaseFromName(name).slice(0, 8);
    const pairedVendor = e.email ? vendorByEmail.get(e.email.toLowerCase()) : undefined;

    if (pairedVendor) pairedVendorIds.add(pairedVendor.id);
    if (haveExpert.has(e.id)) continue;

    if (pairedVendor) {
      // Expert + partner → one combined code covering both profiles.
      if (haveVendor.has(pairedVendor.id)) continue;
      const companyWord = promoBaseFromName(
        pairedVendor.display_name || pairedVendor.company_name || e.company_name || "",
      ).slice(0, 8);
      const base = companyWord && companyWord !== "ASN" ? `${firstName}-${companyWord}` : firstName;
      const code = await allocatePromoCode(base, taken);
      taken.add(code);
      rows.push({
        code,
        label: `${name} · ${pairedVendor.display_name || pairedVendor.company_name}`,
        expert_id: e.id,
        vendor_id: pairedVendor.id,
      });
    } else {
      // Expert only → first name.
      const code = await allocatePromoCode(firstName, taken);
      taken.add(code);
      rows.push({
        code,
        label: e.company_name ? `${name} · ${e.company_name}` : name,
        expert_id: e.id,
        vendor_id: null,
      });
    }
  }

  for (const v of vendors ?? []) {
    if (haveVendor.has(v.id) || pairedVendorIds.has(v.id)) continue;
    // Partner only → company word.
    const name = v.display_name || v.company_name || "Partner";
    const base = promoBaseFromName(name);
    const code = await allocatePromoCode(base, taken);
    taken.add(code);
    rows.push({ code, label: name, expert_id: null, vendor_id: v.id });
  }

  if (rows.length === 0) return 0;
  const { error } = await sb.from("member_promo_codes").insert(rows);
  if (error) throw error;
  return rows.length;
}

/**
 * Seat cap (0055): each code covers a limited number of seats
 * (max_uses, default 10). True when every seat is taken. Fails open
 * (false) pre-migration or on any error: the cap is a marketing
 * control, not a security boundary.
 */
export async function isPromoFullyClaimed(promoCodeId: string): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    const { data: row, error } = await sb
      .from("member_promo_codes")
      .select("max_uses")
      .eq("id", promoCodeId)
      .single();
    if (error || !row) return false;
    const { count } = await sb
      .from("member_promo_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", promoCodeId);
    return (count ?? 0) >= row.max_uses;
  } catch {
    return false;
  }
}

/** True when the error smells like "migration 0054 hasn't run here yet". */
export function isMissingPromoTables(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  return /member_promo_(codes|redemptions)/.test(msg) && /does not exist|not find|schema cache/i.test(msg);
}
