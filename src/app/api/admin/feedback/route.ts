import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = "id, member_id, name, email, category, rating, message, status, admin_note, created_at, updated_at";

/** GET /api/admin/feedback — every feedback row, newest first. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("member_feedback")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/feedback
 * Body: { id, status: "new" | "reviewed" | "archived", adminNote? }
 *
 * Feedback arrives from members — there's no admin "create" flow here,
 * only triage: move it through the status pipeline and optionally leave
 * an internal note.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const id = asString(body.id);
  const status = asString(body.status);
  const allowed = ["new", "reviewed", "archived"];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (typeof body.adminNote === "string") {
      patch.admin_note = body.adminNote.trim() || null;
    }

    const { error } = await supabase.from("member_feedback").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "member_feedback", id, `status:${status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
