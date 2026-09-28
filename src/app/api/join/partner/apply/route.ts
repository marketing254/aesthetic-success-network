import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { sendJoinConfirmationEmail } from "@/lib/email/joinConfirmation";
import { appOrigin } from "@/lib/stripe";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { clientIp, hashIp } from "@/lib/security/hashIp";
import { asString, normalizeEmail } from "@/lib/waitlist/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/join/partner/apply
 *
 * Public partner application. Inserts a vendors row in `pending_review`
 * status with the agreement acceptance stamped on it, renders the
 * signed agreement PDF, uploads it to storage, and emails a copy back
 * to the applicant. No Stripe involved — the card is captured later,
 * inside the portal, after the team approves and the vendor signs in.
 */
type Body = {
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  agreementVersion?: string;
  /** Standard invite-link code (/invite/<code>) — marks it accepted. */
  inviteCode?: string;
};

/** Agreement version tags are short ("v1", "v1.2"); the value lands in a filename. */
const VERSION_RE = /^v?\d{1,3}(?:\.\d{1,3})?$/i;
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function POST(req: Request) {
  const route = "POST /api/join/partner/apply";
  const body = (await req.json().catch(() => ({}))) as Body;
  const name = asString(body.contactName);
  const email = normalizeEmail(body.contactEmail);
  const company = asString(body.companyName);
  const versionRaw = asString(body.agreementVersion) || "v1";

  if (!name || name.length < 2 || name.length > 120) {
    return apiError.badRequest("Enter your name.", route);
  }
  if (!email) {
    return apiError.badRequest("Enter a valid email.", route);
  }
  if (!company || company.length < 2 || company.length > 200) {
    return apiError.badRequest("Enter your company.", route);
  }
  if (!VERSION_RE.test(versionRaw)) {
    return apiError.badRequest("Unknown agreement version.", route);
  }
  const agreementVersion = versionRaw;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`join-partner:${ip}:${email}`);
  if (!rl.allowed) {
    const res = apiError.rateLimited(route);
    res.headers.set("Retry-After", String(rl.retryAfterSec ?? 60));
    return res;
  }

  const sb = getSupabaseAdmin();
  const signedAt = new Date();
  const ipHash = hashIp(ip);
  const userAgent = req.headers.get("user-agent") ?? null;

  // Upsert vendor row. If they applied before (same email) we update
  // the acceptance stamp — never overwrite an already-approved row.
  const { data: existing } = await sb
    .from("vendors")
    .select("id, status")
    .eq("contact_email", email)
    .maybeSingle();

  let vendorId: string;
  if (existing) {
    if (existing.status === "approved" || existing.status === "suspended") {
      return NextResponse.json(
        {
          error:
            "This email is already registered as a partner. Sign in at /vendor/login to manage your account.",
        },
        { status: 409 },
      );
    }
    vendorId = existing.id;
    await sb
      .from("vendors")
      .update({
        company_name: company,
        display_name: company,
        contact_name: name,
        agreement_signed_at: signedAt.toISOString(),
        agreement_version: agreementVersion,
        agreement_ip_hash: ipHash,
        agreement_user_agent: userAgent,
      } as never)
      .eq("id", vendorId);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from("vendors")
      .insert({
        company_name: company,
        display_name: company,
        contact_name: name,
        contact_email: email,
        status: "pending_review",
        agreement_signed_at: signedAt.toISOString(),
        agreement_version: agreementVersion,
        agreement_ip_hash: ipHash,
        agreement_user_agent: userAgent,
        months_in_program: 0,
      } as never)
      .select("id")
      .single();
    if (insErr || !inserted) {
      return serverError(insErr ?? new Error("insert returned no row"), {
        route,
        publicMessage: "Couldn't record your application. Please try again.",
      });
    }
    vendorId = inserted.id;
  }

  // Came through a personalized invite link? Mark it accepted (best-effort).
  const inviteCode = asString(body.inviteCode);
  if (inviteCode && INVITE_CODE_RE.test(inviteCode)) {
    await sb
      .from("invite_links")
      .update({ status: "accepted", accepted_at: signedAt.toISOString(), vendor_id: vendorId })
      .eq("code", inviteCode)
      .eq("kind", "partner")
      .in("status", ["active", "viewed"]);
  }

  // Render + upload PDF. Best-effort — the acceptance columns are
  // already saved so a PDF failure doesn't invalidate the application.
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderAgreementPdf({
      role: "partner",
      agreementVersion,
      signer: { name, email, companyName: company },
      signedAt,
      ipHashLast6: ipHash.slice(-6),
    });
    const pdfPath = `vendor/${vendorId}/${signedAt.getTime()}.pdf`;
    const { error: upErr } = await sb.storage
      .from("agreements")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("[join:partner:apply] PDF upload failed", upErr);
    } else {
      await sb
        .from("vendors")
        .update({ agreement_pdf_path: pdfPath } as never)
        .eq("id", vendorId);
    }
  } catch (err) {
    console.error("[join:partner:apply] PDF render failed", err);
    pdfBuffer = null;
  }

  if (pdfBuffer) {
    void sendJoinConfirmationEmail({
      role: "partner",
      to: email,
      contactName: name,
      companyName: company,
      pdfBuffer,
      pdfFilename: `ASN-Provider-Agreement-${agreementVersion}.pdf`,
      portalUrl: `${appOrigin()}/vendor/login`,
      agreementVersion,
    });
  }

  return NextResponse.json({ ok: true, vendorId });
}
