import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkBillingAccess } from "@/lib/stripe";
import type { NetworkAuthorKind } from "@/lib/supabase/types";

export type NetworkAuthor = {
  authUserId: string;
  kind: NetworkAuthorKind;
  displayName: string;
  subtitle: string | null;
  // The role-specific row id (expert_id / member_id / vendor_id / admin_id)
  // when we need to scope writes (e.g. expert posting from THEIR experts row).
  roleId: string | null;
};

/**
 * Look up a signed-in auth user's network identity. Priority:
 *   1. expert  (their workspace persona)
 *   2. partner (vendor)
 *   3. member  (active member)
 *   4. admin
 *
 * Returns null if the user isn't a recognized participant in the network
 * (e.g. session exists but they're not in any role table).
 *
 * Used by every network API that records or reads identity-stamped data
 * (posts, reactions, comments, chatbot conversations).
 */
export async function resolveNetworkAuthor(
  authUserId: string,
  email: string | null,
): Promise<NetworkAuthor | null> {
  const admin = getSupabaseAdmin();
  const lowerEmail = (email ?? "").toLowerCase();

  // 1. Expert? — primary identity for anyone in the experts table.
  //    Billing-gated: an expert with no active subscription (and no
  //    founding waiver) has no network identity until they add a card.
  {
    const { data } = await admin
      .from("experts")
      .select("id, display_name, full_name, specialty, status, billing_exempt, months_in_program, subscription_status, stripe_subscription_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (data && data.status !== "archived" && data.status !== "suspended") {
      const access = checkBillingAccess({
        monthsInProgram: data.months_in_program ?? 0,
        subscriptionStatus: data.subscription_status ?? null,
        hasSubscription: !!data.stripe_subscription_id,
        billingExempt: !!data.billing_exempt,
      });
      // Unpaid expert: no expert identity — fall through in case they're
      // also a paying member/partner under the same account.
      if (access.allowed) {
        return {
          authUserId,
          kind: "expert",
          displayName: data.display_name || data.full_name,
          subtitle: data.specialty,
          roleId: data.id,
        };
      }
    }
  }

  // 2. Partner (vendor)? — billing-gated like experts; covered companies
  //    (billing_parent_id) inherit the paying parent's subscription.
  if (lowerEmail) {
    const { data } = await admin
      .from("vendors")
      .select("id, display_name, company_name, category, status, billing_parent_id, months_in_program, subscription_status, stripe_subscription_id")
      .eq("contact_email", lowerEmail)
      .maybeSingle();
    if (
      data &&
      data.status !== "rejected" &&
      data.status !== "suspended" &&
      data.status !== "churned"
    ) {
      let billing = {
        monthsInProgram: data.months_in_program ?? 0,
        subscriptionStatus: data.subscription_status ?? null,
        hasSubscription: !!data.stripe_subscription_id,
      };
      if (data.billing_parent_id) {
        const { data: parent } = await admin
          .from("vendors")
          .select("months_in_program, subscription_status, stripe_subscription_id")
          .eq("id", data.billing_parent_id)
          .maybeSingle();
        billing = {
          monthsInProgram: parent?.months_in_program ?? 0,
          subscriptionStatus: parent?.subscription_status ?? null,
          hasSubscription: !!parent?.stripe_subscription_id,
        };
      }
      // Unpaid partner: fall through in case they're also an active member.
      if (checkBillingAccess(billing).allowed) {
        return {
          authUserId,
          kind: "partner",
          displayName: data.display_name || data.company_name,
          subtitle: data.category,
          roleId: data.id,
        };
      }
    }
  }

  // 3. Active member?
  {
    const { data } = await admin
      .from("members")
      .select("id, first_name, last_name, practice_name, city, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (data && data.status === "active") {
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      const subtitle = data.practice_name
        ? data.practice_name
        : data.city || null;
      return {
        authUserId,
        kind: "member",
        displayName: fullName || "Member",
        subtitle,
        roleId: data.id,
      };
    }
  }

  // 4. Admin?
  if (lowerEmail) {
    const { data } = await admin
      .from("admin_users")
      .select("id, full_name, role, active")
      .eq("email", lowerEmail)
      .maybeSingle();
    if (data?.active) {
      return {
        authUserId,
        kind: "admin",
        displayName: data.full_name || "Admin",
        subtitle: data.role,
        roleId: data.id,
      };
    }
  }

  return null;
}
