import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeCode } from "@/lib/waitlist/validate";

/**
 * Generate a short, human-readable referral code (e.g. "MARY7K3X"). Avoids
 * easily-confused characters (0/O/1/I). 6 chars by default.
 */
export function generateReferralCode(prefix: string, length = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const clean = prefix.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "ASN";
  return `${clean}${suffix}`;
}

/**
 * Turn an owner's display name into a vanity handle for the shareable link
 * www.aestheticsuccessnetwork.com/<handle>.
 *
 *   "Dr. Maya Patel"        -> "drmaya"
 *   "The Glow Group"        -> "glowgroup"
 *   "Jordan Lee"            -> "jordanlee"
 *
 * Keeps it name-based and short: drops leading articles (the/a/an) but NOT
 * titles (so "Dr Maya" stays "drmaya"), takes the first two meaningful
 * words, lowercases, strips to [a-z0-9], caps length. Returns "" if nothing
 * usable is left (caller falls back to the code).
 */
export function slugifyHandle(name: string): string {
  const words = (name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  while (words.length > 1 && ["the", "a", "an"].includes(words[0])) words.shift();
  let handle = words.slice(0, 2).join("");
  // If two words were too short (e.g. initials), pull in a third.
  if (handle.length < 4 && words.length > 2) handle = words.slice(0, 3).join("");
  return handle.slice(0, 20);
}

const HANDLE_SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function randomHandleSuffix(len = 3): string {
  let s = "";
  for (let i = 0; i < len; i += 1) s += HANDLE_SUFFIX_ALPHABET[Math.floor(Math.random() * HANDLE_SUFFIX_ALPHABET.length)];
  return s;
}

/**
 * Find a free vanity handle derived from `name`, avoiding case-insensitive
 * collisions with existing handles. Falls back to `<base>-<suffix>` when the
 * clean handle is taken, and to the code-derived handle if the name yields
 * nothing usable.
 */
async function allocateHandle(name: string, fallbackCode: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const base = slugifyHandle(name) || fallbackCode.toLowerCase();
  const taken = async (h: string) => {
    const { data } = await admin
      .from("referral_codes")
      .select("id")
      .ilike("slug", h) // ilike = case-insensitive exact (no wildcards in h)
      .maybeSingle();
    return !!data;
  };
  if (!(await taken(base))) return base;
  for (let i = 0; i < 8; i += 1) {
    const candidate = `${base}-${randomHandleSuffix(i < 4 ? 2 : 3)}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Extremely unlikely — last resort keeps it unique via the code.
  return `${base}-${fallbackCode.toLowerCase()}`;
}

/**
 * Ensure (or create) a referral code + vanity handle for an expert.
 * Idempotent. Backfills the handle on legacy rows that predate it.
 */
export async function getOrCreateExpertReferral(
  expertId: string,
  displayName: string,
): Promise<{ code: string; slug: string }> {
  return getOrCreateReferral("expert_id", expertId, displayName);
}

/** Same as the expert helper, scoped to a vendor (partner). */
export async function getOrCreateVendorReferral(
  vendorId: string,
  displayName: string,
): Promise<{ code: string; slug: string }> {
  return getOrCreateReferral("vendor_id", vendorId, displayName);
}

async function getOrCreateReferral(
  ownerCol: "expert_id" | "vendor_id",
  ownerId: string,
  displayName: string,
): Promise<{ code: string; slug: string }> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("referral_codes")
    .select("id, code, slug")
    .eq(ownerCol, ownerId)
    .maybeSingle();

  if (existing) {
    if (existing.slug) return { code: existing.code, slug: existing.slug };
    // Legacy row without a handle — backfill one now.
    const slug = await allocateHandle(displayName, existing.code);
    await admin.from("referral_codes").update({ slug }).eq("id", existing.id);
    return { code: existing.code, slug };
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode(displayName);
    const slug = await allocateHandle(displayName, code);
    const { error } =
      ownerCol === "expert_id"
        ? await admin.from("referral_codes").insert({ expert_id: ownerId, code, slug })
        : await admin.from("referral_codes").insert({ vendor_id: ownerId, code, slug });
    if (!error) return { code, slug };
  }
  throw new Error("Could not allocate a unique referral code");
}

/**
 * Look up a referral code's row id by string. Returns null when invalid.
 * Used by the member-signup route to stamp the referral on the new row.
 */
export async function resolveReferralCode(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  // Strict shape check (CODE_RE) before the query: the value goes to an
  // exact `.eq()` on the upper-cased code, never to `.ilike()`.
  const trimmed = normalizeCode(code);
  if (!trimmed) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("referral_codes")
    .select("id, active")
    .eq("code", trimmed)
    .maybeSingle();
  if (!data || !data.active) return null;
  return data.id;
}

/**
 * Resolve a vanity handle (e.g. "drmaya") to its referral code, for the
 * root-level /<handle> redirect. Case-insensitive. Returns null when the
 * handle is unknown or its code is inactive.
 */
export async function resolveReferralSlug(slug: string | null | undefined): Promise<{ code: string } | null> {
  if (!slug) return null;
  const trimmed = slug.trim();
  if (!trimmed || !/^[a-zA-Z0-9-]{2,40}$/.test(trimmed)) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("referral_codes")
    .select("code, active")
    .ilike("slug", trimmed)
    .maybeSingle();
  if (!data || !data.active) return null;
  return { code: data.code };
}
