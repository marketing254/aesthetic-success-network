import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import type { ExpertResourceKind } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "expert-resources";
const MAX_FILE_BYTES = 500 * 1024 * 1024;

/**
 * Upload allow-list: BOTH the extension and the declared MIME type must
 * match one entry. Anything else (HTML, SVG, scripts, archives) is
 * refused before a byte reaches storage. `contentType` written to storage
 * is the allow-listed value, never the client's raw string.
 */
const ALLOWED_UPLOADS: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  mp4: ["video/mp4"],
};

function resolveUpload(file: File): { ext: string; contentType: string } | null {
  const ext = file.name?.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? "";
  const allowed = ALLOWED_UPLOADS[ext];
  if (!allowed) return null;
  const declared = (file.type || "").toLowerCase().split(";")[0].trim();
  if (!allowed.includes(declared)) return null;
  return { ext, contentType: declared };
}

const VALID_KINDS: ReadonlyArray<ExpertResourceKind> = [
  "sop",
  "template",
  "slide_deck",
  "recording",
  "pdf",
  "checklist",
  "worksheet",
  "other",
];

/**
 * GET /api/expert/resources
 *
 * Returns the published member-library resources where this expert is
 * the originating author. The expert no longer uploads directly — the
 * content team publishes on their behalf — so this is a read-only view
 * of what's live (and what's awaiting publish).
 */
export async function GET() {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("resources")
      .select(
        "id, topic_slug, topic_title, title, kind, category, position, is_published, submission_status, created_at, thumbnail_url",
      )
      .eq("originating_expert_id", guard.expertId)
      .order("topic_slug", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ resources: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/resources" });
  }
}

/**
 * POST /api/expert/resources
 *
 * Accepts a multipart/form-data upload:
 *   - file:        the file blob (required)
 *   - title:       string (required)
 *   - description: string (optional)
 *   - kind:        ExpertResourceKind (defaults to 'other')
 *
 * Writes the file to Supabase Storage under "{expert_id}/{resource_id}.ext",
 * then inserts a row in expert_resources with status='pending_review'.
 */
export async function POST(req: Request) {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Max 500 MB; this file is ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
      { status: 413 },
    );
  }

  const upload = resolveUpload(file);
  if (!upload) {
    return NextResponse.json(
      {
        error:
          "That file type isn't accepted. Upload a PDF, Word, Excel or PowerPoint file, a PNG/JPG/WebP image, or an MP4 video.",
      },
      { status: 415 },
    );
  }

  const title = (form.get("title") as string | null)?.trim() ?? "";
  if (title.length < 1 || title.length > 200) {
    return NextResponse.json({ error: "Title is required (1 to 200 chars)." }, { status: 400 });
  }

  const description = (form.get("description") as string | null)?.trim() || null;
  if (description && description.length > 4000) {
    return NextResponse.json({ error: "Description is too long (max 4000 chars)." }, { status: 400 });
  }

  const kindRaw = ((form.get("kind") as string | null) ?? "other").toLowerCase();
  const kind: ExpertResourceKind = (
    VALID_KINDS.includes(kindRaw as ExpertResourceKind) ? kindRaw : "other"
  ) as ExpertResourceKind;

  try {
    const admin = getSupabaseAdmin();

    // 1. Server-derived storage path: the expert's own id + a random uuid
    //    + the allow-listed extension. The client never chooses a path.
    const resourceId = randomUUID();
    const storagePath = `${guard.expertId}/${resourceId}.${upload.ext}`;

    // 2. Upload to storage via service role (bypasses RLS for the write).
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(arrayBuffer), {
        contentType: upload.contentType,
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    // 3. Insert the row.
    const { data: inserted, error: insertErr } = await admin
      .from("expert_resources")
      .insert({
        id: resourceId,
        expert_id: guard.expertId,
        title,
        description,
        kind,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        file_name: file.name ?? null,
        file_size: file.size,
        mime_type: upload.contentType,
        status: "pending_review",
      })
      .select("id, title, status, created_at")
      .single();

    if (insertErr) {
      // Best-effort cleanup of the orphaned file if the row insert failed.
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      throw insertErr;
    }

    return NextResponse.json({ ok: true, resource: inserted });
  } catch (err) {
    return serverError(err, { route: "POST /api/expert/resources" });
  }
}

/**
 * DELETE /api/expert/resources?id=<uuid>
 *
 * Removes one of the signed-in expert's resources (file + row).
 * Approved resources cannot be deleted — they live in the member
 * library and need an admin to archive instead.
 */
export async function DELETE(req: Request) {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error: readErr } = await admin
      .from("expert_resources")
      .select("id, expert_id, status, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }
    if (row.expert_id !== guard.expertId) {
      return NextResponse.json({ error: "Not your resource." }, { status: 403 });
    }
    if (row.status === "approved") {
      return NextResponse.json(
        { error: "Approved resources are in the member library. Contact the team to archive." },
        { status: 409 },
      );
    }

    await admin.storage.from(BUCKET).remove([row.storage_path]).catch(() => {});
    const { error: delErr } = await admin
      .from("expert_resources")
      .delete()
      .eq("id", row.id);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "DELETE /api/expert/resources" });
  }
}
