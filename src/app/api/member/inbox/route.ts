import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/member/inbox  → the member's Beacon inquiries + packs, newest
 *                            first, plus an unread count (member_seen_at null).
 * PATCH /api/member/inbox → { action: "mark_seen" } marks them all seen.
 */
export async function GET() {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("member_inquiries")
      .select("id, question, status, pdf_url, pdf_sent_at, member_seen_at, created_at")
      .eq("member_id", guard.memberId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = data ?? [];
    const unread = rows.filter((r) => r.member_seen_at === null).length;
    return NextResponse.json({ rows, unread });
  } catch (err) {
    return serverError(err, { route: "GET /api/member/inbox" });
  }
}

export async function PATCH(req: Request) {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "mark_seen") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("member_inquiries")
      .update({ member_seen_at: new Date().toISOString() })
      .eq("member_id", guard.memberId)
      .is("member_seen_at", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/member/inbox" });
  }
}
