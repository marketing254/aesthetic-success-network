import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { resolveResumeToken } from "@/lib/abandoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ads/resume?token=… — prefill for a resume link from the
 * abandoned-registration emails. Returns the fields the person filled
 * plus the STATE of their one-month-free code (never the code itself —
 * the code is applied server-side at checkout via the same token).
 * Invalid/expired tokens return the same empty shape as unknown ones.
 */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(`ads-resume:${clientIp(req)}`);
  if (!rl.allowed) return NextResponse.json({ ok: false });

  const tokenValue = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const ctx = await resolveResumeToken(tokenValue);
    if (!ctx) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true, ...ctx });
  } catch (err) {
    console.error("[ads:resume] failed:", err);
    return NextResponse.json({ ok: false });
  }
}
