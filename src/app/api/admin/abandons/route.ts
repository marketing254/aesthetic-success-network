import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/abandons — the SPEC's reporting table for the abandoned
 * registration sequence: abandons per week, sent per email, resumed,
 * purchased, unsubscribed. The team reads it weekly with the ad
 * numbers. Admin-only.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const sb = getSupabaseAdmin() as unknown as SupabaseClient;
    const { data: rows } = await sb
      .from("pending_registrations")
      .select(
        "email, captured_at, email1_sent_at, email2_sent_at, email3_sent_at, resumed_at, purchased_at, recovered_via_email, stop_reason",
      )
      .order("captured_at", { ascending: false })
      .limit(2000);

    const weekOf = (iso: string) => {
      const d = new Date(iso);
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return monday.toISOString().slice(0, 10);
    };
    type WeekRow = {
      abandons: number; sent1: number; sent2: number; sent3: number;
      resumed: number; purchased: number; unsubscribed: number;
    };
    const weeks = new Map<string, WeekRow>();
    for (const r of rows ?? []) {
      const w = weekOf(r.captured_at);
      if (!weeks.has(w)) {
        weeks.set(w, { abandons: 0, sent1: 0, sent2: 0, sent3: 0, resumed: 0, purchased: 0, unsubscribed: 0 });
      }
      const e = weeks.get(w)!;
      e.abandons += 1;
      if (r.email1_sent_at) e.sent1 += 1;
      if (r.email2_sent_at) e.sent2 += 1;
      if (r.email3_sent_at) e.sent3 += 1;
      if (r.resumed_at) e.resumed += 1;
      if (r.purchased_at) e.purchased += 1;
      if (r.stop_reason === "unsubscribed") e.unsubscribed += 1;
    }
    return NextResponse.json({
      weeks: [...weeks.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([week, v]) => ({ week, ...v })),
      recoveredByEmail: {
        email1: (rows ?? []).filter((r) => r.recovered_via_email === 1).length,
        email2: (rows ?? []).filter((r) => r.recovered_via_email === 2).length,
        email3: (rows ?? []).filter((r) => r.recovered_via_email === 3).length,
      },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/abandons" });
  }
}
