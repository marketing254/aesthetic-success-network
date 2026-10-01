import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * Admin "Delete" for an expert or a company: removes the person from OUR
 * database completely (row, application, founding invites, invite links,
 * reminders, the Supabase sign-in user) and, best effort, deletes their
 * Stripe customer, which cancels any trial subscription or schedule with
 * it. Admin and member accounts with the same email are never touched.
 *
 * Use for test accounts and withdrawn applicants. Not reversible.
 */

export type DeleteReport = {
  ok: true;
  email: string;
  removed: string[];
  stripe: "deleted" | "none" | "failed";
};

async function deleteAuthUser(email: string, removed: string[]) {
  const sb = getSupabaseAdmin();
  const { data: admin } = await sb.from("admin_users").select("id").ilike("email", email).maybeSingle();
  const { data: member } = await sb.from("members").select("id").ilike("email", email).maybeSingle();
  if (admin || member) {
    removed.push("sign-in user kept (also an admin or member)");
    return;
  }
  for (let page = 1; page <= 10; page += 1) {
    const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = (list?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
    if (u) {
      await sb.auth.admin.deleteUser(u.id);
      removed.push("sign-in user");
      return;
    }
    if ((list?.users ?? []).length < 200) break;
  }
}

async function deleteStripeCustomer(customerId: string | null | undefined): Promise<DeleteReport["stripe"]> {
  if (!customerId || customerId.startsWith("house_") || customerId.startsWith("preview_")) return "none";
  try {
    const stripe = getStripe();
    // Deleting the customer cancels its subscriptions and schedules.
    await stripe.customers.del(customerId);
    return "deleted";
  } catch (err) {
    console.error("[admin:delete] Stripe customer delete failed", customerId, err);
    return "failed";
  }
}

export async function deleteExpertEverywhere(opts: { applicationId?: string | null; email: string }): Promise<DeleteReport> {
  const sb = getSupabaseAdmin();
  const email = opts.email.trim().toLowerCase();
  const removed: string[] = [];

  const { data: expert } = await sb.from("experts").select("id, stripe_customer_id").ilike("email", email).maybeSingle();
  const stripe = await deleteStripeCustomer(expert?.stripe_customer_id);

  if (expert) {
    await sb.from("invite_links").delete().eq("expert_id", expert.id);
    await sb.from("referral_codes").delete().eq("expert_id", expert.id);
    await sb.from("member_promo_codes").delete().eq("expert_id", expert.id);
    await sb.from("experts").delete().eq("id", expert.id);
    removed.push("expert profile");
  }
  const inv = await sb.from("founding_invites").delete().ilike("email", email).select("id");
  if ((inv.data ?? []).length) removed.push("founding invites");
  const apps = await sb.from("expert_applications").delete().ilike("email", email).select("id");
  if ((apps.data ?? []).length) removed.push("application");
  if (opts.applicationId) await sb.from("expert_applications").delete().eq("id", opts.applicationId);
  await deleteAuthUser(email, removed);
  return { ok: true, email, removed, stripe };
}

export async function deleteVendorEverywhere(opts: { vendorId: string }): Promise<DeleteReport | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id, contact_email, stripe_customer_id, billing_parent_id")
    .eq("id", opts.vendorId)
    .maybeSingle();
  if (!vendor) return { ok: false, error: "Company not found." };
  const email = (vendor.contact_email ?? "").toLowerCase();
  const removed: string[] = [];

  const stripe = vendor.billing_parent_id ? ("none" as const) : await deleteStripeCustomer(vendor.stripe_customer_id);

  // Covered companies under this one lose their parent; delete them too.
  const { data: children } = await sb.from("vendors").select("id").eq("billing_parent_id", vendor.id);
  const ids = [vendor.id, ...(children ?? []).map((c) => c.id)];
  await sb.from("redemptions").delete().in("vendor_id", ids);
  await sb.from("invite_links").delete().in("vendor_id", ids);
  await sb.from("referral_codes").delete().in("vendor_id", ids);
  await sb.from("member_promo_codes").delete().in("vendor_id", ids);
  await sb.from("vendors").delete().in("id", ids);
  removed.push(children?.length ? `company and ${children.length} covered compan${children.length === 1 ? "y" : "ies"}` : "company");

  if (email) {
    const inv = await sb.from("founding_invites").delete().ilike("email", email).select("id");
    if ((inv.data ?? []).length) removed.push("founding invites");
    const apps = await sb.from("vendor_applications").delete().ilike("contact_email", email).select("id");
    if ((apps.data ?? []).length) removed.push("application");
    // Only drop the sign-in if no expert profile still uses this email.
    const { data: expertSame } = await sb.from("experts").select("id").ilike("email", email).maybeSingle();
    if (!expertSame) await deleteAuthUser(email, removed);
    else removed.push("sign-in user kept (expert profile uses it)");
  }
  return { ok: true, email, removed, stripe };
}
