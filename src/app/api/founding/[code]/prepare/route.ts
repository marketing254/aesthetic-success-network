import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/founding/[code]/prepare — PUBLIC. Re-validates a founding
 * invite right before the accept form is shown (catches a second tab,
 * a since-expired link, or an already-accepted invite without a full
 * page reload). Also flips status sent -> viewed on first check.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { data: invite } = await supabase
      .from("founding_member_invites")
      .select("id, full_name, email, practice_name, status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ ok: false, error: "This invite link isn't valid." }, { status: 404 });
    }
    if (invite.status === "accepted") {
      return NextResponse.json(
        { ok: false, error: "This invite has already been accepted.", status: "accepted" },
        { status: 409 },
      );
    }
    if (invite.status === "revoked" || new Date(invite.expires_at as string) < new Date()) {
      return NextResponse.json(
        { ok: false, error: "This invite has expired or been revoked.", status: "expired" },
        { status: 410 },
      );
    }

    if (invite.status === "sent") {
      await supabase
        .from("founding_member_invites")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", invite.id);
    }

    return NextResponse.json({
      ok: true,
      fullName: invite.full_name,
      email: invite.email,
      practiceName: invite.practice_name,
    });
  } catch (err) {
    console.error("[founding:prepare] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not load your invite right now." }, { status: 500 });
  }
}
