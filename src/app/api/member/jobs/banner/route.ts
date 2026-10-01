import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import {
  BANNER_ACCEPTED_EXT,
  BANNER_ACCEPTED_MIME,
  BANNER_MAX_BYTES,
} from "@/lib/jobs/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/member/jobs/banner
 *
 * Upload a job banner and get back its storage path. Separate from the
 * post itself because the member uploads before the post exists — they
 * are still filling the form — and because a failed image upload should
 * never cost them the text they have already typed.
 *
 * requirePaidMember, same as posting: the banner is part of a job ad,
 * and job ads are the members-only half of the board.
 *
 * The returned value is a PATH, not a URL. The caller stores it on
 * job_posts.banner_path and the public page resolves it through
 * bannerPublicUrl(), so the storage origin can move without a data
 * migration.
 */

export async function POST(req: Request) {
  const route = "POST /api/member/jobs/banner";

  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError.badRequest("Couldn't read the upload.", route);
  }

  const file = form.get("banner");
  if (!(file instanceof File)) {
    return apiError.validation("Choose an image to upload.", route);
  }

  if (file.size <= 0) {
    return apiError.validation("That file looks empty. Try again.", route);
  }
  if (file.size > BANNER_MAX_BYTES) {
    return apiError.validation("Your banner must be under 5MB.", route);
  }

  // Extension AND mime, neither trusted alone. The browser's reported
  // type is client-supplied; the extension is what ends up in the public
  // object path. Requiring both to be on the list keeps a renamed file
  // from being served as an image from our own domain.
  const lower = file.name.toLowerCase();
  const ext = BANNER_ACCEPTED_EXT.find((e) => lower.endsWith(e));
  const mimeOk = (BANNER_ACCEPTED_MIME as readonly string[]).includes(file.type);
  if (!ext || !mimeOk) {
    return apiError.validation("Upload a PNG, JPG or WebP image.", route);
  }

  try {
    const admin = getSupabaseAdmin();

    // Keyed by member so the bucket stays browsable per practice, and by
    // a fresh uuid so re-uploading never overwrites the banner on a post
    // that is already live.
    const path = `${guard.memberId}/${crypto.randomUUID()}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from("job-banners")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (error) {
      return serverError(error, { route, extra: { stage: "banner_upload" } });
    }

    return NextResponse.json({ ok: true, banner_path: path });
  } catch (err) {
    return serverError(err, { route });
  }
}
