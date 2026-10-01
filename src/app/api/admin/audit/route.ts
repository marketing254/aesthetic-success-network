import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit
 *
 * Merged feed of review_actions + auth_audit, sorted by created_at desc.
 * Returns max 100 most recent entries. Admin-gated.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();

    const [actions, audit] = await Promise.all([
      supabase
        .from("review_actions")
        .select("id, target_type, target_id, action, note, admin_id, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("auth_audit")
        .select("id, event, email, user_type, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    if (actions.error) throw actions.error;
    if (audit.error) throw audit.error;

    type Entry = {
      id: string;
      source: "review" | "auth";
      action: string;
      target: string;
      who: string;
      created_at: string;
    };

    const entries: Entry[] = [
      ...(actions.data ?? []).map(
        (a): Entry => ({
          id: `r-${a.id}`,
          source: "review",
          action: a.action,
          target: `${a.target_type}: ${a.target_id.slice(0, 8)}${a.note ? ` — ${a.note}` : ""}`,
          who: a.admin_id ? a.admin_id.slice(0, 8) : "system",
          created_at: a.created_at,
        }),
      ),
      ...(audit.data ?? []).map(
        (a): Entry => ({
          id: `a-${a.id}`,
          source: "auth",
          action: a.event,
          target: a.email ?? "",
          who: a.user_type ?? "—",
          created_at: a.created_at,
        }),
      ),
    ]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 100);

    return NextResponse.json({ rows: entries });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/audit" });
  }
}
