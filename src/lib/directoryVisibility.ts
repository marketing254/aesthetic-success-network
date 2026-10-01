import "server-only";

/**
 * Which experts and companies may appear on the PUBLIC site (/experts,
 * /companies, their profile pages and the directory APIs).
 *
 * Hidden, on top of the usual approved + logo + bio gate:
 *   - preview / bypass logins          BILLING_BYPASS_EMAILS
 *   - test member addresses            TEST_MEMBER_EMAILS
 *   - anything listed in               HIDE_FROM_DIRECTORY_EMAILS
 *     (comma-separated; supports "*@domain.com" and "prefix*" wildcards)
 *   - plus-aliases used for testing    anything+test...@ / anything+asn...@
 *
 * Portals and the admin console are NOT affected: a hidden account still
 * signs in and sees its own data. This is only about the marketing site.
 */

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function matches(pattern: string, email: string): boolean {
  if (!pattern.includes("*")) return pattern === email;
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return re.test(email);
}

export function isHiddenFromDirectory(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (/^[^@]+\+(test|asn|qa|demo)[^@]*@/.test(e)) return true;
  const patterns = [...list("BILLING_BYPASS_EMAILS"), ...list("TEST_MEMBER_EMAILS"), ...list("HIDE_FROM_DIRECTORY_EMAILS")];
  return patterns.some((p) => matches(p, e));
}
