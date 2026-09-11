import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { markKitProgress } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/portal/member/resources/[id]/progress — { completed: boolean } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { completed?: boolean };

  try {
    await markKitProgress(guard.rowId, id, Boolean(body.completed));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
