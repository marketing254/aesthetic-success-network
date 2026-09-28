import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { getOrCreateExpertReferral, getOrCreateVendorReferral } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/referrals
 *
 * Every referral code with owner, vanity handle, signup/conversion counts,
 * total revenue attributed, AND a per-member breakdown (which member each
 * expert/partner brought in and how much they've paid). Admin-only —
 * revenue is never exposed to the experts/partners themselves.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    // Idempotent sweep (same pattern as /api/admin/promo-codes): make sure
    // every active expert and every live partner has a referral link BEFORE
    // listing. Links are also created at founding acceptance now, but this
    // guarantees the console is always complete — including rows provisioned
    // through older paths that never generated one.
    try {
      const [{ data: allExperts }, { data: allVendors }, { data: existing }] = await Promise.all([
        admin.from("experts").select("id, display_name, full_name").eq("status", "active"),
        admin
          .from("vendors")
          .select("id, display_name, company_name, billing_parent_id")
          .eq("status", "approved")
          .eq("verified", true),
        admin.from("referral_codes").select("expert_id, vendor_id"),
      ]);
      const hasExpert = new Set((existing ?? []).map((c) => c.expert_id).filter(Boolean));
      const hasVendor = new Set((existing ?? []).map((c) => c.vendor_id).filter(Boolean));
      for (const e of allExperts ?? []) {
        if (!hasExpert.has(e.id)) {
          // eslint-disable-next-line no-await-in-loop
          await getOrCreateExpertReferral(e.id, e.display_name || e.full_name || "expert");
        }
      }
      for (const v of allVendors ?? []) {
        // Covered companies ride their paying partner's link — skip them.
        if (v.billing_parent_id) continue;
        if (!hasVendor.has(v.id)) {
          // eslint-disable-next-line no-await-in-loop
          await getOrCreateVendorReferral(v.id, v.display_name || v.company_name || "partner");
        }
      }
    } catch (err) {
      console.error("[admin referrals] sweep failed (listing continues):", err);
    }

    const { data: codes, error } = await admin
      .from("referral_codes")
      .select("id, code, slug, expert_id, vendor_id, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const expertIds = Array.from(new Set((codes ?? []).map((c) => c.expert_id).filter(Boolean) as string[]));
    const vendorIds = Array.from(new Set((codes ?? []).map((c) => c.vendor_id).filter(Boolean) as string[]));

    const [{ data: experts }, { data: vendors }] = await Promise.all([
      expertIds.length
        ? admin.from("experts").select("id, display_name, full_name").in("id", expertIds)
        : Promise.resolve({ data: [] }),
      vendorIds.length
        ? admin.from("vendors").select("id, display_name, company_name").in("id", vendorIds)
        : Promise.resolve({ data: [] }),
    ]);

    const expertMap = new Map((experts ?? []).map((e) => [e.id, e.display_name || e.full_name || ""]));
    const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.display_name || v.company_name || ""]));

    // All signup rows in one round-trip (cheap at this scale).
    const codeIds = (codes ?? []).map((c) => c.id);
    type Member = {
      member_id: string;
      name: string;
      email: string | null;
      status: string | null;
      joined_at: string;
      converted: boolean;
      revenue_cents: number;
      currency: string | null;
    };
    const membersByCode = new Map<string, Member[]>();

    if (codeIds.length > 0) {
      const { data: signups } = await admin
        .from("referral_signups")
        .select("code_id, member_id, converted_at, revenue_cents, currency, created_at")
        .in("code_id", codeIds)
        .order("created_at", { ascending: false });

      const memberIds = Array.from(new Set((signups ?? []).map((s) => s.member_id)));
      const { data: memberRows } = memberIds.length
        ? await admin.from("members").select("id, first_name, last_name, email, status").in("id", memberIds)
        : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null; status: string | null }[] };
      const memberMap = new Map((memberRows ?? []).map((m) => [m.id, m]));

      for (const s of signups ?? []) {
        const m = memberMap.get(s.member_id);
        const name = m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || "(member)" : "(member)";
        const entry: Member = {
          member_id: s.member_id,
          name,
          email: m?.email ?? null,
          status: m?.status ?? null,
          joined_at: s.created_at,
          converted: !!s.converted_at,
          revenue_cents: s.revenue_cents ?? 0,
          currency: s.currency ?? null,
        };
        const list = membersByCode.get(s.code_id) ?? [];
        list.push(entry);
        membersByCode.set(s.code_id, list);
      }
    }

    const enriched = (codes ?? []).map((c) => {
      const owner = c.expert_id
        ? { kind: "expert" as const, id: c.expert_id, name: expertMap.get(c.expert_id) || "(unnamed expert)" }
        : { kind: "vendor" as const, id: c.vendor_id!, name: vendorMap.get(c.vendor_id!) || "(unnamed partner)" };
      const members = membersByCode.get(c.id) ?? [];
      const conversions = members.filter((m) => m.converted).length;
      const revenue_cents = members.reduce((sum, m) => sum + (m.revenue_cents || 0), 0);
      const currency = members.find((m) => m.currency)?.currency ?? null;
      return {
        id: c.id,
        code: c.code,
        slug: c.slug ?? null,
        active: c.active,
        created_at: c.created_at,
        owner,
        signups: members.length,
        conversions,
        revenue_cents,
        currency,
        members,
      };
    });

    // Highest revenue first (then signups) so the biggest drivers lead.
    enriched.sort((a, b) => b.revenue_cents - a.revenue_cents || b.signups - a.signups);

    const totals = {
      signups: enriched.reduce((s, c) => s + c.signups, 0),
      conversions: enriched.reduce((s, c) => s + c.conversions, 0),
      revenue_cents: enriched.reduce((s, c) => s + c.revenue_cents, 0),
    };

    return NextResponse.json({ codes: enriched, totals });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/referrals" });
  }
}
