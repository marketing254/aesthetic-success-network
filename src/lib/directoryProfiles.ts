import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isHiddenFromDirectory } from "@/lib/directoryVisibility";
import { sortExpertsHouseFirst, sortPartnersHouseFirst } from "@/lib/houseOrder";

/**
 * Server data for the PUBLIC expert and company profile pages
 * (/experts/[id], /companies/[id]). Same publish-ready gates as
 * /api/directory/*:
 *   expert   active + headshot + bio, not hidden
 *   company  approved + verified + logo + description, not hidden, and a
 *            covered company only while its paying company is live
 * Only public-safe fields leave this module: never email, phone, billing or
 * booking/calendar links (booking is a member benefit).
 */

export type PublicExpert = {
  id: string;
  name: string;
  specialty: string | null;
  company_name: string | null;
  bio: string;
  topics: string[];
  website: string | null;
  headshot_url: string;
};

export type PublicCompany = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  website: string | null;
  logo_url: string;
};

export type Teaser = { id: string; kind: string; dateLabel: string | null };

/** "weight and wellness platform" -> "Weight and wellness platform". */
export function tidyLabel(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function splitTopics(raw: unknown): string[] {
  return [...new Set(String(raw ?? "").split(/[,\n;]+/).map((t) => tidyLabel(t) ?? "").filter(Boolean))].slice(0, 8);
}

async function expertRow(where: { id?: string; email?: string }) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("experts")
    .select("id, display_name, full_name, specialty, company_name, bio, topics, website, headshot_url, status, email");
  q = where.id ? q.eq("id", where.id) : q.eq("email", where.email ?? "");
  const { data } = await q.maybeSingle();
  if (!data || data.status !== "active" || !data.headshot_url || !data.bio) return null;
  if (isHiddenFromDirectory(data.email)) return null;
  return data;
}

function toPublicExpert(d: NonNullable<Awaited<ReturnType<typeof expertRow>>>): PublicExpert {
  return {
    id: d.id,
    name: d.display_name || d.full_name || "ASN Expert",
    specialty: tidyLabel(d.specialty),
    company_name: d.company_name || null,
    bio: String(d.bio),
    // A topic that only repeats the specialty line adds nothing.
    topics: splitTopics(d.topics).filter((t) => t.toLowerCase() !== (tidyLabel(d.specialty) ?? "").toLowerCase()),
    website: d.website || null,
    headshot_url: d.headshot_url as string,
  };
}

async function companyRow(where: { id?: string; email?: string }) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("vendors")
    .select("id, company_name, display_name, category, description, logo_url, avatar_url, website, status, verified, billing_parent_id, contact_email");
  q = where.id ? q.eq("id", where.id) : q.eq("contact_email", where.email ?? "");
  const { data: v } = await q.maybeSingle();
  if (!v || v.status !== "approved" || !v.verified || !(v.logo_url ?? v.avatar_url) || !v.description) return null;
  if (isHiddenFromDirectory(v.contact_email)) return null;
  if (v.billing_parent_id) {
    const { data: parent } = await sb.from("vendors").select("status, verified").eq("id", v.billing_parent_id).maybeSingle();
    if (!parent || parent.status !== "approved" || !parent.verified) return null;
  }
  return v;
}

function toPublicCompany(v: NonNullable<Awaited<ReturnType<typeof companyRow>>>): PublicCompany {
  return {
    id: v.id,
    name: v.display_name || v.company_name || "ASN Company",
    category: tidyLabel(v.category),
    description: String(v.description),
    website: v.website || null,
    logo_url: (v.logo_url ?? v.avatar_url) as string,
  };
}

/** A public expert plus their linked company (same sign-in email), if public. */
export async function getPublicExpert(id: string): Promise<{ expert: PublicExpert; company: PublicCompany | null } | null> {
  const row = await expertRow({ id });
  if (!row) return null;
  const co = await companyRow({ email: String(row.email) }).catch(() => null);
  return { expert: toPublicExpert(row), company: co ? toPublicCompany(co) : null };
}

/** A public company plus its linked expert (same sign-in email), if public. */
export async function getPublicCompany(id: string): Promise<{ company: PublicCompany; expert: PublicExpert | null } | null> {
  const row = await companyRow({ id });
  if (!row) return null;
  const ex = await expertRow({ email: String(row.contact_email) }).catch(() => null);
  return { company: toPublicCompany(row), expert: ex ? toPublicExpert(ex) : null };
}

function teaser(rows: { id: string; kind: string; event_date: string | null }[] | null): Teaser[] {
  return (rows ?? []).map((s) => ({
    id: s.id,
    kind: String(s.kind).charAt(0).toUpperCase() + String(s.kind).slice(1),
    dateLabel: s.event_date
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(s.event_date))
      : null,
  }));
}

/** Kit titles (public teaser) and spotlight kinds/dates for an expert. */
export async function expertExtras(id: string): Promise<{ kits: string[]; spotlights: Teaser[] }> {
  const sb = getSupabaseAdmin();
  const [{ data: kitRows }, { data: spotRows }] = await Promise.all([
    sb.from("resources").select("topic_slug, topic_title").eq("originating_expert_id", id).eq("is_published", true).eq("submission_status", "approved"),
    sb.from("profile_spotlights").select("id, kind, event_date").eq("expert_id", id).eq("is_published", true).order("published_at", { ascending: false, nullsFirst: false }).limit(4),
  ]);
  const kits = [...new Map((kitRows ?? []).map((r) => [r.topic_slug, String(r.topic_title)])).values()];
  return { kits, spotlights: teaser(spotRows as never) };
}

/** Approved offer count (headlines stay members-only) and spotlights for a company. */
export async function companyExtras(id: string): Promise<{ offerCount: number; spotlights: Teaser[] }> {
  const sb = getSupabaseAdmin();
  const [{ count }, { data: spotRows }] = await Promise.all([
    sb.from("offers").select("id", { count: "exact", head: true }).eq("vendor_id", id).eq("review_status", "approved"),
    sb.from("profile_spotlights").select("id, kind, event_date").eq("vendor_id", id).eq("is_published", true).order("published_at", { ascending: false, nullsFirst: false }).limit(4),
  ]);
  return { offerCount: count ?? 0, spotlights: teaser(spotRows as never) };
}

export type MiniCard = { id: string; name: string; sub: string | null; image: string };

/** Up to `n` other public experts for the "More experts" row. */
export async function otherExperts(excludeId: string, n = 3): Promise<MiniCard[]> {
  const { data } = await getSupabaseAdmin()
    .from("experts")
    .select("id, display_name, full_name, specialty, company_name, headshot_url, email")
    .eq("status", "active")
    .not("headshot_url", "is", null)
    .not("bio", "is", null)
    .neq("id", excludeId);
  const rows = sortExpertsHouseFirst((data ?? []).filter((e) => !isHiddenFromDirectory(e.email)), (e) => e.display_name || e.full_name);
  return rows.slice(0, n).map((e) => ({
    id: e.id,
    name: e.display_name || e.full_name || "ASN Expert",
    sub: e.company_name || tidyLabel(e.specialty),
    image: e.headshot_url as string,
  }));
}

/** Up to `n` other public companies for the "More companies" row. */
export async function otherCompanies(excludeId: string, n = 3): Promise<MiniCard[]> {
  const { data } = await getSupabaseAdmin()
    .from("vendors")
    .select("id, company_name, display_name, category, logo_url, avatar_url, contact_email, billing_parent_id")
    .eq("status", "approved")
    .eq("verified", true)
    .not("logo_url", "is", null)
    .not("description", "is", null)
    .neq("id", excludeId);
  const rows = sortPartnersHouseFirst(
    (data ?? []).filter((v) => !isHiddenFromDirectory(v.contact_email) && !v.billing_parent_id),
    (v) => v.display_name || v.company_name,
  );
  return rows.slice(0, n).map((v) => ({
    id: v.id,
    name: v.display_name || v.company_name || "ASN Company",
    sub: tidyLabel(v.category),
    image: (v.logo_url ?? v.avatar_url) as string,
  }));
}
