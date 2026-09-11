import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT =
  "id, expert_application_id, partner_application_id, kind, title, body, link_url, link_label, image_url, event_date, is_published, created_by, created_at, updated_at, published_at";

/**
 * GET /api/admin/spotlights — every spotlight, plus the approved
 * experts/partners the create form needs for its owner picker.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const [spotlights, experts, partners] = await Promise.all([
      supabase.from("profile_spotlights").select(SELECT).order("created_at", { ascending: false }).limit(500),
      supabase
        .from("expert_applications")
        .select("id, full_name, company")
        .eq("status", "approved")
        .order("full_name", { ascending: true }),
      supabase
        .from("partner_applications")
        .select("id, company_name, contact_name")
        .eq("status", "approved")
        .order("company_name", { ascending: true }),
    ]);
    if (spotlights.error) throw spotlights.error;
    if (experts.error) throw experts.error;
    if (partners.error) throw partners.error;

    return NextResponse.json({
      rows: spotlights.data ?? [],
      experts: experts.data ?? [],
      partners: partners.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/admin/spotlights
 * Body: { ownerType: "expert" | "partner", ownerId, kind, title, body,
 *         linkUrl?, linkLabel?, imageUrl?, eventDate? }
 *
 * Always inserts as a draft (is_published: false) — there's no public
 * rendering surface wired up yet (see migration 0020), so publishing
 * here only flips a flag for whenever that surface ships.
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

  const ownerType = asString(body.ownerType);
  const ownerId = asString(body.ownerId);
  const kind = asString(body.kind) || "update";
  const title = asString(body.title);
  const bodyText = asString(body.body);
  const linkUrl = asString(body.linkUrl);
  const linkLabel = asString(body.linkLabel);
  const imageUrl = asString(body.imageUrl);
  const eventDate = asString(body.eventDate);

  if (ownerType !== "expert" && ownerType !== "partner") {
    return NextResponse.json({ error: "ownerType must be 'expert' or 'partner'." }, { status: 400 });
  }
  if (!ownerId) {
    return NextResponse.json({ error: "ownerId is required." }, { status: 400 });
  }
  if (!["update", "event", "news", "feature"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  }
  if (title.length < 3 || title.length > 160) {
    return NextResponse.json({ error: "Title must be 3-160 characters." }, { status: 400 });
  }
  if (bodyText.length < 3 || bodyText.length > 2000) {
    return NextResponse.json({ error: "Body must be 3-2000 characters." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("profile_spotlights")
      .insert({
        expert_application_id: ownerType === "expert" ? ownerId : null,
        partner_application_id: ownerType === "partner" ? ownerId : null,
        kind,
        title,
        body: bodyText,
        link_url: linkUrl || null,
        link_label: linkLabel || null,
        image_url: imageUrl || null,
        event_date: eventDate || null,
        is_published: false,
        created_by: guard.adminId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "profile_spotlight", inserted.id as string, "create");
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH { id, action: "publish" | "unpublish" } */
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
  const allowed = ["publish", "unpublish"];
  if (!id || !allowed.includes(action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const patch =
      action === "publish"
        ? { is_published: true, published_at: now, updated_at: now }
        : { is_published: false, published_at: null, updated_at: now };

    const { error } = await supabase.from("profile_spotlights").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "profile_spotlight", id, action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
