import "server-only";
import { createHash } from "node:crypto";

/**
 * One salted IP fingerprint for the whole app.
 *
 * Every place that stores a visitor IP (waitlist, member/partner/expert
 * signup, job views, join applications, founding-invite acceptance,
 * invite-link acceptance, trial start, lead magnets) goes through this
 * helper so the salt policy lives in exactly one file:
 *
 *   - `IP_HASH_SALT` (alias `SIGNUP_IP_SALT`) is REQUIRED in production.
 *     Without it the request throws rather than silently storing hashes
 *     salted with a public constant, which would make the stored value
 *     trivially reversible for IPv4.
 *   - Outside production a fixed dev salt keeps local runs working with
 *     no env wiring.
 *
 * The output is a 64-char hex SHA-256. Callers that only need a short
 * fingerprint (e.g. the "last 6" shown on an agreement PDF) slice it.
 */
export const DEV_IP_HASH_SALT = "asn-dev-salt";

export function ipHashSalt(): string {
  const salt = process.env.IP_HASH_SALT || process.env.SIGNUP_IP_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT is required in production (used to hash visitor IPs).");
  }
  return DEV_IP_HASH_SALT;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ipHashSalt()}::${ip || "0.0.0.0"}`).digest("hex");
}

/**
 * First hop of x-forwarded-for, else x-real-ip, else 0.0.0.0. Shared so
 * every route reads the client address the same way.
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || "0.0.0.0";
}
