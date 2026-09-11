import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { getMemberKitFeedback, upsertMemberKitFeedback } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/member/resources/[id]/feedback — the member's existing rating, if any. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  try {
    const feedback = await getMemberKitFeedback(guard.rowId, id);
    return NextResponse.json({ feedback });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** POST /api/portal/member/resources/[id]/feedback — { rating: 1-5, comment? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { rating?: number; comment?: string };
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be a whole number between 1 and 5." }, { status: 400 });
  }
  const comment = (body.comment ?? "").trim().slice(0, 1000) || null;

  try {
    await upsertMemberKitFeedback(guard.rowId, id, rating, comment);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
