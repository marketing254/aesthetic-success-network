/**
 * The one HTML escaper every outbound email (and every HTML rendered from
 * user or database values) must use. Escapes the five characters that can
 * break out of text or attribute context: & < > " '.
 *
 * Accepts `unknown` so callers can pass nullable DB columns straight in;
 * null / undefined render as an empty string, everything else is
 * stringified first.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
