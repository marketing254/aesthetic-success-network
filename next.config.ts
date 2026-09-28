import type { NextConfig } from "next";

/**
 * Aesthetic Success Network (ASN) — minimal Next.js config.
 *
 * Security headers live in middleware.ts (not `headers()` here) because
 * Vercel's modifyConfig step on Next.js 16.x choked on the headers()
 * function. Middleware applies the same headers at request time, with
 * the bonus that they're testable and easier to evolve. Behaviour is
 * unchanged from the DMN build this was ported from.
 *
 * `compiler.removeConsole` strips every `console.*` call from client-
 * bundled code in production builds — except `console.error` and
 * `console.warn`, which we keep for diagnostic logging that surfaces in
 * browser dev tools but never leaks PII (detailed errors are routed to
 * server logs via the lib/api/errorResponse helper).
 *
 * Server-side console.log is untouched — server logs stay on the
 * platform (Vercel logs / your hosting provider) and never reach the
 * end user's browser.
 */
const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // @sparticuz/chromium ships a compressed binary that must be resolved
  // from node_modules at runtime, not bundled/tree-shaken by Next — same
  // for puppeteer-core's native bits. Without this, PDF generation can
  // fail on Vercel even when `next build` succeeds locally.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Next's file tracer can't see that @sparticuz/chromium reaches into
  // its own bin/ folder for the actual browser binary at runtime, so it
  // silently drops those files from the deployed function unless we
  // include them explicitly here.
  outputFileTracingIncludes: {
    "/api/admin/founding-invite/\\[id\\]": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/founding/\\[code\\]/accept": ["./node_modules/@sparticuz/chromium/bin/**"],
    // Member tools are self-contained HTML files read from disk at runtime
    // (kept OUT of /public so they're member-gated). Trace them into the
    // serving function's bundle.
    "/api/member/tools/\\[id\\]": ["./tools-html/**"],
    "/api/tools/public/\\[id\\]": ["./tools-html/**"],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // next/image needs to know about external image hosts before it'll
  // optimize them. Adding the Supabase Storage host means every cover,
  // headshot, infographic, and partner logo gets resized + served as
  // WebP/AVIF via Vercel's image CDN.
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Cache optimized variants on the edge for 24 hours. Keeps the
    // bandwidth bill flat for hot covers + headshots.
    minimumCacheTTL: 60 * 60 * 24,
  },
};

export default nextConfig;
