import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expert/conversations
 *
 * Returns the signed-in expert's chatbot conversations with members,
 * newest-active first. The conversation row carries the running summary
 * (member name, message count, last-message timestamps, status); the
 * detail view fetches the message thread from /api/network/experts/...
 * once the expert clicks in.
 */
export async function GET() {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("chatbot_conversations")
      .select(
        "id, member_auth_user_id, member_display_name, status, message_count, last_message_at, last_member_message_at, last_bot_message_at, last_expert_message_at, created_at",
      )
      .eq("expert_id", guard.expertId)
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/conversations" });
  }
}
