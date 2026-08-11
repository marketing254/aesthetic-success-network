import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/forms/rateLimit";
import { asString, clientIp } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { notifyTeam, sendHotlineReceivedEmail } from "@/lib/email/templates";
import { resolvePortalRoles } from "@/lib/auth/portal";
import { HOTLINE_CATEGORIES } from "@/lib/portal/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/portal/member/hotline — the member's own requests. */
export async function GET() {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("hotline_requests")
      .select("id, subject, category, urgency, status, created_at, answered_at")
      .eq("member_id", guard.rowId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/portal/member/hotline — submit a new Hotline question.
 * Lands as `submitted`; an admin routes it to an expert from the console.
 */
export async function POST(req: Request) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;

  const subject = asString(b.subject);
  const category = asString(b.category);
  const details = asString(b.details);
  const urgency = asString(b.urgency) === "urgent" ? "urgent" : "standard";

  if (subject.length < 4 || subject.length > 160) {
    return NextResponse.json(
      { error: "Give your question a subject between 4 and 160 characters.", field: "subject" },
      { status: 400 },
    );
  }
  if (details.length < 20 || details.length > 5000) {
    return NextResponse.json(
      { error: "Describe the situation in 20–5000 characters so the expert has enough to work with.", field: "details" },
      { status: 400 },
    );
  }
  if (category && !(HOTLINE_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Pick a category from the list.", field: "category" }, { status: 400 });
  }

  // One member can't flood the queue.
  const rl = checkRateLimit(`hotline:${clientIp(req)}:${guard.email}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "You've submitted several questions just now. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("hotline_requests")
      .insert({
        member_id: guard.rowId,
        member_email: guard.email,
        subject,
        category: category || null,
        details,
        urgency,
        status: "submitted",
      })
      .select("id, created_at")
      .single();
    if (error) throw error;

    const identity = await resolvePortalRoles(guard.email);
    const firstName = identity.member?.firstName ?? "";

    await sendHotlineReceivedEmail(guard.email, firstName, subject, data.id as string);
    await notifyTeam("New Expert Hotline request", [
      ["Member", `${firstName} (${guard.email})`],
      ["Practice", identity.member?.practiceName ?? ""],
      ["Subject", subject],
      ["Category", category],
      ["Urgency", urgency],
      ["Request ID", data.id as string],
    ]);

    return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
  } catch (err) {
    console.error("[portal:hotline] insert failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
