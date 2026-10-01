import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { clientIp, hashIp } from "@/lib/security/hashIp";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/invite/[code]/accept
 *
 * Acceptance for EXISTING-PROFILE invite links (created from the admin
 * dropdown, or auto-created when the admin adds a profile). Stamps the
 * STANDARD v1 agreement acceptance onto the already-existing experts or
 * vendors row, marks the invite accepted, and tells the client where to
 * send them next (portal login — where the billing gate collects their
 * card before the portal unlocks).
 *
 * Public + code-gated: the unguessable code is the credential.
 * New-prospect invites (no FK) don't use this route — they submit the
 * standard application form instead.
 */

const AGREEMENT_VERSION = "v1";



export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const route = "POST /api/invite/[code]/accept";
  if (!code) return apiError.badRequest("Missing code.", route);

  // The code is the only credential: cap guesses per IP before the lookup.
  const rl = await checkRateLimit(`invite-accept:${clientIp(_req)}`, { maxHits: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return apiError.rateLimited(route);

  try {
    const sb = getSupabaseAdmin();
    const { data: invite } = await sb
      .from("invite_links")
      .select("id, kind, status, expires_at, expert_id, vendor_id")
      .eq("code", code)
      .maybeSingle();

    if (!invite) return apiError.notFound(route);
    if (invite.status === "revoked") return apiError.badRequest("This invite has been revoked.", route);
    if (invite.status === "accepted") return NextResponse.json({ ok: true, alreadyAccepted: true, role: invite.kind });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return apiError.badRequest("This invite has expired. Ask the team for a fresh link.", route);
    }
    const profileId = invite.kind === "expert" ? invite.expert_id : invite.vendor_id;
    if (!profileId) return apiError.badRequest("This invite uses the application form instead.", route);

    const signedAt = new Date().toISOString();
    const stamp = {
      agreement_signed_at: signedAt,
      agreement_version: AGREEMENT_VERSION,
      agreement_ip_hash: hashIp(clientIp(_req)),
      agreement_user_agent: _req.headers.get("user-agent") ?? null,
    };

    const table = invite.kind === "expert" ? "experts" : "vendors";
    const { error: updErr } = await sb.from(table).update(stamp as never).eq("id", profileId);
    if (updErr) return serverError(updErr, { route, extra: { stage: "stamp" } });

    await sb
      .from("invite_links")
      .update({ status: "accepted", accepted_at: signedAt })
      .eq("id", invite.id);

    return NextResponse.json({ ok: true, role: invite.kind });
  } catch (err) {
    return serverError(err, { route });
  }
}
