import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminContext } from "@/lib/auth/guards";

/**
 * Write a review_actions audit row — the Audit log page is the source of
 * truth for who did what, when. Best-effort: a failed audit insert is
 * logged but never blocks the admin action itself.
 */
export async function writeAudit(
  guard: Pick<AdminContext, "adminId" | "email">,
  targetType:
    | "waitlist_signup"
    | "expert_application"
    | "partner_application"
    | "member"
    | "admin_user"
    | "hotline_request"
    | "vendor_deal"
    | "expert_kit",
  targetId: string | null,
  action: string,
  note?: string,
) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("review_actions").insert({
      target_type: targetType,
      target_id: targetId,
      action,
      note: note || null,
      admin_id: guard.adminId,
      admin_email: guard.email,
    });
  } catch (err) {
    console.error("[audit] insert failed:", err);
  }
}
