/**
 * True when the URL lives on our Supabase Storage host — the only host
 * registered in next.config images.remotePatterns.
 *
 * Headshots / logos are expert- and partner-supplied data, and next/image
 * THROWS at render time on any hostname it doesn't know. Every <Image>
 * fed a DB-driven URL must pass `unoptimized={!isSupabaseImage(url)}`
 * (or be unconditionally unoptimized) so one external URL in a row can
 * never take down a whole page.
 */
export function isSupabaseImage(url: string): boolean {
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!supa && url.startsWith(`${supa}/storage/`);
}
