import { NextResponse } from "next/server";
import { html as agreementHtml, meta as agreementMeta } from "@/content/legal/provider-agreement";
import { renderPublicAgreementPdf } from "@/lib/pdf/publicAgreementPdf";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /agreements/asn-provider-agreement.pdf
 *
 * The public Provider Agreement as a PDF, built from the SAME content the
 * /agreement/provider page shows, so the download can never drift from
 * the page. Pure-JS renderer (no headless browser), so it runs on Vercel.
 */
let cached: { buffer: Buffer; key: string } | null = null;

export async function GET() {
  try {
    const key = `${agreementMeta}|${agreementHtml.length}`;
    if (!cached || cached.key !== key) {
      cached = { buffer: await renderPublicAgreementPdf(agreementMeta, agreementHtml), key };
    }
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ASN-Provider-Agreement.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return serverError(err, { route: "GET /agreements/asn-provider-agreement.pdf" });
  }
}
