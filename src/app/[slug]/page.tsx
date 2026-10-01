import { notFound, redirect } from "next/navigation";
import { resolveReferralSlug } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Root-level referral vanity handles, e.g. aestheticsuccessnetwork.com/drtaylor
 *
 * Next.js matches every real page (/experts, /pricing, /join, …) by its own
 * static segment first, so this catch-all only ever sees genuinely-unknown
 * single-segment paths. If the path is a known referral handle we redirect
 * to the normal signup with the code attached (?ref=CODE), which reuses all
 * the existing capture + attribution logic. Anything else 404s.
 *
 * A tiny reserved-word guard short-circuits obvious non-handles so they 404
 * without a DB round-trip.
 */
const RESERVED = new Set([
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "well-known", "sw.js", "index",
]);

export default async function ReferralHandlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const handle = decodeURIComponent(slug || "").toLowerCase();

  if (!handle || RESERVED.has(handle) || handle.includes(".")) notFound();

  const resolved = await resolveReferralSlug(handle);
  if (!resolved) notFound();

  // Hand off to the member signup (the step-by-step /join/member flow)
  // with the referral code attached. The code rides through signup to the
  // payment page, where the owner's promo code auto-applies if active.
  redirect(`/join/member?ref=${encodeURIComponent(resolved.code)}`);
}
