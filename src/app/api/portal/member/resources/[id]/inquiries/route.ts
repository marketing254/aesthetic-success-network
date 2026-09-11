import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { submitKitInquiry } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/portal/member/resources/[id]/inquiries — ask a question about a kit. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { question?: string };
  const question = (body.question ?? "").trim();
  if (question.length < 1 || question.length > 4000) {
    return NextResponse.json({ error: "Add your question (max 4000 characters)." }, { status: 400 });
  }

  try {
    const result = await submitKitInquiry({
      memberId: guard.rowId,
      expertKitId: id,
      name: guard.email,
      email: guard.email,
      question,
    });
    return NextResponse.json({ ok: true, id: result.id, createdAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
