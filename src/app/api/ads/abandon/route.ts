import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { captureAbandon } from "@/lib/abandoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ads/abandon — partial-registration capture from /start.
 *
 * Fired by the form when the work-email field completes (and again on
 * Continue, with richer fields). Always answers 204 — the browser gets
 * no signal about whether a sequence exists, and a failure here must
 * never affect the visitor's flow.
 */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(`ads-abandon:${clientIp(req)}`);
  if (!rl.allowed) return new NextResponse(null, { status: 204 });

  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
    const email = s(b.email, 254);
    if (!email) return new NextResponse(null, { status: 204 });
    const rawUtm = (b.utm && typeof b.utm === "object" ? b.utm : null) as Record<string, unknown> | null;
    const utm: Record<string, string> = {};
    if (rawUtm) {
      for (const k of ["source", "medium", "campaign", "content", "term"]) {
        const v = s(rawUtm[k], 200);
        if (v) utm[k] = v;
      }
    }
    await captureAbandon({
      email,
      firstName: s(b.firstName, 80),
      lastName: s(b.lastName, 80),
      practiceName: s(b.practiceName, 120),
      role: s(b.role, 60),
      plan: s(b.plan, 40),
      utm: Object.keys(utm).length ? utm : null,
    });
  } catch (err) {
    console.error("[ads:abandon] capture failed:", err);
  }
  return new NextResponse(null, { status: 204 });
}
