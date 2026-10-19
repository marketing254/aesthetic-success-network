import { NextResponse } from "next/server";
import { requireExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { protocolForExpert } from "@/lib/protocols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/expert/protocols/[slug] - one of the signed-in expert's own Protocols with its files. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;
  try {
    const { slug } = await params;
    const hit = await protocolForExpert(guard.expertId, slug);
    if (!hit) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(hit);
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/protocols/[slug]" });
  }
}
