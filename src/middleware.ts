import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/supabase/middleware-ssr";

/**
 * Auth gate for the admin console + security headers on every response.
 *
 *   /admin/*  → requires a Supabase session AND an active admin_users row.
 *               Public exception: /admin/login.
 *
 * The middleware also refreshes the Supabase session cookie on every
 * request. Security headers are applied here rather than next.config so
 * the same headers ship on every route.
 */

function buildCsp(): string {
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

const CSP = buildCsp();

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  res.headers.set("X-DNS-Prefetch-Control", "on");
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

// Future portal surfaces (member / expert / partner). Locked from day one:
// access requires a session AND an approved/activated row for that role.
// Exact-segment matching so the PUBLIC pages /experts and /partners are
// never caught.
type PortalRole = "member" | "expert" | "partner";

function portalRoleFor(pathname: string): PortalRole | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "member";
  if (pathname === "/expert" || pathname.startsWith("/expert/")) return "expert";
  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) return "partner";
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "member";
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const res = NextResponse.next({ request: req });

  if (pathname.startsWith("/auth/")) return applySecurityHeaders(res);

  const isAdmin = pathname.startsWith("/admin") && !isPublicAdminPath(pathname);
  const portalRole = portalRoleFor(pathname);

  // ── PORTAL GATE ─────────────────────────────────────────────────
  // Members must be activated, experts and partners must be approved,
  // before any portal surface opens for them. Everyone else bounces home.
  if (portalRole) {
    let signedIn = false;
    try {
      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? "";
      signedIn = Boolean(email);

      if (email) {
        if (portalRole === "member") {
          const { data: row } = await supabase
            .from("members")
            .select("id, status")
            .ilike("email", email)
            .maybeSingle();
          if (row?.status === "active") return applySecurityHeaders(res);
        } else if (portalRole === "expert") {
          const { data: row } = await supabase
            .from("expert_applications")
            .select("id, status")
            .ilike("email", email)
            .maybeSingle();
          if (row?.status === "approved") return applySecurityHeaders(res);
        } else {
          const { data: row } = await supabase
            .from("partner_applications")
            .select("id, status")
            .ilike("contact_email", email)
            .maybeSingle();
          if (row?.status === "approved") return applySecurityHeaders(res);
        }
      }
    } catch (err) {
      console.error("[middleware:portal] gate check failed:", err);
    }
    // Signed out → sign-in page (come back here afterwards).
    // Signed in but not activated/approved → home with an explainer.
    const target = req.nextUrl.clone();
    if (signedIn) {
      target.pathname = "/";
      target.search = "?portal=inactive";
    } else {
      target.pathname = "/login";
      target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    }
    return applySecurityHeaders(NextResponse.redirect(target));
  }

  if (!isAdmin) {
    // Outside the gated surfaces — still run Supabase to keep the session
    // cookie fresh so /admin/login reads the latest state.
    try {
      const supabase = createMiddlewareSupabase(req, res);
      await supabase.auth.getUser();
    } catch {
      // ignore — session refresh is best effort
    }
    return applySecurityHeaders(res);
  }

  try {
    const supabase = createMiddlewareSupabase(req, res);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      const target = req.nextUrl.clone();
      target.pathname = "/admin/login";
      target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
      return applySecurityHeaders(NextResponse.redirect(target));
    }

    // Gate by email (not auth_user_id): with the OTP-code flow there is no
    // /auth/callback hop to link auth_user_id before the first navigation.
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, active")
      .ilike("email", userData.user.email ?? "")
      .maybeSingle();

    if (!adminRow || !adminRow.active) {
      const target = req.nextUrl.clone();
      target.pathname = "/admin/login";
      target.search = `?error=${encodeURIComponent("Your account is not an admin.")}`;
      return applySecurityHeaders(NextResponse.redirect(target));
    }

    return applySecurityHeaders(res);
  } catch (err) {
    console.error("[middleware:admin] auth check failed:", err);
    const target = req.nextUrl.clone();
    target.pathname = "/admin/login";
    return applySecurityHeaders(NextResponse.redirect(target));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
