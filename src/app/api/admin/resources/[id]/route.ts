import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["draft", "published", "archived"] as const;

type Params = { params: Promise<{ id: string }> };

/** PATCH — update any of title/category/summary/content/resource_url/status. */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("expert_kits")
      .select("id, status, published_at")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) {
      const title = asString(body.title);
      if (!title) {
        return NextResponse.json({ error: "Title is required." }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.category !== undefined) patch.category = asString(body.category) || null;
    if (body.summary !== undefined) patch.summary = asString(body.summary) || null;
    if (body.content !== undefined) patch.content = asString(body.content) || null;
    if (body.resourceUrl !== undefined) patch.resource_url = asString(body.resourceUrl) || null;

    if (body.status !== undefined) {
      const status = asString(body.status);
      if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      patch.status = status;
      if (status === "published" && !existing.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("expert_kits").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "expert_kit", id, "update");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("expert_kits").delete().eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "expert_kit", id, "delete");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
