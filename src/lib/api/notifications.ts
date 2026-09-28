import "server-only";
import type { getSupabaseAdmin } from "@/lib/supabase/server";

type SB = ReturnType<typeof getSupabaseAdmin>;

/**
 * Insert one or more `notifications` rows and LOG a failure instead of
 * discarding it. Notifications are best-effort (a failed insert must never
 * fail the request that produced it), but a silent failure hides schema
 * drift, which is exactly how the audience/FK mismatch went unnoticed in
 * the original codebase.
 *
 * Rows may carry `expert_id` / `member_id` / `vendor_id` / `admin_id`, or
 * only `recipient_auth_user_id` (migration 0068 fills the FK from it).
 * Typed loosely because the generated Database types are owned by the
 * schema agent and may lag the migration.
 */
export async function insertNotification(
  sb: SB,
  rows: Record<string, unknown> | Record<string, unknown>[],
  context = "notifications",
): Promise<boolean> {
  try {
    const { error } = await sb.from("notifications").insert(rows as never);
    if (error) {
      console.error(`[${context}] notification insert failed:`, error.message, { rows });
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${context}] notification insert threw:`, err);
    return false;
  }
}
