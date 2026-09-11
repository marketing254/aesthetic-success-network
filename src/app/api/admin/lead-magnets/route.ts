import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT =
  "id, magnet_slug, email, full_name, practice_name, source, utm, ip_hash, user_agent, contacted_at, created_at";

/** GET /api/admin/lead-magnets — every captured lead, newest first. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("lead_magnet_leads")
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
 * PATCH /api/admin/lead-magnets
 * Body: { id, action: "mark_contacted" | "unmark_contacted" }
 *
 * No public capture form exists yet (see migration 0019) — this is
 * purely a triage toggle for whenever leads start showing up here.
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
  const action = asString(body.action);
  const allowed = ["mark_contacted", "unmark_contacted"];
  if (!id || !allowed.includes(action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("lead_magnet_leads")
      .update({ contacted_at: action === "mark_contacted" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "lead_magnet_lead", id, action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
