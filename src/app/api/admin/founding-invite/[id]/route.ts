import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { errMessage } from "@/lib/errMessage";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/founding-invite/[id]
 * body: { action: "revoke" | "reactivate" }
 *
 * Accepted invites are permanent records (a real member exists behind
 * them) — only sent/viewed/revoked invites can change state here.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "revoke" && body.action !== "reactivate") {
    return NextResponse.json({ error: "action must be revoke or reactivate." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: findErr } = await supabase
      .from("founding_member_invites")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "This invite has already been accepted." }, { status: 400 });
    }

    if (body.action === "revoke") {
      const { error } = await supabase
        .from("founding_member_invites")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } else {
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("founding_member_invites")
        .update({ status: "sent", expires_at: expires, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    }

    await writeAudit(guard, "founding_member_invite", id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("founding_member_invites")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    if (existing.status === "accepted") {
      return NextResponse.json(
        { error: "Accepted invites are kept for the record." },
        { status: 400 },
      );
    }
    const { error } = await supabase.from("founding_member_invites").delete().eq("id", id);
    if (error) throw error;
    await writeAudit(guard, "founding_member_invite", id, "delete");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
