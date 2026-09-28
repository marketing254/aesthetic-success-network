import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * Use ONLY in API routes / server actions / server components for
 * trusted admin operations: writing audit logs, reviewing applications,
 * inserting redemptions, etc. Never expose this client (or its key) to
 * the browser.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        "x-application": "asn-server",
      },
    },
  });
}

// The former `getSupabaseAnon()` helper was removed: nothing imported it,
// and per-user requests should use the cookie-bound client in
// `server-ssr.ts` (which respects RLS as the signed-in user) instead.
