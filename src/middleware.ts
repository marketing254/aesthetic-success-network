import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_LAUNCH_ENABLED } from "@/lib/launch";
import { createMiddlewareSupabase } from "@/lib/supabase/middleware-ssr";

/**
 * Auth gates for the portal surfaces + security headers on every response.
 *
 *   /vendor/*  → requires a Supabase session that resolves to a vendors row.
 *                (The legacy test/test preview cookie is honoured only in a
 *                non-production build with ASN_DEV_PREVIEW_BYPASS=1.)
 *                Public exceptions: /vendor/login, /vendor/applied.
 *                (Partner applications now live inline on /companies#apply —
 *                the standalone /vendor/signup wizard has been removed.)
 *   /admin/*   → requires a Supabase session AND an active admin_users row.
 *                Public exceptions: /admin/login.
 *   /dashboard/* → requires a member session AND subscription_status = 'active'.
 *                  Unpaid members are redirected to /upgrade.
 *   /upgrade   → requires a member session. Already-paid members are
 *                redirected back to /dashboard.
 *
 * The middleware also refreshes the Supabase session cookie on every
 * request (createMiddlewareSupabase + getUser handles this automatically).
 *
 * Security headers (HSTS, CSP, X-Frame-Options, etc.) are applied here
 * rather than in next.config.ts so that Vercel's modifyConfig step doesn't
 * choke on the headers() function (a Next.js 16.2.x + Vercel quirk).
 */

const VENDOR_LEGACY_COOKIE = "vendor_session";

/**
 * Local-only preview shortcuts (the legacy `vendor_session=test-preview`
 * cookie for /vendor/* and `/upgrade?preview=1`). Both require TWO
 * conditions: a non-production build AND the explicit opt-in
 * ASN_DEV_PREVIEW_BYPASS=1 in the environment. NODE_ENV alone is not
 * enough — a preview deployment or a misconfigured host must never be
 * able to reach a portal shell without a real session.
 */
const DEV_PREVIEW_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.ASN_DEV_PREVIEW_BYPASS === "1";

// Cookie names. Duplicated from src/lib/auth/guards.ts (SIGNUP_CHECKOUT_COOKIE,
// REFERRAL_COOKIE) because the middleware runs on the Edge runtime and cannot
// import that server-only module. Keep the two in sync.
const CHECKOUT_COOKIE = "asn_checkout";
const REFERRAL_COOKIE = "asn_ref";

/** Every surface the job board owns — pages, APIs and its cron. */
function isJobBoardPath(pathname: string): boolean {
  return (
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname === "/seeker" ||
    pathname.startsWith("/seeker/") ||
    pathname === "/dashboard/jobs" ||
    pathname.startsWith("/dashboard/jobs/") ||
    pathname === "/admin/jobs" ||
    pathname.startsWith("/admin/jobs/") ||
    pathname === "/admin/job-seekers" ||
    pathname.startsWith("/admin/job-seekers/") ||
    pathname === "/api/jobs" ||
    pathname.startsWith("/api/jobs/") ||
    pathname.startsWith("/api/seeker/") ||
    pathname === "/api/member/jobs" ||
    pathname.startsWith("/api/member/jobs/") ||
    pathname === "/api/admin/jobs" ||
    pathname.startsWith("/api/admin/jobs/") ||
    pathname === "/api/admin/job-seekers" ||
    pathname === "/api/cron/jobs"
  );
}

function buildCsp(): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");
  const supabaseHttps = supabaseHost ? `https://${supabaseHost}` : "";
  const supabaseWss = supabaseHost ? `wss://${supabaseHost}` : "";

  // Allow-list (ASN). Removed from the DMN build because nothing in src/
  // loads them any more: YouCanBook.me (embed.ycb.me, *.ycb.me,
  // *.youcanbook.me — coaching bookings are a plain link now), Spline
  // (my.spline.design, *.spline.design — the 3D hero scene is not rendered)
  // and maps.googleapis.com (no Maps API calls). Re-add a host here the day
  // a component actually needs it; never pre-emptively.
  return [
    "default-src 'self'",
    // vercel.live is the Vercel Live feedback widget that gets auto-injected
    // into preview deployments. It's harmless and Vercel-owned; allowlisting
    // it just silences the CSP console errors on preview URLs. The same
    // CSP ships to production (where vercel.live is never loaded), so this
    // doesn't expand the attack surface for real users.
    // Stripe.js — js.stripe.com hosts the script; m.stripe.network is the
    // 3D-Secure / risk-check iframe host used by PaymentElement.
    // connect.facebook.net — the Meta Pixel loader on the paid-ads pages;
    // checkout.stripe.com — Stripe's Embedded Checkout assets.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://vercel.live https://js.stripe.com https://*.js.stripe.com https://checkout.stripe.com https://connect.facebook.net",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
    "font-src 'self' https://fonts.gstatic.com https://vercel.live https://assets.vercel.com data:",
    `img-src 'self' data: blob: ${supabaseHttps} https://www.google-analytics.com https://www.googletagmanager.com https://vercel.live https://vercel.com https://*.stripe.com https://www.facebook.com`,
    // media-src controls <video> and <audio> sources. Without this, videos
    // from Supabase Storage are blocked because default-src 'self' falls back.
    `media-src 'self' blob: ${supabaseHttps}`,
    // Stripe XHR: api.stripe.com for tokenization + subscription lookups,
    // js.stripe.com + m.stripe.network for risk-check calls the SDK makes.
    // cdn.jsdelivr.net: pdf.js worker/cmaps fetched at runtime.
    // *.pusher.com: transport for the Vercel Live widget on previews.
    `connect-src 'self' ${supabaseHttps} ${supabaseWss} https://cdn.jsdelivr.net https://fonts.gstatic.com https://www.google-analytics.com https://www.googletagmanager.com https://analytics.google.com https://vercel.live https://*.pusher.com wss://*.pusher.com https://api.stripe.com https://js.stripe.com https://m.stripe.network https://checkout.stripe.com https://www.facebook.com https://connect.facebook.net`,
    // frame-src controls <iframe> sources. Supabase is needed so the resource
    // viewer can render PDFs inline; Microsoft Office Online viewer is needed
    // for slide decks (.pptx). Stripe: js.stripe.com hosts the
    // PaymentElement iframe; hooks.stripe.com hosts 3-D Secure challenges.
    `frame-src 'self' ${supabaseHttps} https://view.officeapps.live.com https://vercel.live https://js.stripe.com https://hooks.stripe.com https://*.js.stripe.com https://checkout.stripe.com https://www.facebook.com`,
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
    // microphone=(self): Beacon's voice input (Web Speech API) needs mic
    // access on our own origin. Everything else stays fully denied.
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()",
  );
  res.headers.set("X-DNS-Prefetch-Control", "on");
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

function isPublicVendorPath(pathname: string) {
  return (
    pathname === "/vendor/login" ||
    pathname.startsWith("/vendor/login/") ||
    pathname === "/vendor/applied"
  );
}

// `/experts` (plural, public marketing page with the application form) is
// completely separate from `/expert/*` (the authenticated portal). The
// gate below only matches the singular form.
function isPublicExpertPath(pathname: string) {
  return (
    pathname === "/expert/login" ||
    pathname.startsWith("/expert/login/") ||
    pathname === "/expert/applied"
  );
}

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function isPublicMemberPath(_pathname: string) {
  // All /dashboard/* paths are gated. Members enter via /member/login → OTP
  // code → /upgrade (if unpaid) → /dashboard (once paid).
  return false;
}

function isUpgradePath(pathname: string) {
  return pathname === "/upgrade" || pathname.startsWith("/upgrade/");
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const res = NextResponse.next({ request: req });

  // Member launch pause: the member portal and the plan/checkout page are
  // closed until MEMBER_LAUNCH_ENABLED=true. Visitors land on the waitlist.
  if (!MEMBER_LAUNCH_ENABLED && (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || isUpgradePath(pathname))) {
    return NextResponse.redirect(new URL("/join/member", req.url));
  }

  // Supabase Auth fallback — when a magic-link redirect URL isn't in
  // Supabase's allowlist, Supabase falls back to the Site URL (the
  // homepage) with ?code=… or ?error=…. Forward those to /auth/callback
  // HERE so the homepage itself never needs to read searchParams — that
  // read was making "/" fully dynamic (server-rendered per request).
  // With it gone, the highest-traffic page is static and served from the
  // CDN edge.
  if (pathname === "/") {
    const sp = req.nextUrl.searchParams;
    const code = sp.get("code");
    const authError = sp.get("error");
    if (code || authError) {
      const target = req.nextUrl.clone();
      target.pathname = "/auth/callback";
      target.search = "";
      if (code) {
        target.searchParams.set("code", code);
        const next = sp.get("next");
        const role = sp.get("role");
        if (next) target.searchParams.set("next", next);
        if (role) target.searchParams.set("role", role);
      } else if (authError) {
        target.searchParams.set("error", authError);
        const desc = sp.get("error_description");
        if (desc) target.searchParams.set("error_description", desc);
      }
      return applySecurityHeaders(NextResponse.redirect(target));
    }
  }

  // Referral attribution — persist ?ref=CODE as a cookie the MOMENT a
  // visitor arrives via a referral link (e.g. /drmaya redirects to
  // /join/member?ref=MAYA7K3X). Without this the credit lives only in the
  // URL and is lost as soon as they browse to another page before registering.
  //
  // First-touch: the first referrer keeps the credit — we don't overwrite
  // an existing cookie, so a later link can't steal an earlier referral.
  // 90-day window, read server-side at /api/member/signup. Set on `res`
  // before any early return so every path carries it. The shape check
  // mirrors CODE_RE in lib/waitlist/validate.ts (letters/digits/hyphen,
  // 4-16 chars) so the stored value is always safe for an exact lookup.
  const refParam = req.nextUrl.searchParams.get("ref");
  if (refParam && /^[A-Za-z0-9-]{4,16}$/.test(refParam) && !req.cookies.get(REFERRAL_COOKIE)) {
    res.cookies.set(REFERRAL_COOKIE, refParam.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Member tools render inside the portal's own <iframe>. The global
  // frame-ancestors 'none' would make the browser refuse to frame them —
  // even by our own page — so this one path gets a same-origin framing
  // policy instead. Auth is enforced inside the route itself
  // (requireMemberOrAdminPreview), and 'self' still blocks any other
  // site from embedding the tools.
  // /api/tools/public/ serves the one allow-listed free tool to the
  // public /tools/[id] page in the same way; the allow-list lives in the
  // route (isPublicTool), and 'self' still blocks third-party embedding.
  if (pathname.startsWith("/api/member/tools/") || pathname.startsWith("/api/tools/public/")) {
    applySecurityHeaders(res);
    res.headers.set(
      "Content-Security-Policy",
      CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
    );
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    return res;
  }

  // Only run on protected portal paths. Auth callback is always allowed.
  if (pathname.startsWith("/auth/")) return applySecurityHeaders(res);

  // ─────────────────────────────────────────────────────────────────
  // JOB BOARD kill-switch. Until NEXT_PUBLIC_JOB_BOARD_ENABLED=true the
  // whole feature — public board, seeker accounts, member posting, admin
  // queue, cron — answers 404, so a deploy of the branch shows nothing.
  // ─────────────────────────────────────────────────────────────────
  if (isJobBoardPath(pathname) && process.env.NEXT_PUBLIC_JOB_BOARD_ENABLED !== "true") {
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(NextResponse.json({ error: "Not found." }, { status: 404 }));
    }
    const target = req.nextUrl.clone();
    target.pathname = "/__job-board-disabled";
    target.search = "";
    return applySecurityHeaders(NextResponse.rewrite(target, { status: 404 }));
  }

  // ─────────────────────────────────────────────────────────────────
  // JOB SEEKER  (/seeker/applications) — any signed-in ACTIVE members row,
  // free job-seeker accounts included. Never a payment check: applying
  // is free. /seeker/join and /seeker/login are public.
  // ─────────────────────────────────────────────────────────────────
  if (pathname === "/seeker" || pathname === "/seeker/applications" || pathname.startsWith("/seeker/applications/")) {
    try {
      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      const back = () => {
        const target = req.nextUrl.clone();
        target.pathname = "/seeker/login";
        target.search = `?next=${encodeURIComponent(pathname)}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      };
      if (!userData.user) return back();
      const { data: memberRow } = await supabase
        .from("members")
        .select("id, status")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (!memberRow || memberRow.status !== "active") return back();
      return applySecurityHeaders(res);
    } catch (err) {
      console.error("[middleware:seeker] auth check failed:", err);
      const target = req.nextUrl.clone();
      target.pathname = "/seeker/login";
      return applySecurityHeaders(NextResponse.redirect(target));
    }
  }

  const isVendor = pathname.startsWith("/vendor") && !isPublicVendorPath(pathname);
  const isAdmin = pathname.startsWith("/admin") && !isPublicAdminPath(pathname);
  const isMember = pathname.startsWith("/dashboard") && !isPublicMemberPath(pathname);
  const isUpgrade = isUpgradePath(pathname);
  // Only the singular `/expert/*` is gated. `/experts` (plural) is the
  // public marketing page — Next.js routes /expert and /experts to
  // different folders, so prefix-matching with the boundary trailing
  // slash here is enough to avoid a false positive.
  const isExpert =
    (pathname === "/expert" || pathname.startsWith("/expert/")) &&
    !isPublicExpertPath(pathname);

  if (!isVendor && !isAdmin && !isMember && !isUpgrade && !isExpert) {
    // Outside the gated surfaces — still run Supabase to keep the session
    // cookie fresh so /vendor/login etc. read the latest state.
    try {
      const supabase = createMiddlewareSupabase(req, res);
      await supabase.auth.getUser();
    } catch {
      // ignore — session refresh is best effort
    }
    return applySecurityHeaders(res);
  }

  // ─────────────────────────────────────────────────────────────────
  // VENDOR PORTAL
  // ─────────────────────────────────────────────────────────────────
  if (isVendor) {
    // Dev-only preview shortcut (the test/test stand-in). NEVER honored in
    // production, and only when ASN_DEV_PREVIEW_BYPASS=1 is set locally —
    // the old code allowed ANY `vendor_session` cookie value, which let a
    // forged cookie reach the partner portal shell.
    if (
      DEV_PREVIEW_BYPASS &&
      req.cookies.get(VENDOR_LEGACY_COOKIE)?.value === "test-preview"
    ) {
      return applySecurityHeaders(res);
    }

    try {
      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        // Confirm the session actually belongs to a vendor — an own-row read
        // (RLS-allowed for any status via auth_user_id) so a member/expert/
        // admin session can't reach the partner portal shell. auth_user_id is
        // backfilled + linked at signup, so this resolves for every vendor
        // including pending_review ones.
        const { data: vendorRow } = await supabase
          .from("vendors")
          .select("id, status")
          .eq("auth_user_id", userData.user.id)
          .maybeSingle();
        if (
          vendorRow &&
          vendorRow.status !== "suspended" &&
          vendorRow.status !== "churned"
        ) {
          return applySecurityHeaders(res);
        }
      }
    } catch (err) {
      console.error("[middleware:vendor] auth check failed:", err);
    }

    const target = req.nextUrl.clone();
    target.pathname = "/vendor/login";
    target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    return applySecurityHeaders(NextResponse.redirect(target));
  }

  // ─────────────────────────────────────────────────────────────────
  // ADMIN CONSOLE
  // ─────────────────────────────────────────────────────────────────
  if (isAdmin) {
    try {
      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        const target = req.nextUrl.clone();
        target.pathname = "/admin/login";
        target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("id, active")
        .eq("auth_user_id", userData.user.id)
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

  // ─────────────────────────────────────────────────────────────────
  // EXPERT PORTAL  (/expert/*)
  // Requires a Supabase session AND an `experts` row that isn't
  // suspended/archived. New auth users for experts are only created by
  // /api/admin/experts (PATCH invite), so a session belonging to a
  // non-expert email is rejected here too.
  // ─────────────────────────────────────────────────────────────────
  if (isExpert) {
    try {
      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        const target = req.nextUrl.clone();
        target.pathname = "/expert/login";
        target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      const { data: expertRow } = await supabase
        .from("experts")
        .select("id, status")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (
        !expertRow ||
        expertRow.status === "suspended" ||
        expertRow.status === "archived"
      ) {
        const target = req.nextUrl.clone();
        target.pathname = "/expert/login";
        target.search = `?error=${encodeURIComponent("Your expert portal isn't available right now.")}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      return applySecurityHeaders(res);
    } catch (err) {
      console.error("[middleware:expert] auth check failed:", err);
      const target = req.nextUrl.clone();
      target.pathname = "/expert/login";
      return applySecurityHeaders(NextResponse.redirect(target));
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // MEMBER PORTAL  (/dashboard/*)  — requires paid subscription
  // /upgrade — requires member session but blocks if already paid
  //
  // Admin bypass: an active admin_users row lets the same auth user hit
  // /dashboard without needing a members row or an active subscription.
  // This is a read-only preview for the team — the dashboard pages
  // handle a missing member row by rendering a lightweight admin
  // banner instead of crashing on `.first_name` etc.
  // ─────────────────────────────────────────────────────────────────
  if (isMember || isUpgrade) {
    try {
      // Pay-first flow: the asn_checkout cookie means THIS browser just
      // signed up and needs to pick a plan + pay. Honor it for /upgrade
      // FIRST — before any session check — so a leftover/stale login from
      // earlier can't hijack the flow and bounce a new signup to "not
      // active". The page + checkout API resolve the member from the cookie.
      // /dashboard is never allowed on this cookie; it still needs a session.
      if (isUpgrade && req.cookies.get(CHECKOUT_COOKIE)?.value) {
        return applySecurityHeaders(res);
      }

      // DEV ONLY: /upgrade?preview=1 renders the payment card with a fake
      // context so the team can eyeball it without a signup. Requires a
      // non-production build AND ASN_DEV_PREVIEW_BYPASS=1, so this branch
      // cannot exist live.
      if (
        isUpgrade &&
        DEV_PREVIEW_BYPASS &&
        req.nextUrl.searchParams.get("preview") === "1"
      ) {
        return applySecurityHeaders(res);
      }

      const supabase = createMiddlewareSupabase(req, res);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        const target = req.nextUrl.clone();
        target.pathname = "/member/login";
        target.search = `?redirect=${encodeURIComponent(pathname + search)}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      // Admin bypass — checked before the member-row lookup so admins
      // whose auth account is NOT also linked to a members row still
      // pass through. Cheap query (single indexed lookup).
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("id, active")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (adminRow?.active) {
        return applySecurityHeaders(res);
      }

      // Confirm the user has an active members row + read their billing status.
      const { data: memberRow } = await supabase
        .from("members")
        .select("id, status, subscription_status")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (!memberRow || memberRow.status !== "active") {
        const target = req.nextUrl.clone();
        target.pathname = "/member/login";
        target.search = `?error=${encodeURIComponent("Your member portal isn't active yet. We'll email you when it is.")}`;
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      // Paid = active OR trialing (card on file for both).
      const isPaid =
        memberRow.subscription_status === "active" ||
        memberRow.subscription_status === "trialing";

      // /dashboard/* → must be paid. Bounce unpaid members to /upgrade.
      if (isMember && !isPaid) {
        const target = req.nextUrl.clone();
        target.pathname = "/upgrade";
        target.search = "";
        return applySecurityHeaders(NextResponse.redirect(target));
      }

      // /upgrade → already paid members go straight to /dashboard.
      // Exception: keep them on /upgrade if they're returning from Stripe
      // (subscribed=1 or subscribed=0) so they see the processing banner /
      // cancel note instead of getting punted away mid-flow.
      if (isUpgrade && isPaid) {
        const sub = req.nextUrl.searchParams.get("subscribed");
        if (sub !== "1" && sub !== "0") {
          const target = req.nextUrl.clone();
          target.pathname = "/dashboard";
          target.search = "";
          return applySecurityHeaders(NextResponse.redirect(target));
        }
      }

      return applySecurityHeaders(res);
    } catch (err) {
      console.error("[middleware:member] auth check failed:", err);
      const target = req.nextUrl.clone();
      target.pathname = "/member/login";
      return applySecurityHeaders(NextResponse.redirect(target));
    }
  }

  return applySecurityHeaders(res);
}

export const config = {
  // Match every page route, but exclude Next.js internals and static
  // assets. The middleware short-circuits early for non-gated paths.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
