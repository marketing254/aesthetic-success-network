import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { sendExpertApprovalEmail } from "@/lib/waitlist/confirmationEmail";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { createOrReuseInviteLink } from "@/lib/inviteLinks";
import type { ExpertApplicationStatus } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";
import { appOrigin, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/experts
 *
 * Default: returns up to 500 most-recent expert applications, newest first.
 * ?simple=1: returns active experts (id, full_name, display_name) only —
 *            used by selectors in admin forms (e.g. "Originating expert"
 *            on the resource upload page).
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const simple = url.searchParams.get("simple") === "1";

  try {
    const supabase = getSupabaseAdmin();
    if (simple) {
      const { data, error } = await supabase
        .from("experts")
        .select("id, full_name, display_name, status")
        .neq("status", "archived")
        .neq("status", "suspended")
        .order("display_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return NextResponse.json({ experts: data ?? [] });
    }
    const { data, error } = await supabase
      .from("expert_applications")
      .select(
        "id, full_name, email, phone, company_name, specialty, topics, website, booking_link, source, status, created_at, contacted_at, notes",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/experts" });
  }
}

type Action = "start_review" | "decline" | "mark_onboarded" | "reset";

/**
 * POST /api/admin/experts
 *
 * Body: {
 *   full_name: string;
 *   email: string;
 *   specialty: string;
 *   phone?: string;
 *   company_name?: string;
 *   topics?: string;
 *   website?: string;
 *   booking_link?: string;
 *   notes?: string;
 * }
 *
 * Lets the team add an expert directly without going through the public
 * application form. Creates an `expert_applications` row with status
 * `onboarded`, then runs the same provisioning as `mark_onboarded`:
 * upserts an `experts` row, pre-creates the Supabase auth user, generates
 * a one-click magic link, and sends the expert-onboarded welcome email.
 *
 * Idempotent on email: if an application already exists for that address,
 * it's promoted to onboarded and re-provisioned rather than duplicated.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    full_name?: string;
    email?: string;
    specialty?: string;
    phone?: string;
    company_name?: string;
    topics?: string;
    website?: string;
    booking_link?: string;
    bio?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const fullName = (body.full_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const specialty = (body.specialty ?? "").trim();
  if (!fullName || !email || !specialty) {
    return NextResponse.json(
      { error: "full_name, email and specialty are required." },
      { status: 400 },
    );
  }
  // Basic format check; the auth.admin.createUser call below will surface
  // a clearer error if the address is structurally invalid.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  // Length caps — match expert_applications schema constraints so an
  // oversized payload can't smuggle its way past the database CHECKs.
  const LIMITS = {
    full_name: 120,
    email: 320,
    specialty: 240,
    phone: 32,
    company_name: 160,
    topics: 2000,
    website: 240,
    booking_link: 240,
    notes: 4000,
  } as const;
  for (const [k, v] of Object.entries({
    full_name: fullName,
    email,
    specialty,
    phone: body.phone?.trim() ?? "",
    company_name: body.company_name?.trim() ?? "",
    topics: body.topics?.trim() ?? "",
    website: body.website?.trim() ?? "",
    booking_link: body.booking_link?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
  })) {
    if (v.length > LIMITS[k as keyof typeof LIMITS]) {
      return NextResponse.json(
        { error: `Field "${k}" is too long (max ${LIMITS[k as keyof typeof LIMITS]} chars).` },
        { status: 400 },
      );
    }
  }
  if (fullName.length < 2 || specialty.length < 2) {
    return NextResponse.json(
      { error: "Full name and specialty must each be at least 2 characters." },
      { status: 400 },
    );
  }
  // URL fields, if present, must be http(s) — prevents javascript: / data:
  // URLs from being saved and later rendered as profile links.
  const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  for (const f of ["website", "booking_link"] as const) {
    const val = body[f]?.trim();
    if (val && !URL_RE.test(val)) {
      return NextResponse.json(
        { error: `"${f}" must be a full https:// URL.` },
        { status: 400 },
      );
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    // Look up an existing application by email; if found we update it
    // rather than insert a duplicate. This makes the endpoint safe to
    // re-run for the same person.
    const { data: existingApp } = await supabase
      .from("expert_applications")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const applicationPatch = {
      full_name: fullName,
      email,
      specialty,
      phone: body.phone?.trim() || null,
      company_name: body.company_name?.trim() || null,
      topics: body.topics?.trim() || null,
      website: body.website?.trim() || null,
      booking_link: body.booking_link?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "onboarded" as ExpertApplicationStatus,
      source: "admin-add",
      contacted_at: new Date().toISOString(),
    };

    let applicationId: string;
    if (existingApp) {
      const { error: upErr } = await supabase
        .from("expert_applications")
        .update(applicationPatch)
        .eq("id", existingApp.id);
      if (upErr) throw upErr;
      applicationId = existingApp.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("expert_applications")
        .insert({
          ...applicationPatch,
          // Required fields that may not have defaults.
          agreement_accepted: true,
          agreement_accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      applicationId = inserted.id;
    }

    // Audit trail.
    await supabase.from("review_actions").insert({
      target_type: "expert_application",
      target_id: applicationId,
      action: "admin_create",
      note: body.notes ?? null,
      admin_id: guard.adminId,
    });

    // Provision portal access (same path as mark_onboarded).
    const bio = body.bio?.trim() || null;
    const provisioning = await provisionExpert({
      supabase,
      application: {
        id: applicationId,
        email,
        full_name: fullName,
        phone: body.phone?.trim() || null,
        company_name: body.company_name?.trim() || null,
        specialty,
        topics: body.topics?.trim() || null,
        website: body.website?.trim() || null,
        booking_link: body.booking_link?.trim() || null,
      },
      adminId: guard.adminId,
      origin: appOrigin(),
    });

    // Bio supplied at creation goes straight onto the experts row (the
    // application table has no bio column; the row is what the publish
    // gate reads).
    if (bio && provisioning.experts_row.id) {
      await supabase.from("experts").update({ bio }).eq("id", provisioning.experts_row.id);
    }

    // In-app admin notification.
    await insertNotification(supabase, {
      audience: "admin",
      admin_id: null,
      kind: "expert_onboarded",
      title: `Expert added by admin: ${fullName}`,
      body: body.notes ?? null,
      link: `/admin/experts?filter=onboarded`,
      metadata: { expert_application_id: applicationId },
    });

    // Email the whole team.
    void notifyTeamEvent({
      kind: "admin_added",
      role: "expert",
      name: fullName,
      email,
      adminLink: appUrl("/admin/experts?filter=onboarded"),
      highlight: provisioning?.email?.sent
        ? "Portal access provisioned. Welcome email sent."
        : "Portal access provisioned.",
      fields: [
        { label: "Teaches / coaches on", value: specialty },
        { label: "Company", value: body.company_name },
        { label: "Phone", value: body.phone },
        { label: "Website", value: body.website },
        { label: "Booking link", value: body.booking_link },
        { label: "Notes", value: body.notes },
      ],
    });

    return NextResponse.json({
      ok: true,
      application_id: applicationId,
      provisioning,
    });
  } catch (err) {
    return serverError(err, { route: "POST /api/admin/experts" });
  }
}

const ACTION_STATUS: Record<Action, ExpertApplicationStatus> = {
  start_review: "reviewing",
  decline: "declined",
  mark_onboarded: "onboarded",
  reset: "new",
};

/**
 * PATCH /api/admin/experts
 *
 * Body: { id: string; action: Action; note?: string }
 *
 * Moves the application through the review workflow:
 *   new → reviewing → onboarded
 *                  ↘ declined
 * `reset` moves anything back to `new` (for misclicks).
 *
 * The previous `invite` step (soft yes before onboarding) was removed —
 * reviewers go straight to `mark_onboarded` which provisions the portal
 * + sends the welcome email in one step.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed: Action[] = ["start_review", "decline", "mark_onboarded", "reset"];
  if (!body.id || !body.action || !allowed.includes(body.action as Action)) {
    return NextResponse.json(
      { error: "id and a valid action are required." },
      { status: 400 },
    );
  }
  const action = body.action as Action;

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: readErr } = await supabase
      .from("expert_applications")
      .select(
        "id, full_name, email, status, phone, company_name, specialty, topics, website, booking_link",
      )
      .eq("id", body.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!existing) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const nextStatus = ACTION_STATUS[action];
    const patch: { status: ExpertApplicationStatus; contacted_at?: string; notes?: string | null } = {
      status: nextStatus,
    };
    // Stamp the contact time the first time a human moves it off `new`.
    if (action === "start_review" || action === "decline") {
      patch.contacted_at = new Date().toISOString();
    }
    if (typeof body.note === "string" && body.note.trim()) {
      patch.notes = body.note.trim();
    }

    const { error: upErr } = await supabase
      .from("expert_applications")
      .update(patch)
      .eq("id", body.id);
    if (upErr) throw upErr;

    // Audit trail.
    await supabase.from("review_actions").insert({
      target_type: "expert_application",
      target_id: body.id,
      action,
      note: body.note ?? null,
      admin_id: guard.adminId,
    });

    // In-app admin notification — keeps the team aware of major transitions.
    if (action === "decline" || action === "mark_onboarded") {
      const kind =
        action === "mark_onboarded" ? "expert_onboarded" : "expert_declined";
      const title =
        action === "mark_onboarded"
          ? `Expert onboarded, portal activated: ${existing.full_name}`
          : `Expert declined: ${existing.full_name}`;
      const filter = action === "mark_onboarded" ? "onboarded" : "declined";
      await insertNotification(supabase, {
        audience: "admin",
        admin_id: null,
        kind,
        title,
        body: body.note ?? null,
        link: `/admin/experts?filter=${filter}`,
        metadata: { expert_application_id: body.id },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // PROVISIONING (mark_onboarded only): create experts row + auth
    // user + magic link + welcome email — all in one step. The team
    // has already had the onboarding call manually before clicking
    // Mark onboarded; the email + portal access are the post-call
    // welcome packet.
    //
    // Each step is best-effort and logs its outcome — failures don't
    // roll back the status transition the team already confirmed, but
    // they surface in the response so the admin sees what to retry.
    // ─────────────────────────────────────────────────────────────────
    let provisioning: ProvisioningReport | undefined;

    if (action === "mark_onboarded") {
      provisioning = await provisionExpert({
        supabase,
        application: existing,
        adminId: guard.adminId,
        origin: appOrigin(),
      });
    }

    return NextResponse.json({ ok: true, provisioning });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/experts" });
  }
}

type ProvisioningReport = {
  experts_row: { id?: string; created?: boolean; error?: string };
  auth_user: { id?: string; created?: boolean; error?: string };
  magic_link: { generated?: boolean; error?: string };
  email: { sent?: boolean; error?: string };
};

/**
 * provisionExpert
 *
 * Idempotent: re-clicking "Mark onboarded" should not crash. Each sub-step
 * handles "already exists" gracefully and either generates a fresh magic
 * link or surfaces the error to the admin without blocking.
 *
 * Steps:
 *   1. Upsert `experts` row (looked up by email; create if missing).
 *   2. Pre-create Supabase auth user (so magic-link sign-in works).
 *   3. Generate a fresh Supabase magic link (one-click sign-in).
 *   4. Send the approval email containing that link.
 */
async function provisionExpert(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  application: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    company_name: string | null;
    specialty: string;
    topics: string | null;
    website: string | null;
    booking_link: string | null;
  };
  adminId: string;
  origin: string;
}): Promise<ProvisioningReport> {
  const { supabase, application, adminId, origin } = args;
  const out: ProvisioningReport = {
    experts_row: {},
    auth_user: {},
    magic_link: {},
    email: {},
  };

  const email = application.email.toLowerCase();
  const portalLoginUrl = `${origin.replace(/\/$/, "")}/expert/login`;

  // 1. Upsert experts row (find by email; create if missing).
  let expertId: string | null = null;
  try {
    const { data: existingExpert } = await supabase
      .from("experts")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existingExpert) {
      expertId = existingExpert.id;
      out.experts_row = { id: expertId, created: false };
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("experts")
        .insert({
          application_id: application.id,
          email,
          full_name: application.full_name,
          phone: application.phone,
          company_name: application.company_name,
          specialty: application.specialty,
          topics: application.topics,
          website: application.website,
          booking_link: application.booking_link,
          status: "invited",
          invited_by: adminId,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      expertId = inserted.id;
      out.experts_row = { id: expertId, created: true };
    }
  } catch (err) {
    console.error("[admin:experts] provisioning step failed: experts_row", err);
    out.experts_row = {
      error: "Failed to upsert expert row.",
    };
    // Without an experts row we can't continue meaningfully; bail.
    return out;
  }

  // 2. Pre-create Supabase auth user. shouldCreateUser:false on the login
  //    route means the user MUST already exist before magic-link sign-in.
  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { user_type: "expert", expert_id: expertId },
    });
    if (createErr) {
      if (/already.*registered|exists/i.test(createErr.message)) {
        // Look up the existing user id so we can link experts.auth_user_id.
        // Supabase Admin SDK doesn't have a direct "find by email", so we
        // page through listUsers — fine at small scale.
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list.users.find((u) => u.email?.toLowerCase() === email);
        if (found) {
          out.auth_user = { id: found.id, created: false };
        } else {
          out.auth_user = { error: "User exists but could not be located." };
        }
      } else {
        out.auth_user = { error: createErr.message };
      }
    } else {
      out.auth_user = { id: created.user.id, created: true };
    }

    // Link auth_user_id on the experts row if we got an id.
    if (out.auth_user.id && expertId) {
      await supabase
        .from("experts")
        .update({ auth_user_id: out.auth_user.id })
        .eq("id", expertId);
    }
  } catch (err) {
    console.error("[admin:experts] provisioning step failed: auth_user", err);
    out.auth_user = {
      error: "Failed to create auth user.",
    };
  }

  // 3. Generate a fresh Supabase magic link for one-click sign-in.
  //
  // Important: we DON'T use the `action_link` returned by generateLink —
  // that link points to Supabase's `/auth/v1/verify` endpoint on the
  // Supabase domain, which sets session cookies on Supabase's domain (not
  // ours). With SSR auth, those cookies don't transfer when verify
  // redirects to our callback, so the user lands at /auth/callback with
  // no session and the existing handler returns "Missing code in callback".
  //
  // The SSR-compatible pattern: take the `hashed_token` from generateLink,
  // build a URL on OUR domain (`/auth/callback?token_hash=...&type=magiclink
  // &next=/expert&role=expert`), and let our callback call `verifyOtp` —
  // which sets the auth cookies on our domain so the session sticks.
  let portalLink: string | null = null;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        // redirectTo here is informational — Supabase requires it but with
        // our token_hash flow it doesn't drive the actual redirect target.
        redirectTo: `${origin.replace(/\/$/, "")}/auth/callback?next=/expert&role=expert`,
      },
    });
    if (error) throw error;
    const hashedToken = data.properties?.hashed_token;
    if (hashedToken) {
      const baseUrl = origin.replace(/\/$/, "");
      const params = new URLSearchParams({
        token_hash: hashedToken,
        type: "magiclink",
        next: "/expert",
        role: "expert",
      });
      portalLink = `${baseUrl}/auth/callback?${params.toString()}`;
      out.magic_link = { generated: true };
    } else {
      out.magic_link = {
        generated: false,
        error: "generateLink returned no hashed_token.",
      };
    }
  } catch (err) {
    console.error("[admin:experts] provisioning step failed: magic_link", err);
    out.magic_link = {
      generated: false,
      error: "Failed to generate magic link.",
    };
  }

  // 4. Send the approval email. If the magic link failed, we still send the
  //    email but use the login page URL as the CTA so the expert can request
  //    their own link.
  try {
    const firstName = application.full_name.trim().split(/\s+/)[0] ?? application.full_name;
    const result = await sendExpertApprovalEmail({
      email,
      firstName,
      expertId: expertId ?? application.id,
      portalLink: portalLink ?? portalLoginUrl,
      portalLoginUrl,
    });
    out.email = { sent: result.sent };

    if (expertId) {
      await supabase.from("email_events").insert({
        template: "expert_approved",
        recipient: email,
        subject: "You're confirmed as an Aesthetic Success Network expert: here's your portal",
        provider: process.env.SMTP_HOST
          ? "smtp"
          : process.env.GMAIL_USER
            ? "gmail"
            : process.env.RESEND_API_KEY
              ? "resend"
              : "log",
        status: result.sent ? "queued" : "failed",
        metadata: { expert_id: expertId, application_id: application.id },
      });
    }
  } catch (err) {
    console.error("[admin:experts] provisioning step failed: email", err);
    out.email = {
      sent: false,
      error: "Failed to send approval email.",
    };
  }

  // Standard invite link for the fresh expert profile — appears in
  // /admin/invites ready to copy into a manually written email.
  if (expertId) {
    await createOrReuseInviteLink(supabase, {
      kind: "expert",
      expertId,
      fullName: application.full_name,
      email,
      companyName: application.company_name ?? null,
      createdBy: adminId,
    });
  }

  return out;
}
