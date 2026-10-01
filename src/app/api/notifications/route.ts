import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Audiences the notifications table accepts (migration 0068). */
const AUDIENCES = new Set(["vendor", "admin", "expert", "member"]);
function isAudience(v: unknown): v is "vendor" | "admin" | "expert" | "member" {
  return typeof v === "string" && AUDIENCES.has(v);
}

/**
 * GET /api/notifications?audience=vendor|admin|expert|member&limit=20
 *
 * Returns the most recent notifications for the signed-in user. Relies
 * on RLS: a vendor/expert/member sees only their own rows (by FK or
 * recipient_auth_user_id), an admin sees all admin-audience rows.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const audience = url.searchParams.get("audience");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));

  if (!isAudience(audience)) {
    return NextResponse.json(
      { error: "audience must be one of vendor, admin, expert or member." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, audience, kind, title, body, link, read_at, created_at, metadata")
      .eq("audience", audience)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/notifications" });
  }
}

/**
 * PATCH /api/notifications
 * Body: { id: string, action: 'mark_read' }
 *      | { audience: 'vendor'|'admin'|'expert'|'member', action: 'mark_all_read' }
 */
export async function PATCH(req: Request) {
  let body: { id?: string; audience?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    // Use service role here — RLS makes mark-read multi-row updates awkward
    // because the cookie-bound client also needs the user lookup. We trust
    // the audience+id, and only the API caller has gotten this far.
    const supabase = getSupabaseAdmin();
    const cookieClient = await createServerSupabase();
    const { data: who } = await cookieClient.auth.getUser();
    if (!who?.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    if (body.action === "mark_read" && body.id) {
      // Confirm the row is visible to this user before updating.
      const { data: visible } = await cookieClient
        .from("notifications")
        .select("id")
        .eq("id", body.id)
        .maybeSingle();
      if (!visible) {
        return NextResponse.json({ error: "Notification not found." }, { status: 404 });
      }
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "mark_all_read" && isAudience(body.audience)) {
      // Pull the user's currently-visible unread rows under RLS, then bulk-update.
      const { data: visible } = await cookieClient
        .from("notifications")
        .select("id")
        .eq("audience", body.audience)
        .is("read_at", null)
        .limit(500);
      const ids = (visible ?? []).map((r) => r.id);
      if (ids.length) {
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true, count: ids.length });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/notifications" });
  }
}
