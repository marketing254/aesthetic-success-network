import { NextResponse } from "next/server";
import { requireVendor } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderAgreementPdf } from "@/lib/pdf/agreementPdf";
import { serverError } from "@/lib/api/errorResponse";
import { providerFreePeriodEnd } from "@/lib/providerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/agreement/draft
 * The signed-in company's OWN Provider Agreement, personalised with its
 * plan (ladder or flat) and dates, before acceptance ("Prepared for").
 * This is what the sign-and-pay card links to, so the PDF a company reads
 * is exactly the one it accepts.
 */
export async function GET() {
  const guard = await requireVendor();
  if (!guard.ok) return guard.response;
  try {
    const sb = getSupabaseAdmin();
    const { data: vendor } = await sb
      .from("vendors")
      .select("contact_name, contact_email, company_name, billing_plan, agreement_version")
      .eq("id", guard.vendorId)
      .maybeSingle();
    if (!vendor) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const { data: app } = await sb
      .from("vendor_applications")
      .select("member_offer")
      .eq("contact_email", vendor.contact_email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pdf = await renderAgreementPdf({
      role: "partner",
      agreementVersion: vendor.agreement_version ?? "v1",
      rate: vendor.billing_plan,
      freePeriodEndsAt: providerFreePeriodEnd().date.toISOString(),
      signer: { name: vendor.contact_name ?? "Partner", email: vendor.contact_email, companyName: vendor.company_name },
      memberOffer: app?.member_offer ?? null,
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
    return serverError(err, { route: "GET /api/vendor/agreement/draft" });
  }
}
