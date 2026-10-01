import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/admins — list the admin allow-list (any admin can read) */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, active, last_active_at, auth_user_id, created_at")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/admins" });
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = ["owner", "admin", "reviewer", "support"] as const;
type Role = (typeof ROLES)[number];

/** POST { email, full_name, role } — add a new admin (owner-only) */
export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  let body: { email?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.full_name ?? "").trim();
  const role = (body.role ?? "admin") as Role;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: `Role must be one of: ${ROLES.join(", ")}.` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("admin_users")
      .insert({ email, full_name: fullName, role, active: true });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "An admin with that email already exists." }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "POST /api/admin/admins" });
  }
}

/** PATCH { id, active? , role? } — owner-only */
export async function PATCH(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  let body: { id?: string; active?: boolean; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const patch: { active?: boolean; role?: Role } = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.role) {
    if (!ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: `Role must be one of: ${ROLES.join(", ")}.` }, { status: 400 });
    }
    patch.role = body.role as Role;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("admin_users").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/admins" });
  }
}
