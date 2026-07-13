import { createHash } from "node:crypto";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

/**
 * Salted hash — raw IPs are never stored. IP_HASH_SALT must be a stable
 * 32+ character secret and must never rotate after launch.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? process.env.SIGNUP_IP_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT is required in production.");
    }
    return createHash("sha256").update(`dev-only:${ip}`).digest("hex").slice(0, 32);
  }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function userAgent(req: Request): string | null {
  return req.headers.get("user-agent")?.slice(0, 500) ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

export function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
