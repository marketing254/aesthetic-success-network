"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * App-root providers.
 *
 * The paid-ads event pages under /summit are plain-CSS pages that use
 * neither MUI nor Lenis, so they skip both. That keeps MUI + Emotion +
 * Lenis off the ad landing page's first load. Every other route gets the
 * MUI theme and smooth scrolling exactly as before: the chunks are split,
 * not removed, and Next still ships them with the initial HTML on the
 * routes that render them.
 */
const MuiProviders = dynamic(() => import("./MuiProviders"));
const SmoothScroll = dynamic(() => import("./SmoothScroll"), { ssr: false });

const LEAN_PREFIXES = ["/summit"];

/**
 * ASN public pages rendered entirely with the plain-CSS design (site.css +
 * SiteNav/SiteFooter/LegalShell). They import nothing from MUI, so the
 * MUI + Emotion runtime is skipped on them and only Lenis is kept.
 *
 * Exact paths only: /experts/[id] and /companies/[id] (the public profile
 * views), /join, /founding/[code] and every /login page DO use MUI and
 * must keep the provider.
 */
const PLAIN_EXACT = new Set(["/", "/experts", "/companies", "/pricing", "/join/member"]);
const PLAIN_PREFIXES = ["/legal", "/agreement"];

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const lean = LEAN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (lean) return <>{children}</>;
  const plain =
    PLAIN_EXACT.has(pathname) ||
    PLAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (plain) {
    return (
      <>
        <SmoothScroll />
        {children}
      </>
    );
  }
  return (
    <MuiProviders>
      <SmoothScroll />
      {children}
    </MuiProviders>
  );
}
