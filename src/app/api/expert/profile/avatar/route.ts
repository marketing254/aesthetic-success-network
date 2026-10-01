import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { AVATAR_MAX_BYTES, AVATAR_REJECT_MESSAGE, resolveAvatarUpload } from "@/lib/api/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_BUCKET = "avatars";

/**
 * PATCH /api/expert/profile/avatar
 *
 * multipart/form-data:
 *   avatar     image (optional)
 *   display_name string (optional)
 *
 * Updates whichever fields are present. avatar_url separate from
 * headshot_url (the public-facing big headshot stays untouched).
 */
export async function PATCH(req: Request) {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest();
  }

  const displayName = (form.get("display_name") as string | null)?.trim();
  const file = form.get("avatar") ?? form.get("headshot");
  // target=headshot stores the public-facing headshot (experts.headshot_url)
  // instead of the small portal avatar. Same size/type rules, same bucket.
  const target = form.get("target") === "headshot" ? "headshot_url" : "avatar_url";
  const patch: Record<string, string | null> = {};
  if (typeof displayName === "string") patch.display_name = displayName;

  const admin = getSupabaseAdmin();

  if (file instanceof File && file.size > 0) {
    if (file.size > AVATAR_MAX_BYTES) return apiError.validation("Avatar too large (max 5 MB).");
    const upload = resolveAvatarUpload(file);
    if (!upload) return apiError.validation(AVATAR_REJECT_MESSAGE);
    const storagePath = `experts/${guard.expertId}/${randomUUID()}.${upload.ext}`;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, buf, { contentType: upload.contentType, upsert: false });
      if (upErr) throw upErr;
      const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
      patch[target] = data?.publicUrl ?? null;
    } catch (err) {
      return serverError(err, { route: "PATCH /api/expert/profile/avatar" });
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  try {
    const { error } = await admin.from("experts").update(patch as never).eq("id", guard.expertId);
    if (error) throw error;
    return NextResponse.json({ ok: true, url: patch[target] ?? null });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/expert/profile/avatar" });
  }
}
