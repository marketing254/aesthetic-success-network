import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { requireAdmin } from "@/lib/auth/guards";
import { sendVendorApprovalEmail } from "@/lib/waitlist/confirmationEmail";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { createOrReuseInviteLink } from "@/lib/inviteLinks";
import { normalizeProviderRate } from "@/lib/providerBilling";
import type { VendorStatus } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";
import { appOrigin, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const simple = url.searchParams.get("simple") === "1";

  try {
    const supabase = getSupabaseAdmin();
    if (simple) {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, company_name, display_name, status")
        .eq("status", "approved")
        .order("display_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return NextResponse.json({ vendors: data ?? [] });
    }
    const { data, error } = await supabase
      .from("vendors")
      .select(
        "id, company_name, display_name, category, contact_name, contact_email, plan_id, billing_plan, status, verified, billing_parent_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/vendors" });
  }
}

type Action = "approve" | "reject" | "suspend" | "unsuspend" | "grant_login";

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string; note?: string; rate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed: Action[] = ["approve", "reject", "suspend", "unsuspend", "grant_login"];
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
      .from("vendors")
      .select(
        "id, company_name, contact_name, contact_email, contact_phone, status, verified, category, website, description, calendar_link, billing_plan, billing_parent_id",
      )
      .eq("id", body.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!existing) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    // ---- Grant portal access (covered companies / separate managers) ----
    // Creates the Supabase auth user for this company's contact email so
    // its manager can request an OTP at /vendor/login. Sends NOTHING —
    // the manager signs in themselves (or the principal does, if the email
    // is a plus-alias of their inbox).
    if (action === "grant_login") {
      const email = existing.contact_email?.trim().toLowerCase();
      if (!email || /\.(invalid|local|example)$/i.test(email.split("@")[1] ?? "")) {
        return NextResponse.json(
          { error: "Set a real contact email on this company before granting access." },
          { status: 400 },
        );
      }
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { user_type: "vendor", company: existing.company_name, covered_company: true },
      });
      if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
      // Link auth_user_id so the portal middleware's own-row check resolves
      // this covered company on their first /vendor navigation.
      let authUserId = created?.user?.id ?? null;
      if (!authUserId) {
        for (let page = 1; page <= 5; page += 1) {
          const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
          const u = (list?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
          if (u) { authUserId = u.id; break; }
          if ((list?.users ?? []).length < 200) break;
        }
      }
      if (authUserId) {
        await supabase.from("vendors").update({ auth_user_id: authUserId }).eq("id", existing.id);
      }
      await supabase.from("review_actions").insert({
        target_type: "vendor",
        target_id: existing.id,
        action: "grant_login",
        note: `Portal access granted for ${email}`,
        admin_id: guard.adminId,
      });
      return NextResponse.json({
        ok: true,
        message: `Portal access granted. They sign in at /vendor/login with ${email} (6-digit code goes to that inbox).`,
      });
    }

    // Plan chosen at approval: ladder (6 months free, $39 x 12, then $149)
    // or flat (6 months free, then $39). It is what the agreement, welcome
    // email and portal all show.
    const rate = normalizeProviderRate(body.rate ?? existing.billing_plan);
    const patch: { status: VendorStatus; verified?: boolean; billing_plan?: "ladder" | "flat" } = (() => {
      if (action === "approve") return { status: "approved", verified: true, billing_plan: rate };
      if (action === "reject") return { status: "rejected", verified: false };
      if (action === "suspend") return { status: "suspended" };
      return { status: "approved" };
    })();

    const { error: upErr } = await supabase
      .from("vendors")
      .update(patch)
      .eq("id", body.id);
    if (upErr) throw upErr;

    // Best-effort: log the action + send the approval email.
    await supabase.from("review_actions").insert({
      target_type: "vendor",
      target_id: body.id,
      action,
      note: body.note ?? null,
      admin_id: guard.adminId,
    });

    if (action === "approve" && existing.status !== "approved") {
      // "You're verified" email: sign in, accept the agreement and save a
      // card in the portal. Founding links are never sent from here.
      try {
        await sendVendorApprovalEmail({
          email: existing.contact_email,
          contactName: existing.contact_name,
          companyName: existing.company_name,
          rate,
          portalUrl: appUrl("/vendor/login"),
        });
      } catch (mailErr) {
        console.warn("[admin/vendors] approval email failed:", mailErr);
      }
      await supabase.from("email_events").insert({
        template: "vendor_approved",
        recipient: existing.contact_email,
        subject: `You're verified: ${existing.company_name} is approved for the Aesthetic Success Network`,
        provider: process.env.SMTP_HOST ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "log",
        status: "queued",
        metadata: { vendor_id: body.id, rate },
      });

      // In-app notifications: vendor + admin team
      await insertNotification(supabase, [
        {
          audience: "vendor",
          vendor_id: body.id,
          kind: "vendor_approved",
          title: "You're verified, welcome aboard",
          body: `${existing.company_name} is approved. Sign in, accept the agreement and save a card to activate your listing.`,
          link: "/vendor",
          metadata: { vendor_id: body.id },
        },
        {
          audience: "admin",
          admin_id: null,
          kind: "vendor_approved",
          title: `Company approved: ${existing.company_name}`,
          body: `${existing.contact_name} is verified. Approval email sent; they accept the agreement in the portal.`,
          link: "/admin/vendors?filter=approved",
          metadata: { vendor_id: body.id },
        },
      ]);
    } else if (action === "reject") {
      await insertNotification(supabase, {
        audience: "admin",
        admin_id: null,
        kind: "vendor_rejected",
        title: `Partner rejected: ${existing.company_name}`,
        body: body.note ?? null,
        link: "/admin/vendors?filter=rejected",
        metadata: { vendor_id: body.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/vendors" });
  }
}

/**
 * POST /api/admin/vendors — admin invites a partner (mirrors the
 * admin add-expert flow).
 *
 * The team recruits a partner personally, then adds them here. This:
 *   1. Upserts a `vendors` row (status `approved` — they're pre-vetted).
 *   2. Pre-creates the Supabase auth user for their email so they can
 *      sign in (shouldCreateUser:false on /vendor/login means only
 *      known emails can request a magic link).
 *   3. Sends the magic-link sign-in email so they log in with the exact
 *      email the admin added them under.
 *
 * They then land in the portal, hit the billing gate (no subscription
 * yet), and complete the same agree-and-pay step every partner does —
 * the invite doesn't change the payment path, it just skips the public
 * application form.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    company_name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    secondary_email?: string;
    secondary_phone?: string;
    signature_name?: string;
    signature_title?: string;
    category?: string;
    website?: string;
    description?: string;
    member_offer?: string;
    calendar_link?: string;
    notes?: string;
    // When set, create a COVERED company under this paying partner instead
    // of a new stand-alone partner (multi-company partners).
    billing_parent_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const companyName = (body.company_name ?? "").trim();
  const contactName = (body.contact_name ?? "").trim();
  const email = (body.contact_email ?? "").trim().toLowerCase();
  if (!companyName || !contactName || !email) {
    return NextResponse.json(
      { error: "company_name, contact_name and contact_email are required." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  // ── Covered company (one partner, several companies) ────────────────
  // Creates an extra company listing whose billing + access inherit the
  // paying partner. No card, no subscription, no login / magic-link of its
  // own — the partner signs in through their principal record. Staged as a
  // draft (pending_review); publish with the normal Approve action.
  const billingParentId = (body.billing_parent_id ?? "").trim() || null;
  if (billingParentId) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: parent } = await supabase
        .from("vendors")
        .select("id, company_name, billing_parent_id")
        .eq("id", billingParentId)
        .maybeSingle();
      if (!parent) {
        return NextResponse.json({ error: "Paying partner not found." }, { status: 400 });
      }
      if (parent.billing_parent_id) {
        return NextResponse.json(
          { error: "Pick the paying partner, not another covered company." },
          { status: 400 },
        );
      }

      const { data: inserted, error: insErr } = await supabase
        .from("vendors")
        .insert({
          company_name: companyName,
          display_name: companyName,
          contact_name: contactName,
          contact_email: email,
          contact_phone: body.contact_phone?.trim() || null,
          category: body.category?.trim() || null,
          website: body.website?.trim() || null,
          description: body.description?.trim() || null,
          calendar_link: body.calendar_link?.trim() || null,
          billing_email: email,
          plan_id: "covered",
          billing_parent_id: billingParentId,
          status: "pending_review",
          verified: false,
          months_in_program: 0,
        } as never)
        .select("id")
        .single();
      if (insErr) {
        if (insErr.code === "23505") {
          return NextResponse.json(
            { error: "A partner already exists under this contact email." },
            { status: 409 },
          );
        }
        throw insErr;
      }

      await supabase.from("review_actions").insert({
        target_type: "vendor",
        target_id: inserted.id,
        action: "admin_add_company",
        note: [`Covered company under ${parent.company_name}`, body.member_offer && `Offer: ${body.member_offer}`, body.notes]
          .filter(Boolean)
          .join(" · "),
        admin_id: guard.adminId,
      });
      await insertNotification(supabase, {
        audience: "admin",
        admin_id: null,
        kind: "vendor_company_added",
        title: `Company added under ${parent.company_name}: ${companyName}`,
        body: `Billing is covered by the partner. Draft: approve it to publish.`,
        link: "/admin/vendors?filter=pending_review",
        metadata: { vendor_id: inserted.id, billing_parent_id: billingParentId },
      });
      void notifyTeamEvent({
        kind: "admin_added",
        role: "partner",
        name: companyName,
        email,
        adminLink: appUrl("/admin/vendors?filter=pending_review"),
        highlight: `Extra company under ${parent.company_name}. Billing covered by the partner (no separate charge).`,
        fields: [
          { label: "Company", value: companyName },
          { label: "Under partner", value: parent.company_name },
          { label: "Category", value: body.category },
          { label: "Contact", value: `${contactName} · ${email}` },
          { label: "Member offer", value: body.member_offer },
        ],
      });

      return NextResponse.json({ ok: true, vendor_id: inserted.id, covered: true });
    } catch (err) {
      return serverError(err, { route: "POST /api/admin/vendors" });
    }
  }

  const secondaryEmail = body.secondary_email?.trim().toLowerCase() || null;
  const secondaryPhone = body.secondary_phone?.trim() || null;
  const signatureName = body.signature_name?.trim() || contactName;
  const signatureTitle = body.signature_title?.trim() || null;
  const contactPhone = body.contact_phone?.trim() || null;
  const category = body.category?.trim() || null;
  const website = body.website?.trim() || null;
  const description = body.description?.trim() || null;
  const calendarLink = body.calendar_link?.trim() || null;

  try {
    const supabase = getSupabaseAdmin();

    // Upsert vendors row by contact_email — safe to re-run for the same
    // partner. Invited partners are pre-vetted, so status = approved.
    const { data: existing } = await supabase
      .from("vendors")
      .select("id, status")
      .eq("contact_email", email)
      .maybeSingle();

    let vendorId: string;
    const vendorPatch = {
      company_name: companyName,
      display_name: companyName,
      contact_name: contactName,
      contact_email: email,
      contact_phone: contactPhone,
      category,
      website,
      description,
      calendar_link: calendarLink,
      billing_email: email,
      plan_id: "founding",
      status: "approved" as VendorStatus,
      verified: true,
    };
    if (existing) {
      vendorId = existing.id;
      const { error: upErr } = await supabase
        .from("vendors")
        .update(vendorPatch as never)
        .eq("id", vendorId);
      if (upErr) throw upErr;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("vendors")
        .insert({ ...vendorPatch, months_in_program: 0 } as never)
        .select("id")
        .single();
      if (insErr) throw insErr;
      vendorId = inserted.id;
    }

    // Also create/refresh a vendor_applications row so the full field
    // set (secondary contact, signer, member offer) is captured exactly
    // like a public application — the admin panel reads from there.
    const { data: existingApp } = await supabase
      .from("vendor_applications")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();
    const appPatch = {
      company_name: companyName,
      category,
      website,
      description,
      contact_name: contactName,
      contact_email: email,
      contact_phone: contactPhone,
      secondary_email: secondaryEmail,
      secondary_phone: secondaryPhone,
      signature_name: signatureName,
      signature_title: signatureTitle,
      agreement_version: "v1",
      agreed_to_terms: true,
      confirmed_authority: true,
      plan_id: "founding",
      source: "admin-invite",
      calendar_link: calendarLink,
      status: "pending_review",
      vendor_id: vendorId,
    };
    if (existingApp) {
      await supabase.from("vendor_applications").update(appPatch as never).eq("id", existingApp.id);
    } else {
      await supabase.from("vendor_applications").insert(appPatch as never);
    }

    // Pre-create the auth user so they can request a magic link.
    const { data: createdInvite, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { company: companyName, user_type: "vendor", invited_by_admin: true },
    });
    if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
      console.error("[admin:vendors:invite] auth user create failed:", createErr);
    }
    // Link auth_user_id so the portal middleware's own-row check resolves them.
    let invitedAuthId = createdInvite?.user?.id ?? null;
    if (!invitedAuthId) {
      for (let page = 1; page <= 5; page += 1) {
        const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const u = (list?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
        if (u) { invitedAuthId = u.id; break; }
        if ((list?.users ?? []).length < 200) break;
      }
    }
    if (invitedAuthId) {
      await supabase.from("vendors").update({ auth_user_id: invitedAuthId }).eq("id", vendorId);
    }

    // Send the magic-link sign-in email — they log in with THIS email.
    let magicLinkSent = false;
    try {
      const origin = appOrigin();
      const cookieClient = await createServerSupabase();
      const { error: otpErr } = await cookieClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/vendor&role=vendor`,
          shouldCreateUser: false,
        },
      });
      magicLinkSent = !otpErr;
      if (otpErr) console.error("[admin:vendors:invite] magic-link failed:", otpErr);
    } catch (err) {
      console.error("[admin:vendors:invite] magic-link threw:", err);
    }

    // Audit + admin notification. Member offer + notes are captured in
    // the notification body so they're not lost (no dedicated column).
    await supabase.from("review_actions").insert({
      target_type: "vendor",
      target_id: vendorId,
      action: "admin_invite",
      note: [body.member_offer && `Offer: ${body.member_offer}`, body.notes]
        .filter(Boolean)
        .join(" · ") || null,
      admin_id: guard.adminId,
    });
    await insertNotification(supabase, {
      audience: "admin",
      admin_id: null,
      kind: "vendor_invited",
      title: `Partner invited by admin: ${companyName}`,
      body: `${contactName} (${email}) can now sign in and complete agree-and-pay.${body.member_offer ? ` Offer: "${body.member_offer}".` : ""}`,
      link: "/admin/vendors?filter=approved",
      metadata: { vendor_id: vendorId, invited: true },
    });

    // Email the whole team.
    void notifyTeamEvent({
      kind: "admin_added",
      role: "partner",
      name: contactName,
      email,
      adminLink: appUrl("/admin/vendors?filter=approved"),
      highlight: magicLinkSent
        ? "Sign-in link emailed. They'll complete agree-and-pay in the portal."
        : "Added, but the sign-in email didn't confirm; they can request a link at /vendor/login.",
      fields: [
        { label: "Company", value: companyName },
        { label: "Contact", value: contactName },
        { label: "Category", value: category },
        { label: "Website", value: website },
        { label: "Member offer", value: body.member_offer },
        { label: "Signer", value: signatureName },
        { label: "Notes", value: body.notes },
      ],
    });

    // Standard invite link for this fresh profile — shows in /admin/invites
    // and comes back in the response so it can be copied straight away.
    const inviteLink = await createOrReuseInviteLink(supabase, {
      kind: "partner",
      vendorId,
      fullName: contactName || companyName,
      email,
      companyName,
      createdBy: guard.adminId,
    });

    return NextResponse.json({ ok: true, vendor_id: vendorId, magicLinkSent, invite_url: inviteLink?.invite_url ?? null });
  } catch (err) {
    return serverError(err, { route: "POST /api/admin/vendors" });
  }
}
