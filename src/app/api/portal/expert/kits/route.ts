import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { resolvePortalRoles } from "@/lib/auth/portal";
import { KIT_CATEGORIES } from "@/lib/portal/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS = ["draft", "published", "archived"] as const;

type KitInput = {
  title: string;
  category: string;
  summary: string;
  content: string;
  resourceUrl: string;
  status: string;
};

function readInput(b: Record<string, unknown>): KitInput {
  return {
    title: asString(b.title),
    category: asString(b.category),
    summary: asString(b.summary),
    content: asString(b.content),
    resourceUrl: asString(b.resourceUrl),
    status: asString(b.status) || "draft",
  };
}

function validate(input: KitInput): string | null {
  if (input.title.length < 4 || input.title.length > 160) return "Give the kit a title (4–160 characters).";
  if (input.summary.length > 600) return "Keep the summary under 600 characters.";
  if (input.content.length > 40000) return "That kit body is too long.";
  if (input.resourceUrl && !/^https?:\/\//i.test(input.resourceUrl))
    return "The resource link must start with http:// or https://";
  if (input.category && !(KIT_CATEGORIES as readonly string[]).includes(input.category))
    return "Pick a category from the list.";
  if (!(VALID_STATUS as readonly string[]).includes(input.status)) return "Invalid status.";
  if (input.status === "published" && input.content.trim().length < 60)
    return "Add at least 60 characters of content before publishing.";
  return null;
}

/** GET /api/portal/expert/kits — the expert's own kits. */
export async function GET() {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_kits")
      .select("id, title, category, summary, content, resource_url, status, published_at, created_at, updated_at")
      .eq("expert_id", guard.rowId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ kits: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** POST /api/portal/expert/kits — create a kit (draft or published). */
export async function POST(req: Request) {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input = readInput((json ?? {}) as Record<string, unknown>);
  const invalid = validate(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const identity = await resolvePortalRoles(guard.email);
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("expert_kits")
      .insert({
        expert_id: guard.rowId,
        expert_name: identity.expert?.fullName || guard.email,
        title: input.title,
        category: input.category || null,
        summary: input.summary || null,
        content: input.content || null,
        resource_url: input.resourceUrl || null,
        status: input.status,
        published_at: input.status === "published" ? now : null,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[portal:expert:kits] insert failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH /api/portal/expert/kits — update one of the expert's own kits. */
export async function PATCH(req: Request) {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;
  const id = asString(b.id);
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const input = readInput(b);
  const invalid = validate(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("expert_kits")
      .select("id, published_at")
      .eq("id", id)
      .eq("expert_id", guard.rowId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Kit not found." }, { status: 404 });

    const now = new Date().toISOString();
    // First publish stamps published_at; re-publishing keeps the original.
    const publishedAt =
      input.status === "published" ? (existing.published_at as string | null) ?? now : null;

    const { error } = await supabase
      .from("expert_kits")
      .update({
        title: input.title,
        category: input.category || null,
        summary: input.summary || null,
        content: input.content || null,
        resource_url: input.resourceUrl || null,
        status: input.status,
        published_at: publishedAt,
        updated_at: now,
      })
      .eq("id", id)
      .eq("expert_id", guard.rowId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal:expert:kits] update failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
