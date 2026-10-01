import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "vendor-logos";
const MAX_LOGO_BYTES = 8 * 1024 * 1024;

/**
 * Admin — partner public-profile editor. A partner only appears in the
 * directories once they are approved + verified AND have a logo AND a
 * description — this is where the team supplies the missing pieces.
 *
 *   GET  ?id=<vendor_id> → current profile fields for prefill.
 *   POST multipart/form-data:
 *     vendor_id      required
 *     logo           image file (optional) → vendor-logos bucket, fresh
 *                    filename each time so stale caches never linger
 *     display_name, category, description, website, calendar_link (text)
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError.badRequest("Missing id.");
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("vendors")
      .select("id, display_name, company_name, category, description, website, calendar_link, logo_url, status, verified")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError.notFound();
    return NextResponse.json({ vendor: data });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/vendors/profile" });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/vendors/profile";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest("Expected multipart form data.", route);
  }

  const vendorId = (form.get("vendor_id") as string | null)?.trim();
  if (!vendorId) return apiError.badRequest("vendor_id is required.", route);

  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb.from("vendors").select("id").eq("id", vendorId).maybeSingle();
  if (!vendor) return apiError.notFound(route);

  const patch: Record<string, string> = {};
  for (const key of ["display_name", "category", "description", "website", "calendar_link"] as const) {
    const v = form.get(key);
    if (typeof v === "string" && v.trim() !== "") patch[key] = v.trim();
  }

  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return apiError.validation("Logo too large (max 8 MB).", route);
    if (!file.type.startsWith("image/")) return apiError.validation("Logo must be an image.", route);
    const ext = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? "png";
    const storagePath = `${vendorId}-${Date.now()}.${ext}`;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: file.type, cacheControl: "86400" });
      if (upErr) throw upErr;
      patch.logo_url = sb.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    } catch (err) {
      return serverError(err, { route, extra: { stage: "logo_upload" } });
    }
  }

  if (Object.keys(patch).length === 0) {
    return apiError.badRequest("Nothing to update. Add a field or a logo.", route);
  }

  try {
    const { error } = await sb.from("vendors").update(patch as never).eq("id", vendorId);
    if (error) throw error;
    const { data: updated } = await sb
      .from("vendors")
      .select("logo_url, description, status, verified")
      .eq("id", vendorId)
      .single();
    const publishReady =
      !!updated?.logo_url && !!updated?.description && updated?.status === "approved" && !!updated?.verified;
    return NextResponse.json({ ok: true, logo_url: updated?.logo_url ?? null, publishReady });
  } catch (err) {
    return serverError(err, { route, extra: { stage: "vendors_update" } });
  }
}
