import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 8000;

/**
 * GET /api/network/experts/[id]/chat
 *
 * Returns the message history of the signed-in viewer's conversation
 * with this expert, oldest first. Creates the conversation if it
 * doesn't exist yet (so the client gets a stable conversation_id on
 * first load).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: expertId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return NextResponse.json({ error: "No network profile." }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Confirm the expert exists.
    const { data: expert } = await admin
      .from("experts")
      .select("id, display_name, full_name, specialty, headshot_url")
      .eq("id", expertId)
      .maybeSingle();
    if (!expert) {
      return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    }

    // Find-or-create conversation.
    const { data: existing } = await admin
      .from("chatbot_conversations")
      .select("*")
      .eq("expert_id", expertId)
      .eq("member_auth_user_id", author.authUserId)
      .maybeSingle();

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin
        .from("chatbot_conversations")
        .insert({
          expert_id: expertId,
          member_auth_user_id: author.authUserId,
          member_display_name: author.displayName,
          status: "open",
        })
        .select("id")
        .single();
      if (createErr) throw createErr;
      conversationId = created.id;
    }

    // Fetch messages.
    const { data: messages, error: msgErr } = await admin
      .from("chatbot_messages")
      .select("id, role, content, created_at, bot_provider, bot_model")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (msgErr) throw msgErr;

    return NextResponse.json({
      conversation_id: conversationId,
      expert: {
        id: expert.id,
        name: expert.display_name || expert.full_name,
        specialty: expert.specialty,
        headshot_url: expert.headshot_url,
      },
      messages: messages ?? [],
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/network/experts/[id]/chat" });
  }
}

/**
 * POST /api/network/experts/[id]/chat
 *
 * Body: { content: string }
 * Sends a member message and returns a bot reply. Right now the bot
 * reply is a CANNED ACKNOWLEDGEMENT — we record it as role='bot' with
 * bot_provider='stub' so the UI is fully testable and we can switch on
 * a real LLM later by changing only this function.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: expertId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return NextResponse.json({ error: "No network profile." }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (content.length < 1 || content.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message must be 1–${MAX_MESSAGE} characters.` },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdmin();

    // Resolve expert + conversation.
    const { data: expert } = await admin
      .from("experts")
      .select("id, display_name, full_name")
      .eq("id", expertId)
      .maybeSingle();
    if (!expert) {
      return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    }

    const { data: existing } = await admin
      .from("chatbot_conversations")
      .select("id")
      .eq("expert_id", expertId)
      .eq("member_auth_user_id", author.authUserId)
      .maybeSingle();

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin
        .from("chatbot_conversations")
        .insert({
          expert_id: expertId,
          member_auth_user_id: author.authUserId,
          member_display_name: author.displayName,
          status: "open",
        })
        .select("id")
        .single();
      if (createErr) throw createErr;
      conversationId = created.id;
    }

    // Persist the member message.
    const { data: memberMessage, error: memberErr } = await admin
      .from("chatbot_messages")
      .insert({
        conversation_id: conversationId,
        role: "member",
        content,
      })
      .select("id, role, content, created_at")
      .single();
    if (memberErr) throw memberErr;

    // ─────────────────────────────────────────────────────────────────
    // STUB BOT REPLY — replace with LLM call in a follow-up turn.
    // The real implementation will:
    //   1. Pull the expert's resources + recent posts as RAG context
    //   2. Construct a system prompt that grounds the bot in those docs
    //   3. Call the chosen LLM (Claude / OpenAI) with the conversation
    //   4. If the bot can't answer with confidence, set status =
    //      'escalated' so the expert sees it in their inbox
    // ─────────────────────────────────────────────────────────────────
    const expertName = (expert.display_name || expert.full_name || "the expert").split(/\s+/)[0];
    const botContent =
      `Hi! I'm ${expertName}'s AI helper. I've passed your question along. Once full AI is enabled I'll answer here directly. In the meantime, ${expertName} will see this in their inbox and follow up if it's a fit. ` +
      `(For now I'm responding as a placeholder so the team can test the flow.)`;

    const startedAt = Date.now();
    const { data: botMessage, error: botErr } = await admin
      .from("chatbot_messages")
      .insert({
        conversation_id: conversationId,
        role: "bot",
        content: botContent,
        bot_provider: "stub",
        bot_model: "canned-v1",
        bot_latency_ms: Date.now() - startedAt,
      })
      .select("id, role, content, created_at, bot_provider, bot_model")
      .single();
    if (botErr) throw botErr;

    return NextResponse.json({
      ok: true,
      conversation_id: conversationId,
      messages: [memberMessage, botMessage],
    });
  } catch (err) {
    return serverError(err, { route: "POST /api/network/experts/[id]/chat" });
  }
}
