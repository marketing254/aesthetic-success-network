import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { sendHotlineAssignedEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/hotline — the full triage queue. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("hotline_requests")
      .select(
        "id, member_email, subject, category, details, urgency, status, assigned_expert_id, assigned_at, assigned_by, answered_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/hotline
 * Body: { id, action: "assign" | "unassign" | "close" | "reopen", expertId? }
 *
 * Routing a request is the one manual step in the Hotline loop: a human
 * picks which expert should answer, then the expert is emailed.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const id = asString(body.id);
  const action = asString(body.action);
  const expertId = asString(body.expertId);
  const allowed = ["assign", "unassign", "close", "reopen"];
  if (!id || !allowed.includes(action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: request, error: reqErr } = await supabase
      .from("hotline_requests")
      .select("id, subject, urgency, status, answered_at")
      .eq("id", id)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    const now = new Date().toISOString();

    if (action === "assign") {
      if (!expertId) {
        return NextResponse.json({ error: "Pick an expert to route this to." }, { status: 400 });
      }
      const { data: expert } = await supabase
        .from("expert_applications")
        .select("id, full_name, email, status")
        .eq("id", expertId)
        .maybeSingle();
      if (!expert || expert.status !== "approved") {
        return NextResponse.json({ error: "That expert isn't approved." }, { status: 400 });
      }

      const { error } = await supabase
        .from("hotline_requests")
        .update({
          assigned_expert_id: expertId,
          assigned_at: now,
          assigned_by: guard.email,
          // Re-routing an answered request puts it back in the expert's queue.
          status: "assigned",
        })
        .eq("id", id);
      if (error) throw error;

      await sendHotlineAssignedEmail(
        expert.email as string,
        expert.full_name as string,
        request.subject as string,
        id,
        request.urgency as string,
      );
      await writeAudit(guard, "hotline_request", id, "assign", `to ${expert.email as string}`);
      return NextResponse.json({ ok: true });
    }

    if (action === "unassign") {
      const { error } = await supabase
        .from("hotline_requests")
        .update({ assigned_expert_id: null, assigned_at: null, assigned_by: null, status: "submitted" })
        .eq("id", id);
      if (error) throw error;
      await writeAudit(guard, "hotline_request", id, "unassign");
      return NextResponse.json({ ok: true });
    }

    if (action === "close") {
      const { error } = await supabase
        .from("hotline_requests")
        .update({ status: "closed", closed_at: now })
        .eq("id", id);
      if (error) throw error;
      await writeAudit(guard, "hotline_request", id, "close");
      return NextResponse.json({ ok: true });
    }

    // reopen — back to whichever state the history supports
    const { error } = await supabase
      .from("hotline_requests")
      .update({
        status: request.answered_at ? "answered" : "submitted",
        closed_at: null,
      })
      .eq("id", id);
    if (error) throw error;
    await writeAudit(guard, "hotline_request", id, "reopen");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin:hotline] update failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
