import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Rate limiter shared by every public POST route.
 *
 * Contract (unchanged from the original in-memory version):
 *   checkRateLimit(key) → { allowed: true } | { allowed: false, retryAfterSec }
 *   5 hits per key per 10-minute fixed window. Callers answer 429 with a
 *   `Retry-After` header when `allowed` is false.
 *
 * Storage: the Postgres RPC `check_rate_limit(p_key, p_limit,
 * p_window_seconds)` (security definer, service_role only) is tried first
 * so the limit holds across serverless instances and cold starts. If the
 * RPC is missing, errors, or the service client cannot be created, the
 * original in-memory Map takes over so a database hiccup can never turn
 * into an open door or a hard failure.
 */

type Hit = { count: number; resetAt: number };

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MAX_HITS = 5;
const WINDOW_SECONDS = Math.floor(RATE_LIMIT_WINDOW_MS / 1000);

const store = new Map<string, Hit>();

/** True once the RPC has reported "function does not exist"; skips the round trip afterwards. */
let rpcUnavailable = false;

export type RateLimitResult = { allowed: boolean; retryAfterSec?: number };

function checkInMemory(key: string, maxHits = RATE_LIMIT_MAX_HITS, windowMs = RATE_LIMIT_WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxHits) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true };
}

function isMissingFunction(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42883" || err.code === "PGRST202") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("check_rate_limit") && (msg.includes("does not exist") || msg.includes("could not find"));
}

type LooseRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

async function checkViaRpc(key: string, maxHits = RATE_LIMIT_MAX_HITS, windowSeconds = WINDOW_SECONDS): Promise<RateLimitResult | null> {
  if (rpcUnavailable) return null;
  try {
    // The RPC is typed loosely on purpose: the generated Database types are
    // owned by the schema agent and may not list the function yet.
    const sb = getSupabaseAdmin() as unknown as LooseRpc;
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_key: key,
      p_limit: maxHits,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      if (isMissingFunction(error)) {
        rpcUnavailable = true;
        console.warn("[rate-limit] check_rate_limit RPC not found; using in-memory limiter.");
      } else {
        console.warn("[rate-limit] RPC error; using in-memory limiter.", error.message);
      }
      return null;
    }
    if (typeof data !== "boolean") return null;
    // The RPC only answers allowed / not allowed. Retry-After is
    // approximated with the full window so the client contract (a
    // positive number of seconds) still holds.
    return data ? { allowed: true } : { allowed: false, retryAfterSec: windowSeconds };
  } catch (err) {
    console.warn("[rate-limit] RPC unavailable; using in-memory limiter.", err);
    return null;
  }
}

/**
 * Rate check. Async because the durable path is a database round trip;
 * the in-memory fallback resolves immediately so nothing observable
 * changes for callers.
 */
export async function checkRateLimit(key: string, opts?: { maxHits?: number; windowMs?: number }): Promise<RateLimitResult> {
  const maxHits = opts?.maxHits ?? RATE_LIMIT_MAX_HITS;
  const windowMs = opts?.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const viaRpc = await checkViaRpc(key, maxHits, Math.floor(windowMs / 1000));
  if (viaRpc) return viaRpc;
  return checkInMemory(key, maxHits, windowMs);
}

/** Synchronous, memory-only variant for callers that cannot await. */
export function checkRateLimitSync(key: string): RateLimitResult {
  return checkInMemory(key);
}

/** Test/ops helper: forget every in-memory window. */
export function resetRateLimits(): void {
  store.clear();
  rpcUnavailable = false;
}
