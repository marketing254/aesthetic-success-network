import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import {
  sendExpertApprovalEmail,
  sendExpertConfirmationEmail,
  sendVendorApprovalEmail,
} from "@/lib/waitlist/confirmationEmail";
import { sendJoinConfirmationEmail } from "@/lib/email/joinConfirmation";
import { sendFoundingInviteEmail } from "@/lib/email/foundingInvite";
import { sendTrialEndingReminder } from "@/lib/email/trialEndingReminder";
import { notifyTeamEvent } from "@/lib/email/teamNotify";
import { sendAdminCodeEmail } from "@/lib/email/adminCode";
import { renderFoundingAgreementPdf } from "@/lib/pdf/foundingAgreementPdf";
import { providerFreePeriodEnd, providerTermsShort } from "@/lib/providerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/email-previews  { to: "a@x.com, b@x.com" }
 * Sends every EXPERT and COMPANY email template with sample data to the
 * given address(es) so the team can review copy, logo and layout.
 * Member emails are not included: members only join the waitlist and
 * receive nothing until the launch. Admin only.
 *
 * The body of each email shows ONLY the first address as the account
 * email; every address in the list receives a copy.
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/email-previews";
  let to = "";
  try {
    const body = (await req.json()) as { to?: string };
    to = (body.to ?? "").trim();
  } catch {
    /* fall through */
  }
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Give at least one recipient." }, { status: 400 });
  }
  const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
  const accountEmail = recipients[0]!;

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com";
  const now = new Date().toISOString();
  const free = providerFreePeriodEnd();
  const freeEndsAt = free.date.toISOString();
  const results: { name: string; ok: boolean; note?: string }[] = [];
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, note: err instanceof Error ? err.message : String(err) });
    }
  };

  try {
    results.push({
      name: free.provisional
        ? "Note: MEMBER_LAUNCH_DATE is not set, so the free-period dates below are placeholders (12 months from today)"
        : `Free founding months end ${free.date.toDateString()} (MEMBER_LAUNCH_DATE + 6 months)`,
      ok: true,
    });

    // ---------------- Experts ----------------
    await run("Expert 1: application received", () =>
      sendExpertConfirmationEmail({
        application: {
          fullName: "Jordan Lee",
          email: to,
          phone: "(555) 010-2222",
          companyName: "Lee Aesthetics Consulting",
          specialty: "Injectables pricing and margins",
          topics: "Injectables pricing and margins, consult conversion, team hiring",
          bio: "Fifteen years running and coaching aesthetic practices.",
          agreementAccepted: true,
          agreementAcceptedAt: now,
          contentOwnershipConfirmed: true,
          source: "experts-page",
        },
        referenceId: "preview-0002",
        submittedAt: now,
      }),
    );
    await run("Expert 2: approved (sign in, accept the agreement in the portal)", () =>
      sendExpertApprovalEmail({ email: to, firstName: "Jordan", expertId: "preview", activatedAt: now, portalLoginUrl: `${origin}/expert/login` }),
    );
    await run("Expert 3: founding invite agreement (admin Send invite only; PDF attached)", async () => {
      const pdfBuffer = await renderFoundingAgreementPdf({
        role: "expert",
        pricing: "standard",
        signer: { name: "Jordan Lee", email: accountEmail, companyName: "Lee Aesthetics Consulting" },
        signedAt: new Date(),
        ipHashLast6: "pending",
        accepted: false,
      });
      await sendFoundingInviteEmail({
        to,
        fullName: "Jordan Lee",
        role: "expert",
        pricing: "standard",
        companyName: "Lee Aesthetics Consulting",
        inviteUrl: `${origin}/founding/preview-code`,
        pdfBuffer,
        pdfFilename: "ASN-Founding-Agreement-v4.pdf",
        agreementVersion: "v4",
      });
    });
    await run("Expert 4: welcome to the bench (portal live, signed PDF attached)", async () => {
      const pdfBuffer = await renderFoundingAgreementPdf({
        role: "expert",
        pricing: "standard",
        freePeriodEndsAt: freeEndsAt,
        signer: { name: "Jordan Lee", email: accountEmail, companyName: "Lee Aesthetics Consulting" },
        signedAt: new Date(),
        ipHashLast6: "abc123",
        accepted: true,
      });
      await sendJoinConfirmationEmail({
        role: "expert",
        to,
        accountEmail,
        contactName: "Jordan Lee",
        companyName: "Lee Aesthetics Consulting",
        pdfBuffer,
        pdfFilename: "ASN-Founding-Agreement-v4.pdf",
        portalUrl: `${origin}/expert/login`,
        agreementVersion: "v4",
        founding: true,
        freePeriodEndsAt: freeEndsAt,
        cardCaptured: true,
      });
    });
    await run("Expert 5: free founding months end in 7 days", () =>
      sendTrialEndingReminder({
        role: "expert",
        to,
        contactName: "Jordan Lee",
        daysLeft: 7,
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        portalUrl: `${origin}/expert/billing`,
      }),
    );

    // ---------------- Companies ----------------
    const memberOffer = "12% off the LUX laser handpiece for ASN members";
    await run("Company 1: verified / approved (sign in, accept the agreement in the portal)", () =>
      sendVendorApprovalEmail({ email: to, contactName: "Sam Rivera", companyName: "Radiance Devices", rate: "standard", portalUrl: `${origin}/vendor/login` }),
    );
    await run("Company 2: founding invite agreement (admin Send invite only; PDF attached)", async () => {
      const pdfBuffer = await renderFoundingAgreementPdf({
        role: "partner",
        pricing: "standard",
        signer: { name: "Sam Rivera", email: accountEmail, companyName: "Radiance Devices" },
        memberOffer,
        signedAt: new Date(),
        ipHashLast6: "pending",
        accepted: false,
      });
      await sendFoundingInviteEmail({
        to,
        fullName: "Sam Rivera",
        role: "partner",
        pricing: "standard",
        companyName: "Radiance Devices",
        inviteUrl: `${origin}/founding/preview-code`,
        pdfBuffer,
        pdfFilename: "ASN-Founding-Agreement-v4.pdf",
        agreementVersion: "v4",
      });
    });
    await run("Company 3: welcome (one email after acceptance, signed PDF attached)", async () => {
      const pdfBuffer = await renderFoundingAgreementPdf({
        role: "partner",
        pricing: "standard",
        freePeriodEndsAt: freeEndsAt,
        signer: { name: "Sam Rivera", email: accountEmail, companyName: "Radiance Devices" },
        memberOffer,
        signedAt: new Date(),
        ipHashLast6: "abc123",
        accepted: true,
      });
      await sendJoinConfirmationEmail({
        role: "partner",
        rate: "standard",
        to,
        accountEmail,
        contactName: "Sam Rivera",
        companyName: "Radiance Devices",
        pdfBuffer,
        pdfFilename: "ASN-Founding-Agreement-v4.pdf",
        portalUrl: `${origin}/vendor/login`,
        agreementVersion: "v4",
        memberOffer,
        founding: true,
        freePeriodEndsAt: freeEndsAt,
        cardCaptured: true,
      });
    });
    await run("Company 4: free founding months end in 7 days", () =>
      sendTrialEndingReminder({
        role: "partner",
        to,
        contactName: "Sam Rivera",
        daysLeft: 7,
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        portalUrl: `${origin}/vendor/account`,
        rate: "standard",
      }),
    );

    // ---------------- Internal ----------------
    await run("Sign-in code", () => sendAdminCodeEmail(accountEmail, "482913"));
    await run("Team alert: new expert application (goes to TEAM_DISTRIBUTION_LIST)", () =>
      notifyTeamEvent({
        kind: "signup",
        role: "expert",
        name: "Jordan Lee",
        email: "jordan@example.com",
        adminLink: `${origin}/admin/experts?filter=new`,
        fields: [
          { label: "Source", value: "Website expert application (/experts)" },
          { label: "Full name", value: "Jordan Lee" },
          { label: "Email", value: "jordan@example.com" },
          { label: "Phone", value: "(555) 010-2222" },
          { label: "Teaches / coaches on", value: "Injectables pricing and margins" },
          { label: "Topics they'd record", value: "Injectables pricing and margins, consult conversion, team hiring" },
          { label: "Bio", value: "Fifteen years running and coaching aesthetic practices." },
          { label: "Sample link", value: "https://example.com/talk" },
          { label: "Paid courses", value: "Yes" },
          { label: "Website", value: "https://leeaesthetics.example" },
          { label: "Booking link", value: "https://calendly.com/jordan" },
          { label: "Company name", value: "Lee Aesthetics Consulting" },
          { label: "Also list company as partner?", value: "No" },
          { label: "Expert Agreement accepted", value: "Yes" },
          { label: "Content ownership confirmed", value: "Yes" },
          { label: "SMS consent", value: "Yes" },
          { label: "Expert terms", value: providerTermsShort(null, null, { expert: true }) },
        ],
      }),
    );
    await run("Team alert: new company application", () =>
      notifyTeamEvent({
        kind: "signup",
        role: "partner",
        name: "Sam Rivera",
        email: "sam@example.com",
        adminLink: `${origin}/admin/vendors?filter=pending_review`,
        fields: [
          { label: "Source", value: "Website company application (/companies)" },
          { label: "Company", value: "Radiance Devices" },
          { label: "Category", value: "Devices & equipment (lasers, energy-based)" },
          { label: "Website", value: "https://radiance.example" },
          { label: "What they do", value: "Energy-based devices for med spas." },
          { label: "Exclusive member offer", value: memberOffer },
          { label: "Contact name", value: "Sam Rivera" },
          { label: "Contact role", value: "Head of Partnerships" },
          { label: "Contact email", value: "sam@example.com" },
          { label: "Contact phone", value: "(555) 010-3333" },
          { label: "Signer", value: "Sam Rivera, Head of Partnerships" },
          { label: "Booking / calendar link", value: "https://calendly.com/radiance" },
          { label: "Agreed to terms", value: "Yes" },
          { label: "Authorized to commit company", value: "Yes" },
          { label: "SMS consent", value: "No" },
          { label: "Company terms", value: providerTermsShort("standard", null) },
        ],
      }),
    );

    return NextResponse.json({ ok: true, to, results });
  } catch (err) {
    return serverError(err, { route });
  }
}
