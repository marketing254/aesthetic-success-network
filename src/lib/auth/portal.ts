import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";

/**
 * Portal role resolution.
 *
 * One email can hold more than one role (a member who is also an
 * approved expert, for example), so sign-in resolves all of them and the
 * portal shell offers a switcher. A role only counts when the underlying
 * record is live: members must be `active`, experts and partners must be
 * `approved` — the same rule the middleware gate and the requirePortal*()
 * guards enforce.
 */

export type PortalRoleName = "member" | "expert" | "partner";

export type MemberRole = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  practiceName: string | null;
  tier: string;
};

export type ExpertRole = {
  id: string;
  email: string;
  fullName: string;
  company: string | null;
};

export type PartnerRole = {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  category: string | null;
};

export type PortalIdentity = {
  email: string;
  member: MemberRole | null;
  expert: ExpertRole | null;
  partner: PartnerRole | null;
  roles: PortalRoleName[];
};

/** Landing route for each portal. */
export const PORTAL_HOME: Record<PortalRoleName, string> = {
  member: "/dashboard",
  expert: "/expert",
  partner: "/vendor",
};

/**
 * Look up every live portal role for an email. Never throws on a missing
 * row — an email with no roles simply comes back with `roles: []`.
 */
export async function resolvePortalRoles(emailRaw: string): Promise<PortalIdentity> {
  const email = emailRaw.trim().toLowerCase();
  const admin = getSupabaseAdmin();

  const [memberRes, expertRes, partnerRes] = await Promise.all([
    admin
      .from("members")
      .select("id, email, first_name, last_name, practice_name, tier, status")
      .ilike("email", email)
      .maybeSingle(),
    admin
      .from("expert_applications")
      .select("id, email, full_name, company, status")
      .ilike("email", email)
      .maybeSingle(),
    admin
      .from("partner_applications")
      .select("id, contact_email, company_name, contact_name, category, status")
      .ilike("contact_email", email)
      .maybeSingle(),
  ]);

  const m = memberRes.data;
  const x = expertRes.data;
  const p = partnerRes.data;

  const member: MemberRole | null =
    m && m.status === "active"
      ? {
          id: m.id as string,
          email: m.email as string,
          firstName: (m.first_name as string) ?? "",
          lastName: (m.last_name as string) ?? "",
          practiceName: (m.practice_name as string) ?? null,
          tier: (m.tier as string) ?? "founding",
        }
      : null;

  const expert: ExpertRole | null =
    x && x.status === "approved"
      ? {
          id: x.id as string,
          email: x.email as string,
          fullName: (x.full_name as string) ?? "",
          company: (x.company as string) ?? null,
        }
      : null;

  const partner: PartnerRole | null =
    p && p.status === "approved"
      ? {
          id: p.id as string,
          email: p.contact_email as string,
          companyName: (p.company_name as string) ?? "",
          contactName: (p.contact_name as string) ?? "",
          category: (p.category as string) ?? null,
        }
      : null;

  const roles: PortalRoleName[] = [];
  if (member) roles.push("member");
  if (expert) roles.push("expert");
  if (partner) roles.push("partner");

  return { email, member, expert, partner, roles };
}

/** Where to send someone after sign-in, given the roles they hold. */
export function portalHomeFor(identity: PortalIdentity): string | null {
  const first = identity.roles[0];
  return first ? PORTAL_HOME[first] : null;
}

/**
 * Make sure a Supabase auth user exists for this email.
 *
 * Portal sign-in uses `shouldCreateUser: false`, so someone with no auth
 * user can never receive a code — they'd be activated but locked out.
 * Call this whenever access is granted: member activation, expert
 * approval, partner approval.
 *
 * `email_confirm: true` is safe here: the account is only reachable by
 * proving control of the inbox at sign-in (the OTP code), and it stops
 * Supabase sending its own confirmation email on top of ours.
 *
 * Fail-soft — a provisioning hiccup must never roll back an approval.
 * Returns false so the caller can log it.
 */
export async function ensureAuthUser(emailRaw: string): Promise<boolean> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return false;
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already (been )?registered|already exists/i.test(error.message ?? "")) {
      console.error("[portal:ensureAuthUser] createUser failed:", error.status, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[portal:ensureAuthUser] failed:", err);
    return false;
  }
}

/** The signed-in user's portal identity, or null when signed out. */
export async function currentPortalIdentity(): Promise<PortalIdentity | null> {
  const supabase = await createServerSupabase();
  // getClaims verifies the JWT locally with asymmetric signing keys and
  // falls back to the same server check getUser() did otherwise.
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  if (!email) return null;
  return resolvePortalRoles(email);
}

/**
 * Server-Component guard. The middleware already blocks these routes, but
 * pages re-check so a middleware misconfiguration can't leak data — the
 * same defense-in-depth rule the API guards follow.
 *
 *   const { member } = await requirePortalPage("member");
 */
export async function requirePortalPage(role: PortalRoleName): Promise<PortalIdentity> {
  const identity = await currentPortalIdentity();
  if (!identity) redirect(`/login?redirect=${encodeURIComponent(PORTAL_HOME[role])}`);
  if (!identity[role]) redirect("/?portal=inactive");
  return identity;
}
