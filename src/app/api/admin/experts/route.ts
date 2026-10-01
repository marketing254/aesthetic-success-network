import { NextResponse } from "next/server";
import { deleteExpertEverywhere } from "@/lib/admin/deleteProvider";
import { normalizeWebUrl } from "@/lib/waitlist/validate";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { sendExpertApprovalEmail } from "@/lib/waitlist/confirmationEmail";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { createOrReuseInviteLink } from "@/lib/inviteLinks";
import type { ExpertApplicationStatus } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";
import { appUrl } from "@/lib/stripe";

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
  for (const f of ["website", "booking_link"] as const) {
    const val = body[f]?.trim();
    const norm = normalizeWebUrl(val);
    if (val && !norm) {
      return NextResponse.json(
        { error: `"${f}" must be a web address, e.g. www.site.com.` },
        { status: 400 },
      );
    }
    if (val) body[f] = norm ?? val;
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

    // Same path as approving an application: expert row, sign-in user and
    // the approval email. They accept the agreement in the portal.
    const bio = body.bio?.trim() || null;
    const provisioning = await approveExpert({
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
        bio,
      },
      adminId: guard.adminId,
    });

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
        ? "Approval email sent. They sign in, accept the agreement and save a card in the portal."
        : "Added. The approval email did not confirm.",
      fields: [
        { label: "Source", value: "Added by admin" },
        { label: "Teaches / coaches on", value: specialty },
        { label: "Bio", value: bio },
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
 * `mark_onboarded` = approve. Creates the experts row and sign-in user and
 * sends the "You're approved" email. The expert then signs in, accepts the
 * Provider Agreement and saves a card in the portal (nothing charged until
 * the free founding months end). Founding links are NOT used here; they
 * come only from the admin "Send invite" action on /admin/founding.
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
        "id, full_name, email, status, phone, company_name, specialty, topics, website, booking_link, bio",
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
          ? `Expert approved, portal access created: ${existing.full_name}`
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

    // APPROVAL (mark_onboarded only): expert row + sign-in user + the
    // "You're approved" email. Agreement and card happen in the portal.
    let provisioning: ProvisioningReport | undefined;
    if (action === "mark_onboarded") {
      provisioning = await approveExpert({ application: existing, adminId: guard.adminId });
    }

    return NextResponse.json({ ok: true, provisioning });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/experts" });
  }
}

type ProvisioningReport = {
  experts_row: { id?: string; created?: boolean; error?: string };
  auth_user: { id?: string; created?: boolean; error?: string };
  email: { sent?: boolean; error?: string };
};

/**
 * approveExpert
 *
 * Website applicants never get a founding link; that is reserved for the
 * admin "Send invite" action on /admin/founding. Approval here:
 *   1. Upserts the experts row (status "invited") so /expert/login accepts
 *      the email.
 *   2. Pre-creates the Supabase auth user (6-digit code sign-in).
 *   3. Sends the "You're approved" email: sign in, accept the Provider
 *      Agreement and save a card in the portal (nothing charged until the
 *      free founding months end). The portal's sign-and-pay step sends the
 *      welcome email with the signed PDF.
 * Idempotent: re-clicking resends the approval email.
 */
async function approveExpert(args: {
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
    bio?: string | null;
  };
  adminId: string;
}): Promise<ProvisioningReport> {
  const { application, adminId } = args;
  const out: ProvisioningReport = { experts_row: {}, auth_user: {}, email: {} };
  const supabase = getSupabaseAdmin();
  const email = application.email.toLowerCase();
  const portalLoginUrl = appUrl("/expert/login");

  // 1. experts row
  let expertId: string | null = null;
  try {
    const { data: existingExpert } = await supabase.from("experts").select("id").eq("email", email).maybeSingle();
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
          bio: application.bio ?? null,
          website: application.website,
          booking_link: application.booking_link,
          status: "invited",
          invited_by: adminId,
        } as never)
        .select("id")
        .single();
      if (insErr) throw insErr;
      expertId = inserted.id;
      out.experts_row = { id: expertId, created: true };
    }
  } catch (err) {
    console.error("[admin:experts] approve step failed: experts_row", err);
    out.experts_row = { error: "Failed to create the expert row." };
    return out;
  }

  // 2. auth user (shouldCreateUser:false on login means it must exist)
  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { user_type: "expert", expert_id: expertId },
    });
    if (createErr) {
      if (/already.*registered|exists/i.test(createErr.message)) {
        for (let page = 1; page <= 5; page += 1) {
          const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
          const found = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
          if (found) {
            out.auth_user = { id: found.id, created: false };
            break;
          }
          if ((list?.users ?? []).length < 200) break;
        }
        if (!out.auth_user.id) out.auth_user = { error: "User exists but could not be located." };
      } else {
        out.auth_user = { error: createErr.message };
      }
    } else {
      out.auth_user = { id: created.user.id, created: true };
    }
    if (out.auth_user.id && expertId) {
      await supabase.from("experts").update({ auth_user_id: out.auth_user.id } as never).eq("id", expertId);
    }
  } catch (err) {
    console.error("[admin:experts] approve step failed: auth_user", err);
    out.auth_user = { error: "Failed to create the sign-in user." };
  }

  // 3. approval email
  try {
    const firstName = application.full_name.trim().split(/\s+/)[0] ?? application.full_name;
    const result = await sendExpertApprovalEmail({ email, firstName, expertId: expertId ?? application.id, portalLoginUrl });
    out.email = { sent: result.sent };
    if (expertId) {
      await supabase.from("email_events").insert({
        template: "expert_approved",
        recipient: email,
        subject: "You're approved: welcome to the Aesthetic Success Network bench",
        provider: process.env.SMTP_HOST ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "log",
        status: result.sent ? "queued" : "failed",
        metadata: { expert_id: expertId, application_id: application.id },
      });
    }
  } catch (err) {
    console.error("[admin:experts] approve step failed: email", err);
    out.email = { sent: false, error: "Failed to send the approval email." };
  }

  // Keep /admin/invites complete; nothing is emailed from here.
  if (expertId) {
    try {
      await createOrReuseInviteLink(supabase, {
        kind: "expert",
        expertId,
        fullName: application.full_name,
        email,
        companyName: application.company_name ?? null,
        createdBy: adminId,
      });
    } catch {
      /* best effort */
    }
  }
  return out;
}

/**
 * DELETE /api/admin/experts  { id }
 * Removes the applicant/expert from the database completely (application,
 * expert profile, founding invites, invite links, sign-in user) and
 * deletes their Stripe customer, which cancels any trial billing. Owner /
 * admin only. Not reversible.
 */
export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const { data: app } = await supabase.from("expert_applications").select("id, email, full_name").eq("id", body.id).maybeSingle();
    const { data: exp } = app ? { data: null } : await supabase.from("experts").select("id, email, full_name").eq("id", body.id).maybeSingle();
    const email = app?.email ?? exp?.email;
    if (!email) return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    const report = await deleteExpertEverywhere({ applicationId: app?.id ?? null, email });
    await supabase.from("review_actions").insert({
      target_type: "expert_application",
      target_id: body.id,
      action: "delete",
      note: `Deleted ${email} (${report.removed.join(", ")}; Stripe ${report.stripe})`,
      admin_id: guard.adminId,
    });
    return NextResponse.json(report);
  } catch (err) {
    return serverError(err, { route: "DELETE /api/admin/experts" });
  }
}
