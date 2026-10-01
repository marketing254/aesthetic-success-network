"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Browser-side Supabase client. Reads/writes the auth cookie that
 * createServerSupabase + middleware also use, so the session stays in
 * sync between client and server.
 *
 * Singleton via @supabase/ssr — calling this multiple times in the
 * same tab returns the same instance.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
