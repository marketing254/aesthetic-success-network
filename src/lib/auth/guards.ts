import "server-only";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Auth guards for Route Handlers.
 *
 * Defense in depth:
 *   - Middleware blocks page navigation for unauthenticated users
 *   - These guards block direct API hits (curl, scripts)
 *   - RLS in the database is the third layer
 */

export type AdminContext = {
  ok: true;
  userId: string;
  email: string;
  adminId: string;
  role: "owner" | "admin" | "reviewer" | "support";
};

type Failure = { ok: false; response: NextResponse };

const ADMIN_ROLES = ["owner", "admin", "reviewer", "support"] as const;

/**
 * Use at the top of every /api/admin/* route:
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 */
export async function requireAdmin(): Promise<AdminContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("admin_users")
    .select("id, role, active, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!row || !row.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  // Best-effort: keep auth_user_id linked & bump last_active_at.
  if (row.auth_user_id !== userData.user.id) {
    await admin
      .from("admin_users")
      .update({ auth_user_id: userData.user.id, last_active_at: new Date().toISOString() })
      .eq("id", row.id);
  } else {
    await admin
      .from("admin_users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (!ADMIN_ROLES.includes(row.role as (typeof ADMIN_ROLES)[number])) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid admin role." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    adminId: row.id,
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
  const cookieClient = await createServerSupabase();
  const { data: userData, error } = await cookieClient.auth.getUser();
  if (error || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }
  return { ok: true, userId: userData.user.id, email };
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
