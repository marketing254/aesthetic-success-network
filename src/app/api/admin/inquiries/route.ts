import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INQUIRY_COLUMNS =
  "id, expert_kit_id, member_id, name, email, question, status, admin_note, resolved_by, resolved_at, created_at, updated_at";

/**
 * GET — list resource inquiries with the asking kit's title merged in.
 *
 * There is no public "ask a question" UI in ASN yet (the member portal
 * that would post here is Phase 3 scope — see migration 0021), so this
 * reads empty until that ships. expert_kits is a separate table, so the
 * kit title is resolved with a second query + in-memory join rather than
 * a DB view — not worth the extra migration for this volume of rows.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("resource_inquiries")
      .select(INQUIRY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = data ?? [];
    const kitIds = Array.from(
      new Set(rows.map((r) => r.expert_kit_id).filter((id): id is string => Boolean(id))),
    );

    let kitTitles: Record<string, string> = {};
    if (kitIds.length > 0) {
      const { data: kits, error: kitsError } = await supabase
        .from("expert_kits")
        .select("id, title")
        .in("id", kitIds);
      if (kitsError) throw kitsError;
      kitTitles = Object.fromEntries((kits ?? []).map((k) => [k.id as string, k.title as string]));
    }

    const merged = rows.map((r) => ({
      ...r,
      kit_title: r.expert_kit_id ? (kitTitles[r.expert_kit_id as string] ?? null) : null,
    }));

    return NextResponse.json({ rows: merged });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH { id, status: "open"|"answered"|"closed", adminNote? } */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; status?: string; adminNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed = ["open", "answered", "closed"];
  if (!body.id || !body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Read the previous state so resolved_by/resolved_at only get set the
    // FIRST time an inquiry moves out of "open" — re-saving an already
    // resolved inquiry (e.g. editing the note) doesn't rewrite them.
    const { data: before } = await supabase
      .from("resource_inquiries")
      .select("status")
      .eq("id", body.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: body.status,
      updated_at: now,
    };
    if (typeof body.adminNote === "string") {
      update.admin_note = asString(body.adminNote) || null;
    }
    if (
      (body.status === "answered" || body.status === "closed") &&
      before &&
      before.status === "open"
    ) {
      update.resolved_by = guard.adminId;
      update.resolved_at = now;
    }

    const { error } = await supabase.from("resource_inquiries").update(update).eq("id", body.id);
    if (error) throw error;

    await writeAudit(guard, "resource_inquiry", body.id, `status:${body.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
