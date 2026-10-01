import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { EARLY_MEMBER_CAP, FOUNDING_MEMBER_CAP } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stripe/availability
 *
 * Public — used by the SubscribeCard and the /pricing page to decide
 * which tiers to render. Caps are LIFETIME (cancellations don't free
 * a seat) and tracked by the {tier}_member_locked booleans on members.
 *
 * Response shape:
 *   {
 *     founding: { cap, taken, remaining, isOpen },
 *     early:    { cap, taken, remaining, isOpen },
 *   }
 */
type TierStat = { cap: number; taken: number; remaining: number; isOpen: boolean };

export async function GET() {
  try {
    const sb = getSupabaseAdmin();

    const [foundingRes, earlyRes] = await Promise.all([
      sb
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("founding_member_locked", true),
      sb
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("early_member_locked", true),
    ]);

    if (foundingRes.error) throw foundingRes.error;
    if (earlyRes.error) throw earlyRes.error;

    const founding = makeStat(FOUNDING_MEMBER_CAP, foundingRes.count ?? 0);
    const early = makeStat(EARLY_MEMBER_CAP, earlyRes.count ?? 0);

    return NextResponse.json({ founding, early });
  } catch (err) {
    // Fail open so a transient DB hiccup doesn't lock everyone out of
    // checkout. The hard cap is still enforced server-side in /checkout.
    console.error("[api:error] GET /api/stripe/availability (fail-open)", err);
    return NextResponse.json(
      {
        founding: makeStat(FOUNDING_MEMBER_CAP, 0),
        early: makeStat(EARLY_MEMBER_CAP, 0),
        degraded: true,
      },
      { status: 200 },
    );
  }
}

function makeStat(cap: number, taken: number): TierStat {
  const remaining = Math.max(0, cap - taken);
  return { cap, taken, remaining, isOpen: remaining > 0 };
}
