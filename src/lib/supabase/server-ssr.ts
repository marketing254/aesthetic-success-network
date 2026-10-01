import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cookie-bound Supabase client for Server Components, Route Handlers,
 * and Server Actions. Respects RLS as the signed-in user (or anon).
 *
 * Use `getSupabaseAdmin()` from ./server.ts instead when you need to
 * bypass RLS (admin writes, audit log inserts, etc.).
 */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  const cookieStore = await cookies();

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Calling set() inside a Server Component is a no-op; middleware
        // already refreshed the session before this code ran.
      }
    },
  };

  return createServerClient<Database>(url, anonKey, { cookies: cookieMethods });
}
