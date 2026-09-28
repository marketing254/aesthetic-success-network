import "server-only";
import { NextResponse } from "next/server";

/**
 * ASN has no summit yet. Every /api/events/summit/* handler calls this as
 * its first statement and returns the 404 unless SUMMIT_ENABLED === "true".
 * The response is the same generic 404 body the middleware uses for the
 * job-board kill switch, so a probe cannot tell a disabled feature from a
 * missing route.
 */
export function summitEnabled(): boolean {
  return process.env.SUMMIT_ENABLED === "true";
}

export function summitEnabledOr404(): NextResponse | null {
  if (summitEnabled()) return null;
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
