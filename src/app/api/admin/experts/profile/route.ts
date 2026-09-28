import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "kit-thumbnails";
const MAX_HEADSHOT_BYTES = 8 * 1024 * 1024;

/**
 * Admin — expert public-profile editor (the fields the PUBLISH GATE needs:
 * an expert only appears in /experts once they have a headshot AND a bio).
 *
 *   GET  ?id=<expert_id> → current profile fields for prefill.
 *   POST multipart/form-data:
 *     expert_id     required
 *     headshot      image file (optional) → kit-thumbnails/profiles/…,
 *                   new filename each time so stale caches never linger
 *     display_name, specialty, bio, website, booking_link  (optional text)
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError.badRequest("Missing id.");
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("experts")
      .select("id, display_name, full_name, specialty, bio, website, booking_link, headshot_url")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError.notFound();
    return NextResponse.json({ expert: data });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/experts/profile" });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/experts/profile";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest("Expected multipart form data.", route);
  }

  const expertId = (form.get("expert_id") as string | null)?.trim();
  if (!expertId) return apiError.badRequest("expert_id is required.", route);

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb.from("experts").select("id").eq("id", expertId).maybeSingle();
  if (!expert) return apiError.notFound(route);

  const patch: Record<string, string> = {};
  for (const key of ["display_name", "specialty", "bio", "website", "booking_link"] as const) {
    const v = form.get(key);
    if (typeof v === "string" && v.trim() !== "") patch[key] = v.trim();
  }

  const file = form.get("headshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_HEADSHOT_BYTES) return apiError.validation("Headshot too large (max 8 MB).", route);
    if (!file.type.startsWith("image/")) return apiError.validation("Headshot must be an image.", route);
    const ext = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? "jpg";
    const storagePath = `profiles/${expertId}-${Date.now()}.${ext}`;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: file.type, cacheControl: "86400" });
      if (upErr) throw upErr;
      patch.headshot_url = sb.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    } catch (err) {
      return serverError(err, { route, extra: { stage: "headshot_upload" } });
    }
  }

  if (Object.keys(patch).length === 0) {
    return apiError.badRequest("Nothing to update. Add a field or a headshot.", route);
  }

  try {
    const { error } = await sb.from("experts").update(patch as never).eq("id", expertId);
    if (error) throw error;
    const { data: updated } = await sb
      .from("experts")
      .select("id, headshot_url, bio")
      .eq("id", expertId)
      .single();
    // The publish gate needs BOTH — tell the admin where they stand.
    const publishReady = !!updated?.headshot_url && !!updated?.bio;
    return NextResponse.json({ ok: true, headshot_url: updated?.headshot_url ?? null, publishReady });
  } catch (err) {
    return serverError(err, { route, extra: { stage: "experts_update" } });
  }
}
