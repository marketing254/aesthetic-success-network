import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidVendor } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { AVATAR_MAX_BYTES, AVATAR_REJECT_MESSAGE, resolveAvatarUpload } from "@/lib/api/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_BUCKET = "avatars";

/**
 * PATCH /api/vendor/profile/avatar
 *
 * multipart/form-data:
 *   avatar       image (optional)
 *   display_name string (optional)
 *
 * Vendor's contact avatar — separate from logo_url (the company logo on
 * the partner directory).
 */
export async function PATCH(req: Request) {
  const guard = await requirePaidVendor();
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest();
  }

  const displayName = (form.get("display_name") as string | null)?.trim();
  const file = form.get("avatar");
  const patch: Record<string, string | null> = {};
  if (typeof displayName === "string") patch.display_name = displayName;

  const admin = getSupabaseAdmin();

  if (file instanceof File && file.size > 0) {
    if (file.size > AVATAR_MAX_BYTES) return apiError.validation("Avatar too large (max 5 MB).");
    const upload = resolveAvatarUpload(file);
    if (!upload) return apiError.validation(AVATAR_REJECT_MESSAGE);
    const storagePath = `vendors/${guard.vendorId}/${randomUUID()}.${upload.ext}`;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, buf, { contentType: upload.contentType, upsert: false });
      if (upErr) throw upErr;
      const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
      patch.avatar_url = data?.publicUrl ?? null;
    } catch (err) {
      return serverError(err, { route: "PATCH /api/vendor/profile/avatar" });
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  try {
    const { error } = await admin.from("vendors").update(patch as never).eq("id", guard.vendorId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/vendor/profile/avatar" });
  }
}
