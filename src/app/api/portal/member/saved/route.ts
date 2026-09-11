import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { toggleSavedItem } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/portal/member/saved — toggle a bookmark on an expert or partner. */
export async function POST(req: Request) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;
  const itemType = b.itemType === "expert" || b.itemType === "partner" ? b.itemType : null;
  const itemId = typeof b.itemId === "string" ? b.itemId : "";
  if (!itemType || !itemId) {
    return NextResponse.json({ error: "itemType and itemId are required." }, { status: 400 });
  }

  try {
    const result = await toggleSavedItem(guard.rowId, itemType, itemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
