import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkBillingAccess, isBillingBypassed } from "@/lib/stripe";

/**
 * The short-lived cookie set at signup so a brand-new member can reach the
 * plan picker + pay BEFORE they've logged in (pay-first flow). It only
 * grants the checkout surface — the portal itself stays OTP-gated.
 *
 * The value is a SIGNED token (`<memberId>.<hmac>`), never a bare id, so a
 * forged/guessed cookie can't resolve to another member's checkout context.
 */
export const SIGNUP_CHECKOUT_COOKIE = "asn_checkout";

/**
 * First-touch referral attribution cookie (`?ref=CODE`), set by the
 * middleware and consumed once by /api/member/signup. The middleware runs
 * on the Edge runtime and cannot import this module, so it repeats the
 * literal; keep the two in sync.
 */
export const REFERRAL_COOKIE = "asn_ref";

function checkoutSecret(): string {
  const s = process.env.IP_HASH_SALT || process.env.SIGNUP_IP_SALT;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT required to sign the checkout cookie.");
    }
    return "dev-only-checkout-secret";
  }
  return s;
}

/** Sign a member id into the pay-first checkout token. */
export function signCheckoutToken(memberId: string): string {
  const sig = createHmac("sha256", checkoutSecret()).update(memberId).digest("base64url");
  return `${memberId}.${sig}`;
}

/** Verify + extract the member id from a checkout token, or null if invalid. */
export function verifyCheckoutToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const memberId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", checkoutSecret()).update(memberId).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return memberId;
}

/**
 * Auth guards for Route Handlers. Each returns either { ok, ...context }
 * or a NextResponse you should immediately return from the route.
 *
 * Why this lives server-only: it imports cookie + service-role clients.
 *
 * Defense in depth:
 *   - Middleware blocks page navigation for unauthenticated users
 *   - These guards block direct API hits (curl, scripts, malicious clients)
 *   - RLS in the database is the third layer
 */

export type AdminContext = {
  ok: true;
  userId: string;
  email: string;
  adminId: string;
  role: "owner" | "admin" | "reviewer" | "support";
};

export type VendorContext = {
  ok: true;
  userId: string;
  email: string;
  vendorId: string;
  status: "pending_review" | "approved" | "rejected" | "suspended" | "churned";
  verified: boolean;
};

export type MemberContext = {
  ok: true;
  userId: string;
  email: string;
  memberId: string;
  firstName: string;
  status: "waitlist" | "invited" | "active" | "paused" | "churned";
};

/**
 * MemberOrAdminContext — what read-only member endpoints see when the
 * caller is either a real member OR an active admin using the /dashboard
 * preview bypass. `isAdminPreview: true` means memberId is a synthetic
 * "admin:<id>" string — routes MUST NOT use it in DB queries against
 * `members.id` or `member_resource_progress.member_id`. Instead they
 * should short-circuit progress/personalisation lookups and return the
 * public/global data only.
 */
export type MemberOrAdminContext =
  | (MemberContext & { isAdminPreview: false })
  | {
      ok: true;
      isAdminPreview: true;
      userId: string;
      email: string;
      memberId: string;
      firstName: string;
      status: "active";
    };

export type ExpertContext = {
  ok: true;
  userId: string;
  email: string;
  expertId: string;
  fullName: string;
  status: "invited" | "active" | "suspended" | "archived";
};

type Failure = { ok: false; response: NextResponse };

const ADMIN_ROLES = ["owner", "admin", "reviewer", "support"] as const;

/**
 * requireAdmin
 *
 * Use at the top of every /api/admin/* route. Returns the admin row +
 * normalized claims if the request belongs to an active admin; otherwise
 * returns a 401 / 403 response the caller must return immediately.
 *
 * Usage:
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 *   // guard.adminId, guard.email, guard.role are now safe to use
 */
export async function requireAdmin(): Promise<AdminContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  // Lookup via service role so we don't depend on the admin_users RLS policy
  // matching the calling user. We trust the cookie-validated user id above.
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("admin_users")
    .select("id, role, active, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!row || !row.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  // Best-effort: ensure auth_user_id stays linked & bump last_active_at.
  if (row.auth_user_id !== userData.user.id) {
    await admin
      .from("admin_users")
      .update({ auth_user_id: userData.user.id, last_active_at: new Date().toISOString() })
      .eq("id", row.id);
  } else {
    await admin
      .from("admin_users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (!ADMIN_ROLES.includes(row.role as (typeof ADMIN_ROLES)[number])) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid admin role." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    adminId: row.id,
    role: row.role as AdminContext["role"],
  };
}

/**
 * requireOwner
 *
 * Stricter variant: only the `owner` role. Use on routes that mutate the
 * admin team or do irreversible operations.
 */
export async function requireOwner(): Promise<AdminContext | Failure> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (guard.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Owner-only action." },
        { status: 403 },
      ),
    };
  }
  return guard;
}

/**
 * requireVendor
 *
 * Returns the vendor row that matches the signed-in user's email, or a
 * 401/403 response. Used by vendor-self APIs (the portal already uses RLS
 * for browser writes, this is only for server endpoints we add later).
 */
export async function requireVendor(): Promise<VendorContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("vendors")
    .select("id, status, verified, auth_user_id")
    .eq("contact_email", email)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No partner profile linked to this account." }, { status: 403 }),
    };
  }

  // Keep auth_user_id linked so the middleware's own-row check resolves this
  // vendor (RLS lets an authenticated user read only their own vendor row).
  if (row.auth_user_id !== userData.user.id) {
    await admin.from("vendors").update({ auth_user_id: userData.user.id }).eq("id", row.id);
  }

  if (row.status === "suspended" || row.status === "churned") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Vendor account is inactive." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    vendorId: row.id,
    status: row.status as VendorContext["status"],
    verified: !!row.verified,
  };
}

/**
 * requireVerifiedVendor
 *
 * Strictest variant: only approved + verified vendors. Use on any endpoint
 * that publishes content visible to members (offer/catalog inserts, etc).
 */
export async function requireVerifiedVendor(): Promise<VendorContext | Failure> {
  const guard = await requireVendor();
  if (!guard.ok) return guard;
  if (guard.status !== "approved" || !guard.verified) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your vendor account is not approved & verified yet." },
        { status: 403 },
      ),
    };
  }
  return guard;
}

/**
 * requirePaidVendor
 *
 * Same shape as requirePaidExpert. Use on any /api/vendor/* endpoint
 * that publishes content visible to members (offer/catalog publishes,
 * profile changes, lead replies, etc.). /api/vendor/billing/* stays on
 * plain requireVendor so a blocked partner can always update their
 * card or re-sync from Stripe.
 */
export async function requirePaidVendor(): Promise<VendorContext | Failure> {
  const guard = await requireVendor();
  if (!guard.ok) return guard;

  const admin = getSupabaseAdmin();
  const { data: billing } = await admin
    .from("vendors")
    .select("months_in_program, subscription_status, stripe_subscription_id, billing_parent_id")
    .eq("id", guard.vendorId)
    .maybeSingle();

  // Multi-company partners: a "covered" company (billing_parent_id set)
  // has no card of its own — its access inherits the paying partner's
  // subscription. Single-company partners have a null parent and use their
  // own billing, exactly as before.
  let monthsInProgram = billing?.months_in_program ?? 0;
  let subscriptionStatus = billing?.subscription_status ?? null;
  let hasSubscription = !!billing?.stripe_subscription_id;
  if (billing?.billing_parent_id) {
    const { data: parent } = await admin
      .from("vendors")
      .select("months_in_program, subscription_status, stripe_subscription_id")
      .eq("id", billing.billing_parent_id)
      .maybeSingle();
    if (parent) {
      monthsInProgram = parent.months_in_program ?? 0;
      subscriptionStatus = parent.subscription_status ?? null;
      hasSubscription = !!parent.stripe_subscription_id;
    }
  }

  const access = checkBillingAccess({
    monthsInProgram,
    subscriptionStatus,
    hasSubscription,
    billingExempt: isBillingBypassed(guard.email),
  });

  if (!access.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: access.title,
          reason: access.reason,
          message: access.message,
          cta: access.cta,
        },
        { status: 402 },
      ),
    };
  }
  return guard;
}

/**
 * requireExpert
 *
 * Returns the experts row for the signed-in user. Allows `invited` (in case
 * an API call lands before the first sign-in finishes the auth bootstrap)
 * but blocks `suspended` and `archived`. Used by /api/expert/* endpoints.
 */
export async function requireExpert(): Promise<ExpertContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("experts")
    .select("id, status, full_name, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No expert profile linked to this account." },
        { status: 403 },
      ),
    };
  }

  if (row.status === "suspended" || row.status === "archived") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Expert account is inactive." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    expertId: row.id,
    fullName: row.full_name,
    status: row.status as ExpertContext["status"],
  };
}

/**
 * requirePaidExpert
 *
 * Stricter variant of requireExpert. Use on any /api/expert/* endpoint
 * that grants real-world value (publishing kits, accepting bookings,
 * earning course revenue). Allows experts whose founding waiver is
 * still active OR whose subscription is healthy; rejects everyone else
 * with a 402 Payment Required + a structured reason so the client UI
 * can surface the same paywall as the in-portal BillingGate.
 *
 * /api/expert/billing/* endpoints should stay on plain requireExpert —
 * we always want a blocked expert to be able to update their card.
 */
export async function requirePaidExpert(): Promise<ExpertContext | Failure> {
  const guard = await requireExpert();
  if (!guard.ok) return guard;

  const admin = getSupabaseAdmin();
  const { data: billing } = await admin
    .from("experts")
    .select("months_in_program, subscription_status, stripe_subscription_id, billing_exempt")
    .eq("id", guard.expertId)
    .maybeSingle();

  const access = checkBillingAccess({
    monthsInProgram: billing?.months_in_program ?? 0,
    subscriptionStatus: billing?.subscription_status ?? null,
    hasSubscription: !!billing?.stripe_subscription_id,
    billingExempt: !!billing?.billing_exempt || isBillingBypassed(guard.email),
    audience: "expert",
  });

  if (!access.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: access.title,
          reason: access.reason,
          message: access.message,
          cta: access.cta,
        },
        { status: 402 },
      ),
    };
  }
  return guard;
}

/**
 * requireMember
 *
 * Returns the active member row for the signed-in user, or 401/403.
 * Used by /api/member/* endpoints.
 */
export async function requireMember(): Promise<MemberContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("members")
    .select("id, status, first_name, auth_user_id, account_type")
    .eq("email", email)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No member profile linked to this account." }, { status: 403 }),
    };
  }

  if (row.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your member portal isn't active yet." },
        { status: 403 },
      ),
    };
  }

  // A job seeker is status='active' (the OTP login needs that) but is
  // NOT a member. account_type is the discriminator — see §1 of
  // 0063_job_applications.sql. Without this check every free applicant
  // would satisfy the member gate the moment they registered.
  if (row.account_type === "job_seeker") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This is a job-seeker account. Membership is separate.", reason: "job_seeker" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    memberId: row.id,
    firstName: row.first_name,
    status: row.status as MemberContext["status"],
  };
}

export type ApplicantContext = {
  ok: true;
  userId: string;
  email: string;
  memberId: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  accountType: "member" | "job_seeker";
};

/**
 * requireApplicant
 *
 * The job-application gate. Accepts EITHER account type — a paying
 * member is a person who might also want to apply for a job, and a free
 * job-seeker account exists precisely so applying leaves a record. What
 * it requires is a signed-in session with an active members row; it
 * never checks payment, because applying is free by design.
 */
export async function requireApplicant(): Promise<ApplicantContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("members")
    .select("id, status, first_name, last_name, phone, account_type")
    .eq("email", email)
    .maybeSingle();

  if (!row || row.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Create a free account to apply.", reason: "no_account" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email,
    memberId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    accountType: row.account_type,
  };
}

/**
 * requirePaidMember
 *
 * requireMember + an active subscription. Use on member routes that deliver
 * or act on paid value (the AI assistant, resource progress/feedback) so a
 * logged-in but unpaid member can't reach them via a direct API call. Keep
 * account-management routes (me, profile, billing/*) on plain requireMember
 * so an unpaid member can still see their account and pay.
 */
export async function requirePaidMember(): Promise<MemberContext | Failure> {
  const guard = await requireMember();
  if (!guard.ok) return guard;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("members")
    .select("subscription_status")
    .eq("id", guard.memberId)
    .maybeSingle();
  // "paid" = active OR trialing (a card is on file for both). Matches
  // billing.ts and the middleware so nothing double-blocks a subscriber.
  if (!isMemberPaid(data?.subscription_status)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Activate your membership to access this.", reason: "payment_required" },
        { status: 402 },
      ),
    };
  }
  return guard;
}

/** A member counts as paid when their subscription is active OR trialing. */
export function isMemberPaid(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export type CheckoutMemberContext =
  | {
      ok: true;
      memberId: string;
      email: string;
      firstName: string | null;
      subscriptionStatus: string | null;
      stripeSubscriptionId: string | null;
      /** true = full logged-in session; false = pre-login signup cookie. */
      authed: boolean;
    }
  | Failure;

/**
 * resolveCheckoutMember
 *
 * Identifies the member for the CHECKOUT surface (the /upgrade plan picker
 * and /api/stripe/checkout) from EITHER a full session OR the short-lived
 * signup cookie. This is what lets a just-signed-up member pay before
 * logging in.
 *
 * Security: paying is not a privileged action — the worst a forged cookie
 * can do is fund someone else's subscription. The PORTAL stays OTP-gated
 * (requireMember), so this never grants portal access.
 */
export async function resolveCheckoutMember(): Promise<CheckoutMemberContext> {
  const admin = getSupabaseAdmin();

  // 1. The signup checkout cookie WINS. Its presence means this browser just
  //    signed up — that intent should beat any leftover/stale session, so a
  //    prior login can't make us charge or greet the wrong person.
  const jar = await cookies();
  const memberId = verifyCheckoutToken(jar.get(SIGNUP_CHECKOUT_COOKIE)?.value);
  if (memberId) {
    const { data } = await admin
      .from("members")
      .select("id, email, first_name, status, subscription_status, stripe_subscription_id")
      .eq("id", memberId)
      .maybeSingle();
    if (data && data.status === "active") {
      return {
        ok: true,
        memberId: data.id,
        email: data.email,
        firstName: data.first_name,
        subscriptionStatus: data.subscription_status,
        stripeSubscriptionId: data.stripe_subscription_id,
        authed: false,
      };
    }
  }

  // 2. Otherwise a full logged-in session (the normal /upgrade-after-login case).
  const session = await requireMember();
  if (session.ok) {
    const { data } = await admin
      .from("members")
      .select("subscription_status, stripe_subscription_id")
      .eq("id", session.memberId)
      .maybeSingle();
    return {
      ok: true,
      memberId: session.memberId,
      email: session.email,
      firstName: session.firstName,
      subscriptionStatus: data?.subscription_status ?? null,
      stripeSubscriptionId: data?.stripe_subscription_id ?? null,
      authed: true,
    };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Start by signing up at /join." }, { status: 401 }),
  };
}

/**
 * requireMemberOrAdminPreview
 *
 * Read-only variant of requireMember. Real members pass through with a
 * full context (isAdminPreview: false). Active admins pass through with
 * a synthetic context (isAdminPreview: true) so they can browse
 * /api/member/resources, /api/member/experts, etc. for QA without
 * subscribing.
 *
 * DO NOT USE ON WRITE ENDPOINTS. Any route that inserts/updates member
 * data (progress, feedback, profile edits, checkout) must stay on
 * requireMember so admin previews can't accidentally write to member
 * tables with a synthetic memberId.
 */
export async function requireMemberOrAdminPreview(): Promise<MemberOrAdminContext | Failure> {
  const cookieClient = await createServerSupabase();
  const { data: userData, error: userErr } = await cookieClient.auth.getUser();
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  const email = userData.user.email?.toLowerCase();
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is missing an email." }, { status: 403 }),
    };
  }

  const sb = getSupabaseAdmin();

  // Admin preview first — same case-insensitive match the /member/login
  // and /verify-otp bypasses use. If the admin row is active, return a
  // synthetic context so routes serve the global data without needing a
  // real memberId.
  const { data: adminRow } = await sb
    .from("admin_users")
    .select("id, active, full_name")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (adminRow?.active) {
    const firstName = (adminRow.full_name ?? "Admin").split(/\s+/)[0] ?? "Admin";
    return {
      ok: true,
      isAdminPreview: true,
      userId: userData.user.id,
      email,
      memberId: `admin:${adminRow.id}`,
      firstName,
      status: "active",
    };
  }

  // Fall through to normal member gate.
  const { data: memberRow } = await sb
    .from("members")
    .select("id, status, first_name, auth_user_id, subscription_status")
    .eq("email", email)
    .maybeSingle();
  if (!memberRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No member profile linked to this account." },
        { status: 403 },
      ),
    };
  }
  if (memberRow.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your member portal isn't active yet." },
        { status: 403 },
      ),
    };
  }
  // PAYWALL — this guard fronts member CONTENT (kits, tools, directories).
  // The page middleware already bounces unpaid members to /upgrade, but a
  // logged-in unpaid member could otherwise pull content via direct API
  // calls. Enforce payment here too (defense in depth). Admins previewing
  // returned above and are unaffected.
  if (!isMemberPaid(memberRow.subscription_status)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Activate your membership to access this.", reason: "payment_required" },
        { status: 402 },
      ),
    };
  }
  return {
    ok: true,
    isAdminPreview: false,
    userId: userData.user.id,
    email,
    memberId: memberRow.id,
    firstName: memberRow.first_name,
    status: memberRow.status as MemberContext["status"],
  };
}
