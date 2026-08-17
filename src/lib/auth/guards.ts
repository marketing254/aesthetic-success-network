import "server-only";
import { NextResponse, after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Auth guards for Route Handlers.
 *
 * Defense in depth:
 *   - Middleware blocks page navigation for unauthenticated users
 *   - These guards block direct API hits (curl, scripts)
 *   - RLS in the database is the third layer
 *
 * Identity resolution uses `getClaims()`, which verifies the JWT locally
 * (WebCrypto) when the project signs with asymmetric keys and otherwise
 * falls back to the same server-side call `getUser()` made — same
 * guarantee, usually one fewer network round trip per request.
 */

export type AdminContext = {
  ok: true;
  userId: string;
  email: string;
  adminId: string;
  fullName: string;
  role: "owner" | "admin" | "reviewer" | "support";
};

type Failure = { ok: false; response: NextResponse };

const ADMIN_ROLES = ["owner", "admin", "reviewer", "support"] as const;

/** Don't rewrite last_active_at more than once per admin per 5 minutes. */
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Resolve the signed-in user from the session cookie.
 * Returns the lowercased email + auth user id, or a Failure response.
 */
async function sessionUser(): Promise<{ ok: true; userId: string; email: string } | Failure> {
  const cookieClient = await createServerSupabase();
  const { data, error } = await cookieClient.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  const email = (claims.email as string | undefined)?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }
  return { ok: true, userId: claims.sub as string, email };
}

/**
 * Use at the top of every /api/admin/* route:
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 */
export async function requireAdmin(): Promise<AdminContext | Failure> {
  const user = await sessionUser();
  if (!user.ok) return user;

  const admin = getSupabaseAdmin();
  // ilike, not eq: admin_users is unique on lower(email), so a row stored
  // with any capitalisation must still match the lowercased session email
  // (this is what the middleware gate has always done).
  const { data: row } = await admin
    .from("admin_users")
    .select("id, full_name, role, active, auth_user_id, last_active_at")
    .ilike("email", user.email)
    .maybeSingle();

  if (!row || !row.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  if (!ADMIN_ROLES.includes(row.role as (typeof ADMIN_ROLES)[number])) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid admin role." }, { status: 403 }),
    };
  }

  // Best-effort presence tracking: keep auth_user_id linked & bump
  // last_active_at. Runs AFTER the response is sent and at most once per
  // ACTIVITY_THROTTLE_MS, so it never sits on the request's critical path
  // — it used to add a blocking write to every admin API call.
  const needsLink = row.auth_user_id !== user.userId;
  const lastActive = row.last_active_at ? Date.parse(row.last_active_at as string) : 0;
  const isStale = !Number.isFinite(lastActive) || Date.now() - lastActive > ACTIVITY_THROTTLE_MS;

  if (needsLink || isStale) {
    after(async () => {
      const patch: Record<string, string> = { last_active_at: new Date().toISOString() };
      if (needsLink) patch.auth_user_id = user.userId;
      const { error } = await admin.from("admin_users").update(patch).eq("id", row.id);
      if (error) console.error("[guards:requireAdmin] activity update failed:", error.message);
    });
  }

  return {
    ok: true,
    userId: user.userId,
    email: user.email,
    adminId: row.id,
    fullName: (row.full_name as string) ?? user.email,
    role: row.role as AdminContext["role"],
  };
}

/** Stricter variant: only the `owner` role (admin-team mutations). */
export async function requireOwner(): Promise<AdminContext | Failure> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (guard.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Owner-only action." }, { status: 403 }),
    };
  }
  return guard;
}

// ── Portal guards (member / expert / partner) ──────────────────────
// The rule: nobody reaches a portal API unless their record is
// activated (members) or approved (experts/partners). Use these at the
// top of every future /api/member/*, /api/expert-portal/*,
// /api/partner-portal/* handler, exactly like requireAdmin().

export type PortalContext = {
  ok: true;
  userId: string;
  email: string;
  rowId: string;
};

async function portalUser(): Promise<
  { ok: true; userId: string; email: string } | Failure
> {
  return sessionUser();
}

/** Active members only. */
export async function requirePortalMember(): Promise<PortalContext | Failure> {
  const user = await portalUser();
  if (!user.ok) return user;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("members")
    .select("id, status")
    .ilike("email", user.email)
    .maybeSingle();

  if (!row || row.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your membership isn't active yet. We'll email you when it is." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: user.userId, email: user.email, rowId: row.id as string };
}

/** Approved experts only. */
export async function requirePortalExpert(): Promise<PortalContext | Failure> {
  const user = await portalUser();
  if (!user.ok) return user;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("expert_applications")
    .select("id, status")
    .ilike("email", user.email)
    .maybeSingle();

  if (!row || row.status !== "approved") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your expert application isn't approved yet." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: user.userId, email: user.email, rowId: row.id as string };
}

/** Approved partners only. */
export async function requirePortalPartner(): Promise<PortalContext | Failure> {
  const user = await portalUser();
  if (!user.ok) return user;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("partner_applications")
    .select("id, status")
    .ilike("contact_email", user.email)
    .maybeSingle();

  if (!row || row.status !== "approved") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your partner application isn't approved yet." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: user.userId, email: user.email, rowId: row.id as string };
}
