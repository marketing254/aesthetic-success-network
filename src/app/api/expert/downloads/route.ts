import { NextResponse } from "next/server";
import { requireExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { providerAssets } from "@/lib/protocols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/expert/downloads - the expert's own social packs and share kits (never members). */
export async function GET() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ groups: await providerAssets({ expertId: guard.expertId }) });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/downloads" });
  }
}
