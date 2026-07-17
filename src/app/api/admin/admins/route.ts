import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { isValidEmail, asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["owner", "admin", "reviewer", "support"];

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, active, last_active_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — add an admin (owner only). */
export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = asString(body.email).toLowerCase();
  const fullName = asString(body.fullName);
  const role = asString(body.role) || "admin";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Use a valid email address." }, { status: 400 });
  }
  if (fullName.length < 1 || fullName.length > 120) {
    return NextResponse.json({ error: "Enter a full name." }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("admin_users")
      .insert({ email, full_name: fullName, role, active: true });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That email is already an admin." }, { status: 409 });
      }
      throw error;
    }
    await writeAudit(guard, "admin_user", null, "add", `${email} (${role})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — activate/deactivate an admin (owner only). */
export async function PATCH(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;

  let body: { id?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "id and active are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Never let the last active owner deactivate themselves.
    if (body.active === false) {
      const { data: target } = await supabase
        .from("admin_users")
        .select("id, role")
        .eq("id", body.id)
        .maybeSingle();
      if (target?.role === "owner") {
        const { data: owners } = await supabase
          .from("admin_users")
          .select("id")
          .eq("role", "owner")
          .eq("active", true);
        if ((owners ?? []).length <= 1) {
          return NextResponse.json(
            { error: "Cannot deactivate the last active owner." },
            { status: 400 },
          );
        }
      }
    }

    const { error } = await supabase
      .from("admin_users")
      .update({ active: body.active })
      .eq("id", body.id);
    if (error) throw error;
    await writeAudit(guard, "admin_user", body.id, body.active ? "activate" : "deactivate");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
