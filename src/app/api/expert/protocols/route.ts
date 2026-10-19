import { NextResponse } from "next/server";
import { requireExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { protocolsForExpert } from "@/lib/protocols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/expert/protocols - the signed-in expert's own Protocols, approved or not. */
export async function GET() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ protocols: await protocolsForExpert(guard.expertId) });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/protocols" });
  }
}
