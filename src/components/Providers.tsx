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

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const lean = LEAN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (lean) return <>{children}</>;
  return (
    <MuiProviders>
      <SmoothScroll />
      {children}
    </MuiProviders>
  );
}
