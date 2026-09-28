import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { renderFoundingAgreementPdf } from "@/lib/pdf/foundingAgreementPdf";
import { sendFoundingInviteEmail } from "@/lib/email/foundingInvite";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { appOrigin, appUrl } from "@/lib/stripe";
import type { FoundingInviteRole } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Placeholder / undeliverable addresses used while an invite's real
 * contact detail is still TBD. The send action refuses these so a draft
 * can never be emailed to a fake inbox.
 */
function isSendableEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 320) return false;
  const domain = e.split("@")[1] ?? "";
  if (domain.endsWith(".invalid") || domain.endsWith(".local") || domain.endsWith(".example")) {
    return false;
  }
  return true;
}

/**
 * PATCH /api/admin/founding-invite/[id]
 * Edit a draft (or not-yet-accepted) invite's details.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  let body: Partial<{
    role: FoundingInviteRole;
    full_name: string;
    email: string;
    company_name: string;
    member_offer: string;
    phone: string;
    notes: string;
    website: string;
    category: string;
    calendar_link: string;
    description: string;
    secondary_email: string;
    secondary_phone: string;
    signer_name: string;
    signer_title: string;
    companies: unknown[];
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("founding_invites")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  if (invite.status === "accepted" || invite.status === "revoked") {
    return NextResponse.json(
      { error: `This invite is ${invite.status} and can no longer be edited.` },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role) {
    if (body.role !== "expert" && body.role !== "partner" && body.role !== "both") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    patch.role = body.role;
  }
  {
    const plan = (body as { pricing_plan?: unknown }).pricing_plan;
    if (plan === "ladder" || plan === "flat_49") patch.pricing_plan = plan;
  }
  if (typeof body.full_name === "string") {
    const v = body.full_name.trim();
    if (v.length < 2) return NextResponse.json({ error: "Full name is too short." }, { status: 400 });
    patch.full_name = v;
  }
  if (typeof body.email === "string") {
    patch.email = body.email.trim().toLowerCase();
  }
  if (typeof body.company_name === "string") patch.company_name = body.company_name.trim() || null;
  if (typeof body.member_offer === "string") patch.member_offer = body.member_offer.trim() || null;
  if (typeof body.phone === "string") patch.phone = body.phone.trim() || null;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
  if (typeof body.website === "string") patch.website = body.website.trim() || null;
  if (typeof body.category === "string") patch.category = body.category.trim() || null;
  if (typeof body.calendar_link === "string") patch.calendar_link = body.calendar_link.trim() || null;
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.secondary_email === "string")
    patch.secondary_email = body.secondary_email.trim().toLowerCase() || null;
  if (typeof body.secondary_phone === "string") patch.secondary_phone = body.secondary_phone.trim() || null;
  if (typeof body.signer_name === "string") patch.signer_name = body.signer_name.trim() || null;
  if (typeof body.signer_title === "string") patch.signer_title = body.signer_title.trim() || null;
  if (Array.isArray(body.companies)) {
    const cleaned = body.companies
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        name: String((c as { name?: unknown }).name ?? "").trim(),
        category: ((c as { category?: string }).category ?? "")?.trim() || null,
        website: ((c as { website?: string }).website ?? "")?.trim() || null,
        description: ((c as { description?: string }).description ?? "")?.trim() || null,
        member_offer: ((c as { member_offer?: string }).member_offer ?? "")?.trim() || null,
        contact_name: ((c as { contact_name?: string }).contact_name ?? "")?.trim() || null,
        contact_email: ((c as { contact_email?: string }).contact_email ?? "")?.trim().toLowerCase() || null,
        calendar_link: ((c as { calendar_link?: string }).calendar_link ?? "")?.trim() || null,
      }))
      .filter((c) => c.name);
    patch.companies = cleaned.length ? cleaned : null;
  }

  const { error } = await sb.from("founding_invites").update(patch as never).eq("id", id);
  if (error) return serverError(error, { route: "PATCH /api/admin/founding-invite/[id]" });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/admin/founding-invite/[id]  { action: "send" | "revoke" }
 *
 * "send" is the ONLY action that renders the personalized agreement and
 * emails the private /founding/<code> link. Nothing is sent until an
 * admin triggers it here.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  let action: string | undefined;
  try {
    action = (await req.json())?.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("founding_invites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });

  // ---- Revoke -------------------------------------------------------
  if (action === "revoke") {
    if (invite.status === "accepted") {
      return NextResponse.json(
        { error: "This invite was already accepted and can't be revoked." },
        { status: 409 },
      );
    }
    const { error } = await sb
      .from("founding_invites")
      .update({ status: "revoked", updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) return serverError(error, { route: "POST /api/admin/founding-invite/[id]" });
    return NextResponse.json({ ok: true, status: "revoked" });
  }

  // ---- Notify team (manually fire the team alert) -------------------
  // For people onboarded before the alerts existed, or any time the team
  // needs the email re-sent. Uses the invite's current status to pick the
  // right message: accepted → "accepted", sent/viewed → "invite sent".
  if (action === "notify_team") {
    if (invite.status === "draft" || invite.status === "revoked") {
      return NextResponse.json(
        { error: "Nothing to notify. This invite hasn't been sent yet." },
        { status: 400 },
      );
    }

    if (invite.status === "accepted") {
      // Pull live billing detail from the provisioned partner / expert row.
      let subscriptionStatus: string | null = null;
      let periodEnd: string | null = null;
      let cardOnFile = false;
      if (invite.vendor_id) {
        const { data: v } = await sb
          .from("vendors")
          .select("subscription_status, current_period_end, card_last4")
          .eq("id", invite.vendor_id)
          .maybeSingle();
        subscriptionStatus = v?.subscription_status ?? null;
        periodEnd = v?.current_period_end ?? null;
        cardOnFile = !!v?.card_last4;
      } else if (invite.expert_id) {
        const { data: e } = await sb
          .from("experts")
          .select("subscription_status, current_period_end, card_last4")
          .eq("id", invite.expert_id)
          .maybeSingle();
        subscriptionStatus = e?.subscription_status ?? null;
        periodEnd = e?.current_period_end ?? null;
        cardOnFile = !!e?.card_last4;
      }
      const cardCaptured = invite.role === "partner" || invite.role === "both" || cardOnFile;
      const trialEndsNice = periodEnd
        ? new Date(periodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : null;
      const acceptedNice = invite.accepted_at
        ? new Date(invite.accepted_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : null;
      const emailed = await notifyTeamEvent({
        kind: "invite_accepted",
        role: invite.role,
        name: invite.signer_name || invite.full_name,
        email: invite.email,
        adminLink: appUrl("/admin/founding"),
        highlight: cardCaptured
          ? "Card on file. They're ready to sign in."
          : "Accepted. They're ready to sign in.",
        fields: [
          { label: "Role", value: invite.role === "both" ? "Expert + Partner" : invite.role },
          { label: "Company", value: invite.company_name },
          { label: "Payment method", value: cardCaptured ? "On file" : null },
          { label: "Subscription", value: subscriptionStatus },
          { label: "Free trial ends", value: trialEndsNice },
          { label: "Accepted on", value: acceptedNice },
          { label: "Member offer", value: invite.member_offer },
        ],
      });
      return NextResponse.json({ ok: true, emailed, kind: "invite_accepted" });
    }

    // status sent / viewed → re-fire the "invite sent" alert.
    const inviteUrl = `${appOrigin()}/founding/${invite.code}`;
    const emailed = await notifyTeamEvent({
      kind: "invite_sent",
      role: invite.role,
      name: invite.full_name,
      email: invite.email,
      adminLink: appUrl("/admin/founding"),
      highlight: "Private invite link was emailed with their personalized agreement.",
      fields: [
        { label: "Role", value: invite.role === "both" ? "Expert + Partner" : invite.role },
        { label: "Company", value: invite.company_name },
        { label: "Member offer", value: invite.member_offer },
        { label: "Invite link", value: inviteUrl },
      ],
    });
    return NextResponse.json({ ok: true, emailed, kind: "invite_sent" });
  }

  // ---- Send (or re-send) --------------------------------------------
  if (action === "send") {
    if (invite.status === "accepted") {
      return NextResponse.json({ error: "This invite was already accepted." }, { status: 409 });
    }
    if (invite.status === "revoked") {
      return NextResponse.json(
        { error: "This invite is revoked. Create a new draft to invite them." },
        { status: 409 },
      );
    }
    if (!isSendableEmail(invite.email)) {
      return NextResponse.json(
        { error: "Set a real, deliverable email on this invite before sending." },
        { status: 400 },
      );
    }
    if ((invite.role === "partner" || invite.role === "both") && !invite.company_name) {
      return NextResponse.json(
        { error: "Company name is required before sending a partner / both invite." },
        { status: 400 },
      );
    }

    // Render the personalized (unaccepted) agreement fresh at send time
    // so the latest name / company / offer is what they receive.
    let pdfBuffer: Buffer | null = null;
    let pdfPath: string | null = invite.agreement_pdf_path ?? null;
    const signerName = invite.signer_name || invite.full_name;
    try {
      pdfBuffer = await renderFoundingAgreementPdf({
        role: invite.role,
        pricing: invite.pricing_plan,
        signer: { name: signerName, email: invite.email, companyName: invite.company_name },
        companies: invite.companies ?? undefined,
        memberOffer: invite.member_offer,
        signedAt: new Date(),
        ipHashLast6: "pending",
        accepted: false,
      });
      pdfPath = `founding/${invite.code}.pdf`;
      const { error: upErr } = await sb.storage
        .from("agreements")
        .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        console.error("[admin:founding-invite:send] PDF upload failed", upErr);
        pdfPath = invite.agreement_pdf_path ?? null;
      }
    } catch (err) {
      console.error("[admin:founding-invite:send] PDF render failed", err);
      return NextResponse.json(
        { error: "Couldn't generate the agreement PDF. Nothing was sent." },
        { status: 500 },
      );
    }

    const inviteUrl = `${appOrigin()}/founding/${invite.code}`;
    const sent = await sendFoundingInviteEmail({
      to: invite.email,
      fullName: signerName,
      role: invite.role,
      inviteUrl,
      pdfBuffer,
      pdfFilename: `ASN-Founding-Agreement-${invite.agreement_version}.pdf`,
      agreementVersion: invite.agreement_version,
    });

    // Only advance a draft to 'sent'. A re-send of an already
    // sent/viewed invite keeps its lifecycle status.
    const nextStatus = invite.status === "draft" ? "sent" : invite.status;
    await sb
      .from("founding_invites")
      .update({
        status: nextStatus,
        agreement_pdf_path: pdfPath,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);

    await insertNotification(sb, {
      audience: "admin",
      admin_id: null,
      kind: "founding_invite_sent",
      title: `Founding invite sent: ${invite.full_name}`,
      body: `${invite.role} invite emailed to ${invite.email}.`,
      link: "/admin/founding",
      metadata: { invite_id: invite.id, role: invite.role },
    });

    // Email the whole team that the invite went out.
    void notifyTeamEvent({
      kind: "invite_sent",
      role: invite.role,
      name: invite.full_name,
      email: invite.email,
      adminLink: appUrl("/admin/founding"),
      highlight: sent
        ? "Private invite link emailed with their personalized agreement."
        : "Marked sent, but the email transport didn't confirm. Copy the link and send manually.",
      fields: [
        { label: "Role", value: invite.role === "both" ? "Expert + Partner" : invite.role },
        { label: "Company", value: invite.company_name },
        { label: "Member offer", value: invite.member_offer },
        { label: "Invite link", value: inviteUrl },
      ],
    });

    if (!sent) {
      // Row is updated so the admin can copy the link manually, but be
      // honest that the email transport didn't confirm delivery.
      return NextResponse.json({
        ok: true,
        status: nextStatus,
        emailed: false,
        invite_url: inviteUrl,
        warning: "Saved and marked sent, but the email transport didn't confirm. Copy the link and send it manually if needed.",
      });
    }
    return NextResponse.json({ ok: true, status: nextStatus, emailed: true, invite_url: inviteUrl });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
