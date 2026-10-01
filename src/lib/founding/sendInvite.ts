import "server-only";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderFoundingAgreementPdf } from "@/lib/pdf/foundingAgreementPdf";
import { sendFoundingInviteEmail } from "@/lib/email/foundingInvite";
import { notifyTeamEvent, type SignupField } from "@/lib/email/teamNotify";
import { appOrigin, appUrl } from "@/lib/stripe";
import { insertNotification } from "@/lib/api/notifications";
import { normalizeProviderRate, providerTermsShort } from "@/lib/providerBilling";
import type { FoundingInviteRole, FoundingInvitesRow } from "@/lib/supabase/types";

/**
 * The agreement step, shared by every provider flow:
 *   - admin founding invites (/admin/founding "Send invite")
 *   - website expert approval (/api/admin/experts mark_onboarded)
 *   - website company approval (/api/admin/vendors approve)
 * renders the personalized agreement PDF, uploads it, emails the private
 * /founding/<code> link, advances the invite to "sent", and alerts the
 * team with the full detail of the person and where they came from.
 */

export const AGREEMENT_VERSION = "v4";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Placeholder / undeliverable addresses used while a draft's contact is TBD. */
export function isSendableEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 320) return false;
  const domain = e.split("@")[1] ?? "";
  return !(domain.endsWith(".invalid") || domain.endsWith(".local") || domain.endsWith(".example"));
}

export function genInviteCode(): string {
  // 18 bytes → 24-char base64url, ~144 bits of entropy.
  return crypto.randomBytes(18).toString("base64url");
}

/** Human label for where an invite came from (shown in team alerts). */
export function inviteSourceLabel(notes: string | null | undefined, fallback = "Admin founding invite"): string {
  const m = /^\[source:([^\]]+)\]/.exec(notes ?? "");
  return m ? m[1].trim() : fallback;
}

/** Every detail of an invite as team-alert rows (nothing is hidden from the team). */
export function inviteDetailFields(invite: FoundingInvitesRow, extra: SignupField[] = []): SignupField[] {
  const partnerSide = invite.role === "partner" || invite.role === "both";
  const rate = normalizeProviderRate(invite.pricing_plan);
  const companies = Array.isArray(invite.companies) && invite.companies.length > 1
    ? invite.companies.map((c) => `${c.name}${c.category ? ` (${c.category})` : ""}${c.member_offer ? `: ${c.member_offer}` : ""}`).join("; ")
    : null;
  return [
    { label: "Source", value: inviteSourceLabel(invite.notes) },
    { label: "Role", value: invite.role === "both" ? "Expert + Company" : invite.role === "partner" ? "Company" : "Expert" },
    { label: "Full name", value: invite.full_name },
    { label: "Email", value: invite.email },
    { label: "Phone", value: invite.phone },
    { label: "Company", value: invite.company_name },
    { label: "Category", value: invite.category },
    { label: "Website", value: invite.website },
    { label: "Booking / calendar link", value: invite.calendar_link },
    { label: "Description", value: invite.description },
    { label: "Member offer", value: invite.member_offer },
    { label: "Other companies", value: companies },
    { label: "Signer", value: invite.signer_name ? `${invite.signer_name}${invite.signer_title ? `, ${invite.signer_title}` : ""}` : null },
    { label: "Secondary contact", value: [invite.secondary_email, invite.secondary_phone].filter(Boolean).join(" · ") || null },
    { label: "Expert terms", value: invite.role === "partner" ? null : providerTermsShort(null, null, { expert: true }) },
    { label: "Company terms", value: partnerSide ? providerTermsShort(rate, null) : null },
    { label: "Agreement version", value: invite.agreement_version },
    { label: "Notes", value: (invite.notes ?? "").replace(/^\[source:[^\]]+\]\s*/, "") || null },
    ...extra,
  ];
}

export type SendInviteResult = {
  ok: true;
  emailed: boolean;
  inviteUrl: string;
  status: string;
} | { ok: false; error: string; status?: number };

/**
 * Render + upload the agreement, email the link, mark the invite sent and
 * alert the team. The caller has already validated the invite exists and
 * is not accepted / revoked.
 */
export async function sendFoundingInvite(invite: FoundingInvitesRow): Promise<SendInviteResult> {
  if (!isSendableEmail(invite.email)) {
    return { ok: false, status: 400, error: "This invite still has a placeholder email. Set the real address before sending." };
  }
  const sb = getSupabaseAdmin();
  const signerName = invite.signer_name || invite.full_name;
  const inviteUrl = `${appOrigin()}/founding/${invite.code}`;

  let pdfBuffer: Buffer;
  let pdfPath: string | null = null;
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
      console.error("[founding:send] PDF upload failed", upErr);
      pdfPath = invite.agreement_pdf_path ?? null;
    }
  } catch (err) {
    console.error("[founding:send] PDF render failed", err);
    return { ok: false, status: 500, error: "Couldn't generate the agreement PDF. Nothing was sent." };
  }

  const emailed = await sendFoundingInviteEmail({
    to: invite.email,
    fullName: signerName,
    role: invite.role,
    pricing: invite.pricing_plan,
    companyName: invite.company_name,
    inviteUrl,
    pdfBuffer,
    pdfFilename: `ASN-Founding-Agreement-${invite.agreement_version}.pdf`,
    agreementVersion: invite.agreement_version,
  });

  const nextStatus = invite.status === "draft" ? "sent" : invite.status;
  await sb
    .from("founding_invites")
    .update({ status: nextStatus, agreement_pdf_path: pdfPath, updated_at: new Date().toISOString() } as never)
    .eq("id", invite.id);

  await insertNotification(sb, {
    audience: "admin",
    admin_id: null,
    kind: "founding_invite_sent",
    title: `Agreement sent: ${invite.full_name}`,
    body: `${invite.role} agreement emailed to ${invite.email}.`,
    link: "/admin/founding",
    metadata: { invite_id: invite.id, role: invite.role },
  });

  void notifyTeamEvent({
    kind: "invite_sent",
    role: invite.role,
    name: invite.full_name,
    email: invite.email,
    adminLink: appUrl("/admin/founding"),
    highlight: emailed
      ? "Agreement emailed with their personalized PDF and private link."
      : "Marked sent, but the email transport didn't confirm. Copy the link and send manually.",
    fields: inviteDetailFields(invite, [{ label: "Invite link", value: inviteUrl }]),
  });

  return { ok: true, emailed, inviteUrl, status: nextStatus };
}

export type ApplicantInviteInput = {
  role: FoundingInviteRole;
  /** Company rate: "standard" or "large". */
  rate?: string | null;
  fullName: string;
  email: string;
  companyName?: string | null;
  memberOffer?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  calendarLink?: string | null;
  description?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  secondaryEmail?: string | null;
  secondaryPhone?: string | null;
  /** Where they came from, e.g. "Website expert application". */
  source: string;
  createdBy: string;
};

/**
 * Create (or reuse) the founding invite for someone who applied on the
 * website and was just approved, then send the agreement. Reuses an
 * open invite for the same email so a second approve click never sends
 * a second code.
 */
export async function inviteApplicant(input: ApplicantInviteInput): Promise<SendInviteResult & { inviteId?: string }> {
  const sb = getSupabaseAdmin();
  const email = input.email.trim().toLowerCase();
  const { data: open } = await sb
    .from("founding_invites")
    .select("*")
    .eq("email", email)
    .in("status", ["draft", "sent", "viewed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invite = open as FoundingInvitesRow | null;
  const rate = normalizeProviderRate(input.rate);
  if (invite) {
    const { data: updated } = await sb
      .from("founding_invites")
      .update({ pricing_plan: rate, updated_at: new Date().toISOString() } as never)
      .eq("id", invite.id)
      .select("*")
      .single();
    invite = (updated as FoundingInvitesRow | null) ?? { ...invite, pricing_plan: rate };
  } else {
    const { data: inserted, error } = await sb
      .from("founding_invites")
      .insert({
        pricing_plan: rate,
        code: genInviteCode(),
        role: input.role,
        full_name: input.fullName.trim(),
        email,
        company_name: input.companyName?.trim() || null,
        member_offer: input.memberOffer?.trim() || null,
        phone: input.phone?.trim() || null,
        notes: `[source:${input.source}]`,
        website: input.website?.trim() || null,
        category: input.category?.trim() || null,
        calendar_link: input.calendarLink?.trim() || null,
        description: input.description?.trim() || null,
        secondary_email: input.secondaryEmail?.trim().toLowerCase() || null,
        secondary_phone: input.secondaryPhone?.trim() || null,
        signer_name: input.signerName?.trim() || null,
        signer_title: input.signerTitle?.trim() || null,
        companies: null,
        agreement_version: AGREEMENT_VERSION,
        agreement_pdf_path: null,
        status: "draft",
        created_by: input.createdBy,
      } as never)
      .select("*")
      .single();
    if (error || !inserted) {
      return { ok: false, status: 500, error: error?.message ?? "Couldn't create the agreement invite." };
    }
    invite = inserted as FoundingInvitesRow;
  }
  const result = await sendFoundingInvite(invite);
  return { ...result, inviteId: invite.id };
}
