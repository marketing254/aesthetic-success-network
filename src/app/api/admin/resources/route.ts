import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESOURCE_COLUMNS =
  "id, expert_id, expert_name, title, category, summary, content, resource_url, status, published_at, created_at, updated_at";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_kits")
      .select(RESOURCE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

const STATUSES = ["draft", "published", "archived"] as const;

/**
 * POST — create an expert kit.
 * expert_name is denormalised from expert_applications at insert time so
 * member-facing reads (src/app/resources) never need to join.
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
  const expertId = asString(body.expertId);
  const category = asString(body.category);
  const summary = asString(body.summary);
  const content = asString(body.content);
  const resourceUrl = asString(body.resourceUrl);
  const statusRaw = asString(body.status) || "draft";
  const status = STATUSES.includes(statusRaw as (typeof STATUSES)[number]) ? statusRaw : "draft";

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!expertId) {
    return NextResponse.json({ error: "An owning expert is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: expert, error: expertError } = await supabase
      .from("expert_applications")
      .select("id, full_name, company")
      .eq("id", expertId)
      .maybeSingle();
    if (expertError) throw expertError;
    if (!expert) {
      return NextResponse.json({ error: "That expert could not be found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("expert_kits")
      .insert({
        expert_id: expertId,
        expert_name: expert.full_name as string,
        title,
        category: category || null,
        summary: summary || null,
        content: content || null,
        resource_url: resourceUrl || null,
        status,
        published_at: status === "published" ? now : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "expert_kit", inserted.id as string, "create");
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
