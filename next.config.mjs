import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Security headers live here rather than in middleware so that shipping
 * them costs nothing: `headers()` is applied by the CDN/router on every
 * response, while middleware has to boot and run per request. That frees
 * `src/middleware.ts` to match only the gated routes it actually guards.
 */
function buildCsp() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");
  const supabaseHttps = supabaseHost ? `https://${supabaseHost}` : "";
  const supabaseWss = supabaseHost ? `wss://${supabaseHost}` : "";

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
    "font-src 'self' https://fonts.gstatic.com https://vercel.live https://assets.vercel.com data:",
    `img-src 'self' data: blob: ${supabaseHttps} https://vercel.live https://vercel.com`,
    `connect-src 'self' ${supabaseHttps} ${supabaseWss} https://fonts.gstatic.com https://vercel.live`,
    "frame-src 'self' https://vercel.live",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ]
    .map((d) => d.replace(/\s+/g, " ").trim())
    .join("; ");
}

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: buildCsp() },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to THIS app so the build never wanders into a
  // parent folder (the repo may also contain src/, TD - Member Network/, etc.).
  // This is the usual fix for failures at the "Collecting build traces" step.
  outputFileTracingRoot: __dirname,
  experimental: {
    // Next defaults dynamic routes to a 0-second client Router Cache, so
    // clicking back to a console tab you were just on refetched the whole
    // page from the server. 30s makes returning to a tab instant.
    //
    // Safe for these screens: the admin tables seed useState from the
    // server payload and own their state from then on (optimistic updates
    // plus an explicit refresh button), and the two views that do re-read
    // the server after a mutation — DealsReview and HotlineQueue — call
    // router.refresh(), which invalidates this cache outright.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
