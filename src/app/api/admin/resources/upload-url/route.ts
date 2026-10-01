import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/resources/upload-url
 *
 * Returns a one-time signed upload URL that the browser can PUT to directly,
 * bypassing the Vercel 4.5MB body limit on our own routes. We never see the
 * file bytes — the browser uploads them straight to Supabase Storage.
 *
 * Body:
 *   {
 *     bucket: "member-resources" | "kit-thumbnails",
 *     path: "<slug>/<filename>"  // path within the bucket
 *   }
 *
 * Response:
 *   {
 *     signedUrl: "...",      // PUT here from the browser
 *     token: "...",          // already embedded in signedUrl, returned for completeness
 *     publicUrl: "..."       // the final public URL once upload completes
 *   }
 */
const ALLOWED_BUCKETS = new Set(["member-resources", "kit-thumbnails"]);
const MAX_PATH_LEN = 512;
// Allow letters, digits, underscore, hyphen, period, and forward slash for
// nested folders. Explicitly rejects backslash, null bytes, and parent-dir
// traversal — the per-character allowlist already covers each individually
// but keeping the explicit checks below makes the intent obvious to future
// readers and tightens defense-in-depth.
const PATH_RE = /^[A-Za-z0-9_./\-]+$/;

function isSafeStoragePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_PATH_LEN) return false;
  if (path.startsWith("/")) return false; // no absolute paths
  if (path.includes("..")) return false; // no parent traversal
  if (path.includes("\\")) return false; // no backslash escape
  if (path.includes("\0")) return false; // no null byte
  if (path.includes("//")) return false; // no empty segments
  if (path.endsWith("/")) return false; // must point at a file
  if (!PATH_RE.test(path)) return false;
  // Reject any individual segment that's `.` or `..` even though the
  // regex above forbids `..` — belt-and-braces in case PATH_RE changes.
  for (const seg of path.split("/")) {
    if (seg === "" || seg === "." || seg === "..") return false;
  }
  return true;
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    bucket?: string;
    path?: string;
  };

  if (!body.bucket || !ALLOWED_BUCKETS.has(body.bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  if (!body.path || typeof body.path !== "string" || !isSafeStoragePath(body.path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Signed UPLOAD URL — short-lived (default ~2h), valid for a single PUT.
  // upsert: true lets us re-upload the same path if the admin retries.
  const { data, error } = await sb.storage
    .from(body.bucket)
    .createSignedUploadUrl(body.path, { upsert: true });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create signed URL" },
      { status: 500 },
    );
  }

  // Public URL for after the upload (works because both buckets are public).
  const { data: pub } = sb.storage.from(body.bucket).getPublicUrl(body.path);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}
