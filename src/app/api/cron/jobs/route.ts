import { NextResponse } from "next/server";
import { processJobExpiry } from "@/lib/jobs/expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/cron/jobs
 *
 * Daily Vercel Cron (vercel.json). Sends the day-25 renewal reminders
 * and expires anything past its 30 days.
 *
 * Auth follows /api/cron/onboarding exactly: Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically when the env var
 * exists. In production the secret is REQUIRED; locally (no secret set)
 * the route runs open so it can be triggered by hand for testing.
 *
 * Idempotent — see lib/jobs/expiry.ts. Running it twice in a day sends
 * nothing twice and expires nothing twice.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 503 });
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const result = await processJobExpiry();
  return NextResponse.json({ ok: true, ...result });
}
