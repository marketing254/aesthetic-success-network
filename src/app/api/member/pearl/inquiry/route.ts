import { NextResponse } from "next/server";
import { MEMBER_LAUNCH_ENABLED, MEMBER_LAUNCH_MESSAGE } from "@/lib/launch";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { deliverInquiryPack } from "@/lib/inquiry/deliverPack";
import { notifyInquirySlack } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF render + storage upload + email can take a few seconds.
export const maxDuration = 60;

/**
 * POST /api/member/pearl/inquiry
 *
 * Files a member inquiry when Beacon escalates a question to the team.
 * Records the question + the email to reach the member at, at status
 * "pending". The team works it within the 2–3 business-day SLA.
 *
 * Phase 2/3 (TODO) will, right after the insert: generate the "everything
 * ASN offers" PDF pack, email it (from support@aestheticsuccessnetwork.com,
 * reply-to support@), drop it in the member's in-portal Inbox, and ping
 * #asn-inquiries in Slack. For now the row is the source of truth and the
 * admin Hotline page surfaces it.
 */

const MAX_QUESTION_CHARS = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!MEMBER_LAUNCH_ENABLED) {
    return NextResponse.json({ error: MEMBER_LAUNCH_MESSAGE }, { status: 403 });
  }
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;
  const route = "POST /api/member/pearl/inquiry";

  // Every inquiry renders a PDF, uploads it, emails it and pings Slack —
  // cap per member (5 per 10 min) so one account can't run the pipeline
  // in a loop.
  const rl = await checkRateLimit(`pearl-inquiry:${guard.memberId}`);
  if (!rl.allowed) return apiError.rateLimited(route);

  let body: { question?: string; email?: string };
  try {
    body = (await req.json()) as { question?: string; email?: string };
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }

  const question = (body.question ?? "").trim();
  if (question.length < 1) return apiError.badRequest("Add your question first.", route);
  if (question.length > MAX_QUESTION_CHARS) {
    return apiError.badRequest(`Question is too long (max ${MAX_QUESTION_CHARS}).`, route);
  }

  // Default to the signed-in member's email; allow them to override with a
  // different reply-to address if they typed one.
  const email = (body.email?.trim() || guard.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return apiError.badRequest("That email doesn't look right.", route);

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("member_inquiries")
      .insert({
        member_id: guard.memberId,
        email,
        question,
        status: "pending",
        source: "pearl",
      })
      .select("id")
      .single();
    if (error) return serverError(error, { route, extra: { stage: "insert" } });

    // Fire the pack (PDF → storage → email) and the Slack ping. Both are
    // best-effort: the inquiry row already exists, so a failure here still
    // leaves the team a record to act on. Run concurrently.
    const [pack] = await Promise.all([
      deliverInquiryPack({ inquiryId: data.id, memberName: guard.firstName, email, question }),
      notifyInquirySlack({ memberName: guard.firstName, email, question }).then((ts) => {
        if (ts) return sb.from("member_inquiries").update({ slack_ts: ts }).eq("id", data.id);
        return null;
      }),
    ]);

    return NextResponse.json({ ok: true, id: data.id, emailed: pack.emailed });
  } catch (err) {
    return serverError(err, { route });
  }
}
