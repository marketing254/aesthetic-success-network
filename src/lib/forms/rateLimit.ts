// Simple in-memory rate limiter. Good enough for the launch waitlist
// window. Resets on each cold start; on serverless this means
// per-instance limits, which is fine for spam suppression.

type Hit = { count: number; resetAt: number };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

const store = new Map<string, Hit>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= MAX_HITS) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true };
}
