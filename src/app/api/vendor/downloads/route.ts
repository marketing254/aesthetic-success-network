import { NextResponse } from "next/server";
import { requireVendor } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { providerAssets } from "@/lib/protocols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/vendor/downloads - the company's own files (kit overview, launch pack); never members. */
export async function GET() {
  const guard = await requireVendor();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ groups: await providerAssets({ vendorId: guard.vendorId }) });
  } catch (err) {
    return serverError(err, { route: "GET /api/vendor/downloads" });
  }
}
