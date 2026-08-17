import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/supabase/middleware-ssr";

/**
 * Auth gate for the admin console and the three portals.
 *
 *   /admin/*                      → session + an active admin_users row
 *                                   (public exception: /admin/login)
 *   /dashboard, /expert, /vendor  → session + an activated/approved row
 *
 * Scope is deliberately tight (see `config` at the bottom). Security
 * headers ship from next.config.mjs `headers()` and API routes carry
 * their own requireAdmin()/requirePortal*() guards, so this middleware no
 * longer has to run — and pay for a Supabase round trip — on public
 * pages, static assets, RSC prefetches of public routes, or /api/*.
 *
 * Identity comes from `getClaims()` rather than `getUser()`: with
 * asymmetric signing keys the JWT is verified locally via WebCrypto (no
 * network hop at all), and with a legacy symmetric secret it falls back
 * to exactly the server-side check `getUser()` did. Never weaker, often
 * a whole round trip cheaper.
 */

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

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

  const isAdmin = pathname.startsWith("/admin") && !isPublicAdminPath(pathname);
  const portalRole = portalRoleFor(pathname);

  // Nothing gated here (e.g. /admin/login) — no auth work, no round trip.
  if (!isAdmin && !portalRole) return res;

  let supabase: ReturnType<typeof createMiddlewareSupabase>;
  let email = "";
  try {
    supabase = createMiddlewareSupabase(req, res);
    const { data: claimsData } = await supabase.auth.getClaims();
    email = (claimsData?.claims?.email as string | undefined)?.toLowerCase() ?? "";
  } catch (err) {
    console.error("[middleware] auth check failed:", err);
    const target = req.nextUrl.clone();
    target.pathname = isAdmin ? "/admin/login" : "/login";
    target.search = "";
    return NextResponse.redirect(target);
  }

  // ── PORTAL GATE ─────────────────────────────────────────────────
  // Members must be activated, experts and partners must be approved,
  // before any portal surface opens for them. Everyone else bounces home.
  if (portalRole) {
    try {
      if (email) {
        if (portalRole === "member") {
          const { data: row } = await supabase
            .from("members")
            .select("id, status")
            .ilike("email", email)
            .maybeSingle();
          if (row?.status === "active") return res;
        } else if (portalRole === "expert") {
          const { data: row } = await supabase
            .from("expert_applications")
            .select("id, status")
            .ilike("email", email)
            .maybeSingle();
          if (row?.status === "approved") return res;
        } else {
          const { data: row } = await supabase
            .from("partner_applications")
            .select("id, status")
            .ilike("contact_email", email)
            .maybeSingle();
          if (row?.status === "approved") return res;
        }
      }
    } catch (err) {
      console.error("[middleware:portal] gate check failed:", err);
    }
    // Signed out → sign-in page (come back here afterwards).
    // Signed in but not activated/approved → home with an explainer.
    const target = req.nextUrl.clone();
    if (email) {
      target.pathname = "/";
      target.search = "?portal=inactive";
    } else {
      target.pathname = "/login";
      target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    }
    return NextResponse.redirect(target);
  }

  // ── ADMIN GATE ──────────────────────────────────────────────────
  if (!email) {
    const target = req.nextUrl.clone();
    target.pathname = "/admin/login";
    target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(target);
  }

  try {
    // Gate by email (not auth_user_id): with the OTP-code flow there is no
    // /auth/callback hop to link auth_user_id before the first navigation.
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, active")
      .ilike("email", email)
      .maybeSingle();

    if (!adminRow || !adminRow.active) {
      const target = req.nextUrl.clone();
      target.pathname = "/admin/login";
      target.search = `?error=${encodeURIComponent("Your account is not an admin.")}`;
      return NextResponse.redirect(target);
    }

    return res;
  } catch (err) {
    console.error("[middleware:admin] allow-list check failed:", err);
    const target = req.nextUrl.clone();
    target.pathname = "/admin/login";
    target.search = "";
    return NextResponse.redirect(target);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/expert/:path*", "/vendor/:path*", "/portal/:path*"],
};
