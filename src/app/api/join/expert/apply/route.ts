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
 * POST /api/join/expert/apply
 *
 * Public expert application — same shape as /api/join/partner/apply.
 * Inserts an experts row in `invited` status, PDF + email, no Stripe.
 * Card capture happens later in /expert/billing after the team
 * approves and the expert signs in.
 */
type Body = {
  contactName?: string;
  contactEmail?: string;
  focusArea?: string;
  agreementVersion?: string;
  /** Standard invite-link code (/invite/<code>) — marks it accepted. */
  inviteCode?: string;
};

/** Agreement version tags are short ("v1", "v1.2"); the value lands in a filename. */
const VERSION_RE = /^v?\d{1,3}(?:\.\d{1,3})?$/i;
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function POST(req: Request) {
  const route = "POST /api/join/expert/apply";
  const body = (await req.json().catch(() => ({}))) as Body;
  const name = asString(body.contactName);
  const email = normalizeEmail(body.contactEmail);
  const focusArea = asString(body.focusArea);
  const versionRaw = asString(body.agreementVersion) || "v1";

  if (!name || name.length < 2 || name.length > 120) {
    return apiError.badRequest("Enter your name.", route);
  }
  if (!email) {
    return apiError.badRequest("Enter a valid email.", route);
  }
  if (!focusArea || focusArea.length < 2 || focusArea.length > 240) {
    return apiError.badRequest("Enter your topic or firm.", route);
  }
  if (!VERSION_RE.test(versionRaw)) {
    return apiError.badRequest("Unknown agreement version.", route);
  }
  const agreementVersion = versionRaw;

  const ip = clientIp(req);
  const rl = await checkRateLimit(`join-expert:${ip}:${email}`);
  if (!rl.allowed) {
    const res = apiError.rateLimited(route);
    res.headers.set("Retry-After", String(rl.retryAfterSec ?? 60));
    return res;
  }

  const sb = getSupabaseAdmin();
  const signedAt = new Date();
  const ipHash = hashIp(ip);
  const userAgent = req.headers.get("user-agent") ?? null;

  const { data: existing } = await sb
    .from("experts")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  let expertId: string;
  if (existing) {
    if (existing.status === "active" || existing.status === "suspended") {
      return NextResponse.json(
        {
          error:
            "This email is already registered as an expert. Sign in at /expert/login to manage your account.",
        },
        { status: 409 },
      );
    }
    expertId = existing.id;
    await sb
      .from("experts")
      .update({
        full_name: name,
        display_name: name,
        specialty: focusArea,
        agreement_signed_at: signedAt.toISOString(),
        agreement_version: agreementVersion,
        agreement_ip_hash: ipHash,
        agreement_user_agent: userAgent,
      } as never)
      .eq("id", expertId);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from("experts")
      .insert({
        email,
        full_name: name,
        display_name: name,
        specialty: focusArea,
        status: "invited",
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
    expertId = inserted.id;
  }

  // Came through a personalized invite link? Mark it accepted (best-effort).
  const inviteCode = asString(body.inviteCode);
  if (inviteCode && INVITE_CODE_RE.test(inviteCode)) {
    await sb
      .from("invite_links")
      .update({ status: "accepted", accepted_at: signedAt.toISOString(), expert_id: expertId })
      .eq("code", inviteCode)
      .eq("kind", "expert")
      .in("status", ["active", "viewed"]);
  }

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await renderAgreementPdf({
      role: "expert",
      agreementVersion,
      signer: { name, email, companyName: focusArea },
      signedAt,
      ipHashLast6: ipHash.slice(-6),
    });
    const pdfPath = `expert/${expertId}/${signedAt.getTime()}.pdf`;
    const { error: upErr } = await sb.storage
      .from("agreements")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("[join:expert:apply] PDF upload failed", upErr);
    } else {
      await sb
        .from("experts")
        .update({ agreement_pdf_path: pdfPath } as never)
        .eq("id", expertId);
    }
  } catch (err) {
    console.error("[join:expert:apply] PDF render failed", err);
    pdfBuffer = null;
  }

  if (pdfBuffer) {
    void sendJoinConfirmationEmail({
      role: "expert",
      to: email,
      contactName: name,
      companyName: focusArea,
      pdfBuffer,
      pdfFilename: `ASN-Provider-Agreement-${agreementVersion}.pdf`,
      portalUrl: `${appOrigin()}/expert/login`,
      agreementVersion,
    });
  }

  return NextResponse.json({ ok: true, expertId });
}
