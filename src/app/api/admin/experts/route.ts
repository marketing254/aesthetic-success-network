import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { sendExpertApprovalEmail } from "@/lib/waitlist/confirmationEmail";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { createOrReuseInviteLink } from "@/lib/inviteLinks";
import { inviteApplicant } from "@/lib/founding/sendInvite";
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

    // Same path as approving an application: approval email + agreement.
    // The expert row and portal access are created when they accept.
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
      highlight: provisioning?.agreement?.sent
        ? "Approval email and agreement sent. Portal opens when they accept."
        : "Added. The agreement email did not confirm; resend it from /admin/founding.",
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
 * `mark_onboarded` = approve. It sends the "You're approved" email and,
 * right after, the founding expert agreement (private /founding/<code>
 * link with the personalized PDF). The expert row, auth user and Stripe
 * subscription are created when they accept the agreement
 * (/api/founding/[code]/accept), which is also what opens the portal.
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
          ? `Expert approved, agreement sent: ${existing.full_name}`
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

    // APPROVAL (mark_onboarded only): "You're approved" email, then the
    // agreement email with the private acceptance link. Provisioning
    // (expert row, auth user, subscription) happens at acceptance.
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
  email: { sent?: boolean; error?: string };
  agreement: { sent?: boolean; invite_url?: string; error?: string };
};

/**
 * approveExpert
 *
 * Idempotent: re-clicking resends the same agreement link rather than
 * creating a second one. Steps:
 *   1. Send the "You're approved" email (what to gather, terms).
 *   2. Create (or reuse) the founding invite for this applicant and send
 *      the agreement email with their personalized PDF.
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
  const out: ProvisioningReport = { email: {}, agreement: {} };
  const email = application.email.toLowerCase();

  try {
    const firstName = application.full_name.trim().split(/\s+/)[0] ?? application.full_name;
    const result = await sendExpertApprovalEmail({ email, firstName, expertId: application.id });
    out.email = { sent: result.sent };
  } catch (err) {
    console.error("[admin:experts] approval email failed", err);
    out.email = { sent: false, error: "Failed to send the approval email." };
  }

  try {
    const r = await inviteApplicant({
      role: "expert",
      fullName: application.full_name,
      email,
      companyName: application.company_name,
      phone: application.phone,
      website: application.website,
      category: application.specialty,
      calendarLink: application.booking_link,
      description: application.bio ?? application.topics ?? null,
      source: "Website expert application",
      createdBy: adminId,
    });
    out.agreement = r.ok ? { sent: r.emailed, invite_url: r.inviteUrl } : { sent: false, error: r.error };
  } catch (err) {
    console.error("[admin:experts] agreement invite failed", err);
    out.agreement = { sent: false, error: "Failed to send the agreement." };
  }

  // Keep /admin/invites complete; nothing is emailed from here.
  try {
    const supabase = getSupabaseAdmin();
    const { data: expertRow } = await supabase.from("experts").select("id").eq("email", email).maybeSingle();
    if (expertRow) {
      await createOrReuseInviteLink(supabase, {
        kind: "expert",
        expertId: expertRow.id,
        fullName: application.full_name,
        email,
        companyName: application.company_name ?? null,
        createdBy: adminId,
      });
    }
  } catch {
    /* best effort */
  }
  return out;
}
