import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "One click to renew" from the day-25 email.
 *
 * The click has to work without a login — the person reading it is on
 * their phone and a sign-in wall converts nobody. So the link carries a
 * signed token instead of relying on a session, following the same
 * shape as signCheckoutToken in lib/auth/guards.ts.
 *
 * What stops abuse:
 *   - HMAC over jobId + expiry, so the token can't be forged or edited
 *   - a hard expiry baked into the signed payload
 *   - it grants exactly one action (renew this one post) and nothing else
 *
 * Worst case if a token leaks: someone extends a public job ad by 30
 * days. That's the whole blast radius, which is why a bare signed link
 * is proportionate here and would not be for anything touching billing.
 */

function secret(): string {
  const s = process.env.IP_HASH_SALT || process.env.SIGNUP_IP_SALT;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT required to sign job renewal links.");
    }
    return "dev-only-job-renew-secret";
  }
  return s;
}

/** Token stays valid a fortnight — long enough to survive a holiday. */
const TOKEN_TTL_MS = 14 * 86_400_000;

export function signRenewToken(jobId: string, now: Date = new Date()): string {
  const expiresAt = now.getTime() + TOKEN_TTL_MS;
  const payload = `${jobId}.${expiresAt}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the job id, or null if the token is forged, malformed or stale. */
export function verifyRenewToken(token: string | null | undefined, now: Date = new Date()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [jobId, expiresRaw, sig] = parts;
  if (!jobId || !expiresRaw || !sig) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) return null;

  const expected = createHmac("sha256", secret())
    .update(`${jobId}.${expiresRaw}`)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return jobId;
}
