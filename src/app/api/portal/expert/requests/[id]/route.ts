import { NextResponse } from "next/server";
import { requirePortalExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { notifyTeam, sendHotlineAnsweredEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal/expert/requests/[id]
 * Body: { action: "save" | "submit", summary, actionPlan }
 *
 * Writes the expert's action plan for a request assigned to them.
 * "save" keeps it a draft (invisible to the member); "submit" publishes
 * it, flips the request to `answered`, and emails the member.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalExpert();
  if (!guard.ok) return guard.response;

  const { id: requestId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;

  const action = asString(b.action) === "submit" ? "submit" : "save";
  const summary = asString(b.summary);
  const actionPlan = asString(b.actionPlan);

  if (action === "submit") {
    if (summary.length < 10 || summary.length > 300) {
      return NextResponse.json(
        { error: "The short answer should be 10–300 characters.", field: "summary" },
        { status: 400 },
      );
    }
    if (actionPlan.length < 80) {
      return NextResponse.json(
        { error: "An action plan needs at least 80 characters — give the member steps they can act on.", field: "actionPlan" },
        { status: 400 },
      );
    }
  }
  if (summary.length > 300 || actionPlan.length > 20000) {
    return NextResponse.json({ error: "That's longer than the field allows." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Scope check: the request must be assigned to THIS expert.
    const { data: request, error: reqErr } = await supabase
      .from("hotline_requests")
      .select("id, member_email, subject, status, assigned_expert_id")
      .eq("id", requestId)
      .eq("assigned_expert_id", guard.rowId)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!request) {
      return NextResponse.json({ error: "That request isn't assigned to you." }, { status: 404 });
    }
    if (request.status === "closed") {
      return NextResponse.json({ error: "That request is closed." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: upsertErr } = await supabase.from("hotline_responses").upsert(
      {
        request_id: requestId,
        expert_id: guard.rowId,
        expert_email: guard.email,
        summary,
        action_plan: actionPlan,
        status: action === "submit" ? "submitted" : "draft",
        submitted_at: action === "submit" ? now : null,
        updated_at: now,
      },
      { onConflict: "request_id,expert_id" },
    );
    if (upsertErr) throw upsertErr;

    if (action !== "submit") {
      return NextResponse.json({ ok: true, status: "draft" });
    }

    const { error: statusErr } = await supabase
      .from("hotline_requests")
      .update({ status: "answered", answered_at: now })
      .eq("id", requestId);
    if (statusErr) throw statusErr;

    // Member notification — look up their first name for the greeting.
    const { data: member } = await supabase
      .from("members")
      .select("first_name")
      .ilike("email", request.member_email as string)
      .maybeSingle();

    await sendHotlineAnsweredEmail(
      request.member_email as string,
      (member?.first_name as string) ?? "",
      request.subject as string,
      requestId,
    );
    await notifyTeam("Hotline action plan delivered", [
      ["Expert", guard.email],
      ["Member", request.member_email as string],
      ["Subject", request.subject as string],
      ["Request ID", requestId],
    ]);

    return NextResponse.json({ ok: true, status: "submitted" });
  } catch (err) {
    console.error("[portal:expert:response] failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
