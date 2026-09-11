import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANNOUNCEMENT_COLUMNS =
  "id, title, body, audience, status, sent_at, created_by, created_at, updated_at";

const AUDIENCES = ["all", "members", "experts", "partners"] as const;
type Audience = (typeof AUDIENCES)[number];

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST — draft an announcement. { title, body, audience }
 *
 * This never sends anything: TD's Broadcast page dispatches through a
 * Slack integration + member in-app notifications system that don't
 * exist in ASN yet (Phase 3 scope, see migration 0022). This just
 * records the draft so the team can track what's meant to go out.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const title = asString(body.title);
  const text = asString(body.body);
  const audience = asString(body.audience) as Audience;

  if (title.length < 2 || title.length > 160) {
    return NextResponse.json(
      { error: "Title must be between 2 and 160 characters." },
      { status: 400 },
    );
  }
  if (text.length < 1 || text.length > 4000) {
    return NextResponse.json(
      { error: "Body must be between 1 and 4000 characters." },
      { status: 400 },
    );
  }
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: "A valid audience is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("announcements")
      .insert({
        title,
        body: text,
        audience,
        status: "draft",
        created_by: guard.adminId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "announcement", inserted.id as string, "create");
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH { id, action: "mark_sent" | "revert_to_draft" } */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed = ["mark_sent", "revert_to_draft"];
  if (!body.id || !body.action || !allowed.includes(body.action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const update: Record<string, unknown> =
      body.action === "mark_sent"
        ? { status: "sent", sent_at: now, updated_at: now }
        : { status: "draft", sent_at: null, updated_at: now };

    const { error } = await supabase.from("announcements").update(update).eq("id", body.id);
    if (error) throw error;

    await writeAudit(guard, "announcement", body.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
