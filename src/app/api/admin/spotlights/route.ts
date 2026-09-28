import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError, apiError } from "@/lib/api/errorResponse";
import type { SpotlightKind, ProfileSpotlightsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin CRUD for profile spotlights ("What's New" on expert/partner
 * profiles). Publishing a spotlight also drops a nudge into the network
 * feed (once), attributed to that expert or partner.
 */

const KINDS: SpotlightKind[] = ["update", "event", "news", "feature"];
type SB = ReturnType<typeof getSupabaseAdmin>;

function kindLabel(k: SpotlightKind): string {
  return k === "news" ? "news" : k; // "update" | "event" | "feature" | "news"
}

/** Insert the feed post for a just-published spotlight (idempotent per row). */
async function postSpotlightToFeed(
  sb: SB,
  spot: { id: string; expert_id: string | null; vendor_id: string | null; kind: SpotlightKind; title: string; link_url: string | null; posted_to_feed: boolean },
  ownerName: string,
  adminId: string,
): Promise<void> {
  if (spot.posted_to_feed) return;
  const content = `📣 ${ownerName} just shared a ${kindLabel(spot.kind)}: "${spot.title}". Take a look at their profile.`;
  // expert_posts enforces exactly ONE author — for dual-owner spotlights
  // the expert fronts the feed nudge.
  const { error } = await sb.from("expert_posts").insert({
    expert_id: spot.expert_id,
    vendor_id: spot.expert_id ? null : spot.vendor_id,
    content,
    link_url: spot.link_url,
    status: "published",
    published_at: new Date().toISOString(),
    composed_by_admin_id: adminId,
  });
  if (error) {
    // Surface it — a silent skip here looks like "publish worked but no
    // feed post appeared", which is painful to debug.
    console.error("[spotlights] feed post insert failed", { spotlightId: spot.id, error: error.message });
    return;
  }
  await sb.from("profile_spotlights").update({ posted_to_feed: true }).eq("id", spot.id);
}

async function ownerName(sb: SB, expertId: string | null, vendorId: string | null): Promise<string> {
  if (expertId) {
    const { data } = await sb.from("experts").select("display_name, full_name").eq("id", expertId).maybeSingle();
    return data?.display_name || data?.full_name || "This expert";
  }
  if (vendorId) {
    const { data } = await sb.from("vendors").select("display_name, company_name").eq("id", vendorId).maybeSingle();
    return data?.display_name || data?.company_name || "This partner";
  }
  return "This profile";
}

// ─── GET ──────────────────────────────────────────────────────────────
// ?owners=1 → the picker list of experts + partners.
// otherwise → all spotlights with resolved owner name/kind, newest first.
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const sb = getSupabaseAdmin();
  const url = new URL(req.url);

  try {
    if (url.searchParams.get("owners") === "1") {
      const [{ data: experts }, { data: vendors }] = await Promise.all([
        sb.from("experts").select("id, display_name, full_name, status").not("status", "in", "(archived,suspended)").order("display_name"),
        sb.from("vendors").select("id, company_name, display_name, status").eq("status", "approved").order("company_name"),
      ]);
      return NextResponse.json({
        experts: (experts ?? []).map((e) => ({ id: e.id, name: e.display_name || e.full_name || "(unnamed)" })),
        partners: (vendors ?? []).map((v) => ({ id: v.id, name: v.display_name || v.company_name || "(unnamed)" })),
      });
    }

    const { data: rows, error } = await sb
      .from("profile_spotlights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    const expertIds = Array.from(new Set((rows ?? []).map((r) => r.expert_id).filter(Boolean) as string[]));
    const vendorIds = Array.from(new Set((rows ?? []).map((r) => r.vendor_id).filter(Boolean) as string[]));
    const [{ data: experts }, { data: vendors }] = await Promise.all([
      expertIds.length ? sb.from("experts").select("id, display_name, full_name").in("id", expertIds) : Promise.resolve({ data: [] }),
      vendorIds.length ? sb.from("vendors").select("id, company_name, display_name").in("id", vendorIds) : Promise.resolve({ data: [] }),
    ]);
    const em = new Map((experts ?? []).map((e) => [e.id, e.display_name || e.full_name || "(unnamed)"]));
    const vm = new Map((vendors ?? []).map((v) => [v.id, v.display_name || v.company_name || "(unnamed)"]));

    const spotlights = (rows ?? []).map((r) => ({
      ...r,
      owner: r.expert_id
        ? { kind: "expert" as const, id: r.expert_id, name: em.get(r.expert_id) || "(unnamed)" }
        : { kind: "partner" as const, id: r.vendor_id!, name: vm.get(r.vendor_id!) || "(unnamed)" },
    }));
    return NextResponse.json({ spotlights });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/spotlights" });
  }
}

// ─── POST — create ────────────────────────────────────────────────────
type CreateBody = {
  owner_kind?: "expert" | "partner";
  owner_id?: string;
  /** Optional second owner of the OTHER kind — shows the spotlight on
   *  both the expert and the partner profile (0050). */
  linked_owner_id?: string | null;
  kind?: SpotlightKind;
  title?: string;
  body?: string;
  link_url?: string | null;
  link_label?: string | null;
  image_url?: string | null;
  event_date?: string | null;
  publish?: boolean;
  post_to_feed?: boolean;
};

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/spotlights";
  let b: CreateBody;
  try {
    b = (await req.json()) as CreateBody;
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const kind = (b.kind && KINDS.includes(b.kind) ? b.kind : "update") as SpotlightKind;
  const title = (b.title ?? "").trim();
  const body = (b.body ?? "").trim();
  if (title.length < 3 || title.length > 160) return apiError.badRequest("Title must be 3–160 characters.", route);
  if (body.length < 3 || body.length > 2000) return apiError.badRequest("Body must be 3–2000 characters.", route);
  if (b.owner_kind !== "expert" && b.owner_kind !== "partner") return apiError.badRequest("Pick an expert or partner.", route);
  if (!b.owner_id) return apiError.badRequest("Missing owner.", route);

  const sb = getSupabaseAdmin();
  const publish = !!b.publish;
  const linked = b.linked_owner_id?.trim() || null;
  const insert = {
    expert_id: b.owner_kind === "expert" ? b.owner_id : linked,
    vendor_id: b.owner_kind === "partner" ? b.owner_id : linked,
    kind,
    title,
    body,
    link_url: b.link_url?.trim() || null,
    link_label: b.link_label?.trim() || null,
    image_url: b.image_url?.trim() || null,
    event_date: b.event_date || null,
    is_published: publish,
    published_at: publish ? new Date().toISOString() : null,
    created_by: guard.adminId,
  };

  try {
    const { data: created, error } = await sb.from("profile_spotlights").insert(insert).select("*").single();
    if (error) return serverError(error, { route, extra: { stage: "insert" } });

    if (publish && b.post_to_feed !== false) {
      const name = await ownerName(sb, created.expert_id, created.vendor_id);
      await postSpotlightToFeed(sb, created, name, guard.adminId);
    }
    await sb.from("review_actions").insert({
      target_type: created.expert_id ? "expert" : "vendor",
      target_id: (created.expert_id || created.vendor_id)!,
      action: "spotlight_create",
      note: publish ? "Created + published" : "Created draft",
      admin_id: guard.adminId,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    return serverError(err, { route });
  }
}

// ─── PATCH — publish / unpublish / edit ──────────────────────────────
type PatchBody = CreateBody & { id?: string; action?: "publish" | "unpublish" | "update"; post_to_feed?: boolean };

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "PATCH /api/admin/spotlights";
  let b: PatchBody;
  try {
    b = (await req.json()) as PatchBody;
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }
  if (!b.id || !b.action) return apiError.badRequest("Missing id or action.", route);

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from("profile_spotlights").select("*").eq("id", b.id).maybeSingle();
  if (!existing) return apiError.notFound(route);

  try {
    if (b.action === "unpublish") {
      await sb.from("profile_spotlights").update({ is_published: false }).eq("id", b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "publish") {
      await sb
        .from("profile_spotlights")
        .update({ is_published: true, published_at: existing.published_at ?? new Date().toISOString() })
        .eq("id", b.id);
      if (b.post_to_feed !== false) {
        const name = await ownerName(sb, existing.expert_id, existing.vendor_id);
        await postSpotlightToFeed(sb, existing, name, guard.adminId);
      }
      return NextResponse.json({ ok: true });
    }

    // update — edit fields (kind/title/body/link/image/event_date)
    const patch: Partial<
      Pick<ProfileSpotlightsRow, "kind" | "title" | "body" | "link_url" | "link_label" | "image_url" | "event_date">
    > = {};
    if (b.kind && KINDS.includes(b.kind)) patch.kind = b.kind;
    if (typeof b.title === "string") {
      const t = b.title.trim();
      if (t.length < 3 || t.length > 160) return apiError.badRequest("Title must be 3–160 characters.", route);
      patch.title = t;
    }
    if (typeof b.body === "string") {
      const bd = b.body.trim();
      if (bd.length < 3 || bd.length > 2000) return apiError.badRequest("Body must be 3–2000 characters.", route);
      patch.body = bd;
    }
    if (b.link_url !== undefined) patch.link_url = b.link_url?.trim() || null;
    if (b.link_label !== undefined) patch.link_label = b.link_label?.trim() || null;
    if (b.image_url !== undefined) patch.image_url = b.image_url?.trim() || null;
    if (b.event_date !== undefined) patch.event_date = b.event_date || null;
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
    await sb.from("profile_spotlights").update(patch).eq("id", b.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError.badRequest("Missing id.", "DELETE /api/admin/spotlights");
  try {
    await getSupabaseAdmin().from("profile_spotlights").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "DELETE /api/admin/spotlights" });
  }
}
