import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type NetworkAuthorKind = "member" | "expert" | "partner" | "admin";

export type NetworkAuthor = {
  authUserId: string;
  kind: NetworkAuthorKind;
  displayName: string;
  rowId: string;
};

/**
 * Resolve which portal role a signed-in user reads/reacts/comments as on
 * the Network feed. Priority: expert > partner > member > admin — the
 * same live-record gate requirePortal*() uses (approved/active only),
 * first match wins. Only experts and partners can author posts today
 * (see 0024_network_feed.sql), but all four kinds can react and comment.
 */
export async function resolveNetworkAuthor(
  authUserId: string,
  email: string | null,
): Promise<NetworkAuthor | null> {
  if (!email) return null;
  const supabase = getSupabaseAdmin();
  const lower = email.toLowerCase();

  const { data: expert } = await supabase
    .from("expert_applications")
    .select("id, full_name, display_name, status")
    .ilike("email", lower)
    .maybeSingle();
  if (expert && expert.status === "approved") {
    return {
      authUserId,
      kind: "expert",
      displayName: (expert.display_name as string) || (expert.full_name as string) || "Network expert",
      rowId: expert.id as string,
    };
  }

  const { data: partner } = await supabase
    .from("partner_applications")
    .select("id, company_name, display_name, status")
    .ilike("contact_email", lower)
    .maybeSingle();
  if (partner && partner.status === "approved") {
    return {
      authUserId,
      kind: "partner",
      displayName: (partner.display_name as string) || (partner.company_name as string) || "Network partner",
      rowId: partner.id as string,
    };
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name, status")
    .ilike("email", lower)
    .maybeSingle();
  if (member && member.status === "active") {
    return {
      authUserId,
      kind: "member",
      displayName: `${(member.first_name as string) ?? ""} ${(member.last_name as string) ?? ""}`.trim() || "Member",
      rowId: member.id as string,
    };
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, full_name, active")
    .ilike("email", lower)
    .maybeSingle();
  if (admin && admin.active) {
    return {
      authUserId,
      kind: "admin",
      displayName: (admin.full_name as string) || "ASN team",
      rowId: admin.id as string,
    };
  }

  return null;
}
