import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import type { MemberInquiryStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin triage for Beacon inquiries (member escalations from the portal
 * assistant). Backs /admin/hotline.
 *   GET   → all inquiries, newest first, with the member's name resolved.
 *   PATCH → { id, action } to move status / add a note.
 */

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const sb = getSupabaseAdmin();
    const { data: rows, error } = await sb
      .from("member_inquiries")
      .select("id, member_id, email, question, status, pdf_url, pdf_sent_at, admin_note, resolved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    const memberIds = Array.from(new Set((rows ?? []).map((r) => r.member_id)));
    const nameById = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: members } = await sb
        .from("members")
        .select("id, first_name, last_name")
        .in("id", memberIds);
      for (const m of members ?? []) {
        nameById.set(m.id, [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || "(member)");
      }
    }

    return NextResponse.json({
      inquiries: (rows ?? []).map((r) => ({ ...r, member_name: nameById.get(r.member_id) ?? "(member)" })),
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/hotline" });
  }
}

const ACTION_STATUS: Record<string, MemberInquiryStatus> = {
  start: "in_progress",
  resolve: "resolved",
  close: "closed",
  reopen: "pending",
};

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "PATCH /api/admin/hotline";

  let b: { id?: string; action?: string; note?: string };
  try {
    b = (await req.json()) as { id?: string; action?: string; note?: string };
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }
  if (!b.id) return apiError.badRequest("Missing id.", route);

  const sb = getSupabaseAdmin();
  try {
    if (b.action === "note") {
      await sb.from("member_inquiries").update({ admin_note: (b.note ?? "").slice(0, 2000) || null }).eq("id", b.id);
      return NextResponse.json({ ok: true });
    }
    const status = b.action ? ACTION_STATUS[b.action] : undefined;
    if (!status) return apiError.badRequest("Unknown action.", route);

    const resolving = status === "resolved" || status === "closed";
    await sb
      .from("member_inquiries")
      .update({
        status,
        resolved_by: resolving ? guard.adminId : null,
        resolved_at: resolving ? new Date().toISOString() : null,
      })
      .eq("id", b.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}
