import { NextResponse } from "next/server";
import { resolveCheckoutMember } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/checkout-context
 *
 * Powers the /upgrade plan picker for BOTH a logged-in member (session) and
 * a just-signed-up member who hasn't logged in yet (the asn_checkout cookie
 * from the pay-first flow). Returns just enough to render the picker and to
 * detect when payment has landed. Never exposes anything portal-privileged.
 */
export async function GET() {
  const ctx = await resolveCheckoutMember();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    firstName: ctx.firstName,
    email: ctx.email,
    subscriptionStatus: ctx.subscriptionStatus,
    authed: ctx.authed,
  });
}
