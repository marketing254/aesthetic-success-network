import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { appendAssistantMessage, listAssistantMessages } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 2000;

/**
 * GET/POST /api/portal/member/assistant — member-portal AI concierge.
 *
 * STUB: no LLM is wired up (no OPENAI_API_KEY configured for ASN yet).
 * The user's message is saved for history continuity and a canned reply
 * is returned instead of a real completion. Wiring a real model means
 * adding OPENAI_API_KEY and replacing CANNED_REPLY below with a call to
 * an LLM using the member's message + portal context — the message
 * history table (member_assistant_messages, migration 0027) is already
 * shaped to support that.
 */
const CANNED_REPLY =
  "Thanks for the question! Our AI concierge isn't switched on yet — for now, the fastest way to get a real answer is the Expert Hotline (you'll get a written action plan from a vetted expert in 2–3 business days). Head to Dashboard → Expert Hotline → Ask a question.";

export async function GET() {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;
  try {
    const messages = await listAssistantMessages(guard.rowId);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = (body.content ?? "").trim();
  if (content.length < 1 || content.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Message must be 1-${MAX_MESSAGE_CHARS} characters.` }, { status: 400 });
  }

  try {
    await appendAssistantMessage(guard.rowId, "user", content);
    await appendAssistantMessage(guard.rowId, "assistant", CANNED_REPLY);
    return NextResponse.json({ ok: true, reply: CANNED_REPLY });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
