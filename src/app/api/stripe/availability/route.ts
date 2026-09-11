import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FOUNDING_MEMBER_CAP, EARLY_MEMBER_CAP } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public — decides which tier the plan-picker offers. Fails open (200
 * with conservative defaults) so a DB hiccup never blocks checkout.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ count: founding }, { count: early }] = await Promise.all([
      supabase.from("members").select("id", { count: "exact", head: true }).eq("founding_member_locked", true),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("early_member_locked", true),
    ]);

    const foundingTaken = founding ?? 0;
    const earlyTaken = early ?? 0;

    return NextResponse.json({
      founding: {
        cap: FOUNDING_MEMBER_CAP,
        taken: foundingTaken,
        remaining: Math.max(0, FOUNDING_MEMBER_CAP - foundingTaken),
        isOpen: foundingTaken < FOUNDING_MEMBER_CAP,
      },
      early: {
        cap: EARLY_MEMBER_CAP,
        taken: earlyTaken,
        remaining: Math.max(0, EARLY_MEMBER_CAP - earlyTaken),
        isOpen: earlyTaken < EARLY_MEMBER_CAP,
      },
    });
  } catch (err) {
    console.error("[stripe:availability] failed, failing open:", err);
    return NextResponse.json({
      founding: { cap: FOUNDING_MEMBER_CAP, taken: 0, remaining: FOUNDING_MEMBER_CAP, isOpen: true },
      early: { cap: EARLY_MEMBER_CAP, taken: 0, remaining: EARLY_MEMBER_CAP, isOpen: true },
    });
  }
}
