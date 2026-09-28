import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/me — current member row, plus a few aggregates.
 *
 * Admin bypass: if the caller is signed in as an active admin (no
 * corresponding members row required), we return a synthetic member
 * record so the dashboard renders normally in "admin preview" mode.
 * Real member API writes still use requireMember and reject admins —
 * this shim is read-only.
 */
export async function GET() {
  // Admin preview path — checked first. When an admin visits /dashboard
  // through the middleware bypass, they don't have a members row; the
  // normal requireMember() below would 403 and the dashboard would
  // render as an empty shell. Return a synthetic identity instead.
  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (userData?.user) {
    const email = userData.user.email?.toLowerCase();
    if (email) {
      const sbAdmin = getSupabaseAdmin();
      const { data: adminRow } = await sbAdmin
        .from("admin_users")
        .select("id, full_name, email, active")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (adminRow?.active) {
        const firstName = (adminRow.full_name ?? "Admin").split(/\s+/)[0] ?? "Admin";
        return NextResponse.json({
          member: {
            id: `admin:${adminRow.id}`,
            first_name: firstName,
            last_name: null,
            credential: null,
            email: adminRow.email ?? email,
            phone: null,
            practice_name: null,
            practice_role: "Admin (preview)",
            city: null,
            tier: null,
            status: "active",
            joined_at: null,
            activated_at: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_status: "active",
            subscription_interval: null,
            current_period_end: null,
            cancel_at_period_end: null,
            card_brand: null,
            card_last4: null,
            founding_member_locked: false,
          },
          viewedCount: 0,
          isAdminPreview: true,
        });
      }
    }
  }

  const guard = await requireMember();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: member, error } = await sb
    .from("members")
    .select(
      "id, first_name, last_name, credential, email, phone, practice_name, practice_role, city, tier, status, joined_at, activated_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_interval, current_period_end, cancel_at_period_end, card_brand, card_last4, founding_member_locked",
    )
    .eq("id", guard.memberId)
    .maybeSingle();
  if (error) {
    return serverError(error, { route: "GET /api/member/me" });
  }

  // Count of resources viewed (progress rows with last_viewed_at not null)
  const { count: viewedCount } = await sb
    .from("member_resource_progress")
    .select("*", { count: "exact", head: true })
    .eq("member_id", guard.memberId)
    .not("last_viewed_at", "is", null);

  return NextResponse.json({ member, viewedCount: viewedCount ?? 0 });
}

/** PATCH /api/member/me — edit profile fields (safe subset only). */
export async function PATCH(req: Request) {
  const guard = await requireMember();
  if (!guard.ok) return guard.response;

  let body: Partial<{
    first_name: string;
    last_name: string;
    credential: string;
    phone: string;
    practice_name: string;
    practice_role: string;
    city: string;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: {
    first_name?: string;
    last_name?: string | null;
    credential?: string | null;
    phone?: string | null;
    practice_name?: string | null;
    practice_role?: string | null;
    city?: string | null;
  } = {};
  if (typeof body.first_name === "string" && body.first_name.trim()) {
    patch.first_name = body.first_name.trim();
  }
  for (const key of ["last_name", "credential", "phone", "practice_name", "practice_role", "city"] as const) {
    if (typeof body[key] === "string") patch[key] = body[key]!.trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("members").update(patch).eq("id", guard.memberId);
  if (error) return serverError(error, { route: "PATCH /api/member/me" });
  return NextResponse.json({ ok: true });
}
