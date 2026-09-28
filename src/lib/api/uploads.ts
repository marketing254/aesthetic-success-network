import "server-only";

/**
 * Shared upload allow-lists. Every server-side upload checks BOTH the
 * file extension and the client-declared MIME type against one of these
 * tables, then writes the allow-listed content type (never the raw
 * client string) to storage. SVG is deliberately absent everywhere: an
 * SVG in a public bucket is an XSS vector the moment anything renders it
 * inline.
 */

/** Avatars bucket: png / jpeg / webp / gif, 5 MB (matches the bucket policy). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export type ResolvedUpload = { ext: string; contentType: string };

/**
 * Returns the extension + content type to store, or null when the file
 * fails the allow-list. `AVATAR_ALLOWED` maps extension → the ONE MIME
 * type it may declare.
 */
export function resolveAvatarUpload(file: File): ResolvedUpload | null {
  const ext = file.name?.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase() ?? "";
  const expected = AVATAR_ALLOWED[ext];
  if (!expected) return null;
  const declared = (file.type || "").toLowerCase().split(";")[0].trim();
  if (declared !== expected) return null;
  return { ext, contentType: expected };
}

export const AVATAR_REJECT_MESSAGE =
  "Avatar must be a PNG, JPG, WebP or GIF image (SVG is not accepted).";
