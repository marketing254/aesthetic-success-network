import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidMember } from "@/lib/auth/guards";
import {
  ASSISTANT_MAX_TOKENS,
  ASSISTANT_MODEL,
  buildAssistantSystemPrompt,
  getOpenAI,
} from "@/lib/ai/assistant";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Streaming responses can run longer than the default 10s edge limit.
export const maxDuration = 60;

/** Maximum messages from history to send the model on each turn. */
const HISTORY_WINDOW = 20;
/** User messages allowed per member per rolling 24h. */
const DAILY_USER_LIMIT = 30;
/** Hard cap on incoming message length to prevent runaway tokens. */
const MAX_USER_MESSAGE_CHARS = 4000;

/**
 * GET /api/member/assistant/messages
 *
 * Returns the signed-in member's prior conversation, oldest first.
 * The widget loads this on first open so the chat shows where the
 * member left off across sessions.
 */
export async function GET() {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("member_assistant_messages")
    .select("id, role, content, created_at")
    .eq("member_id", guard.memberId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return serverError(error, { route: "GET /api/member/assistant/messages" });
  }
  return NextResponse.json({ messages: data ?? [] });
}

/**
 * POST /api/member/assistant/messages
 *
 * Body: { content: string }
 * Response: text/plain stream — each chunk is the next bit of the assistant
 * reply. The full assistant message is also persisted to the DB once the
 * stream completes.
 */
export async function POST(req: Request) {
  const guard = await requirePaidMember();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const raw = typeof body.content === "string" ? body.content.trim() : "";

  if (!raw) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }
  if (raw.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message is too long (${raw.length} chars, max ${MAX_USER_MESSAGE_CHARS}).` },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();

  // ---- 1. Rate limit (user messages in last 24h) ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await sb
    .from("member_assistant_messages")
    .select("id", { head: true, count: "exact" })
    .eq("member_id", guard.memberId)
    .eq("role", "user")
    .gte("created_at", since);

  if ((recentCount ?? 0) >= DAILY_USER_LIMIT) {
    return NextResponse.json(
      {
        error: `You've hit your daily limit of ${DAILY_USER_LIMIT} assistant messages. Try again tomorrow or email members@aestheticsuccessnetwork.com.`,
      },
      { status: 429 },
    );
  }

  // ---- 2. Persist the user message before we call the model, so a crash
  //         halfway through doesn't lose what the member typed.
  const { error: insErr } = await sb.from("member_assistant_messages").insert({
    member_id: guard.memberId,
    role: "user",
    content: raw,
  });
  if (insErr) {
    return serverError(insErr, { route: "POST /api/member/assistant/messages" });
  }

  // ---- 3. Pull recent history (capped at HISTORY_WINDOW) ----
  const { data: history } = await sb
    .from("member_assistant_messages")
    .select("role, content")
    .eq("member_id", guard.memberId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);

  const ordered = (history ?? []).slice().reverse();
  type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
  const historyMessages: ChatMessage[] = [];
  for (const m of ordered) {
    if (m.role === "user" || m.role === "assistant") {
      historyMessages.push({ role: m.role, content: m.content });
    }
  }

  // ---- 4. Build the system prompt with the live resource catalog ----
  let systemPrompt: string;
  try {
    systemPrompt = await buildAssistantSystemPrompt({
      firstName: guard.firstName,
      tier: null, // CurrentMember.tier isn't on the guard yet — defaults to "member" voice
      status: guard.status,
    });
  } catch (err) {
    return serverError(err, { route: "POST /api/member/assistant/messages", status: 503 });
  }

  // ---- 5. Stream the assistant response from OpenAI ----
  let openai;
  try {
    openai = getOpenAI();
  } catch (err) {
    return serverError(err, { route: "POST /api/member/assistant/messages", status: 503 });
  }

  const encoder = new TextEncoder();
  let fullText = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: ASSISTANT_MODEL,
          max_tokens: ASSISTANT_MAX_TOKENS,
          temperature: 0.4,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
          // Usage stats arrive on the final chunk when stream_options is set
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
            outputTokens = chunk.usage.completion_tokens ?? outputTokens;
          }
        }

        // Persist the assistant message (best effort — the stream already
        // delivered the content to the client).
        if (fullText.trim()) {
          try {
            await sb.from("member_assistant_messages").insert({
              member_id: guard.memberId,
              role: "assistant",
              content: fullText,
              tokens_input: inputTokens,
              tokens_output: outputTokens,
            });
          } catch {
            /* swallow — content already streamed */
          }
        }
        controller.close();
      } catch (err) {
        console.error("[api:error] POST /api/member/assistant/messages (stream)", err);
        controller.enqueue(
          encoder.encode("\n\n[assistant error: the assistant hit a problem. Please try again.]"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
