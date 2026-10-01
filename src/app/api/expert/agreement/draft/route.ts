import { NextResponse } from "next/server";
import { requireExpert } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { serverError } from "@/lib/api/errorResponse";
import { providerFreePeriodEnd } from "@/lib/providerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expert/agreement/draft
 * The signed-in expert's OWN Provider Agreement, personalised, before
 * acceptance ("Prepared for"). Linked from the sign-and-pay card.
 */
export async function GET() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;
  try {
    const sb = getSupabaseAdmin();
    const { data: expert } = await sb
      .from("experts")
      .select("full_name, email, specialty, agreement_version")
      .eq("id", guard.expertId)
      .maybeSingle();
    if (!expert) return NextResponse.json({ error: "Expert not found." }, { status: 404 });
    const pdf = await renderAgreementPdf({
      role: "expert",
      agreementVersion: expert.agreement_version ?? "v1",
      freePeriodEndsAt: providerFreePeriodEnd().date.toISOString(),
      signer: { name: expert.full_name ?? "Expert", email: expert.email, companyName: expert.specialty ?? null },
      signedAt: new Date(),
      ipHashLast6: "pending",
      accepted: false,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ASN-Provider-Agreement.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/agreement/draft" });
  }
}
