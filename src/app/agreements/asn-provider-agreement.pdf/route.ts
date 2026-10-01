import { NextResponse } from "next/server";
import { html as agreementHtml, meta as agreementMeta } from "@/content/legal/provider-agreement";
import { printHtmlToPdf } from "@/lib/pdf/foundingAgreementPdf";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /agreements/asn-provider-agreement.pdf
 *
 * The public Provider Agreement as a PDF, printed from the SAME content
 * the /agreement/provider page shows (src/content/legal/provider-agreement.ts),
 * so the download can never drift from the page. Replaces the static file
 * that used to live in /public and carried old prices.
 */
let cached: { buffer: Buffer; key: string } | null = null;

export async function GET() {
  try {
    const key = `${agreementMeta}|${agreementHtml.length}`;
    if (!cached || cached.key !== key) {
      const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{margin:0;padding:0 0.85in;font-family:'Inter',system-ui,sans-serif;color:#243140;font-size:10.8pt;line-height:1.55;}
.brand{display:flex;align-items:center;gap:10px;margin:0 0 14px;}
.brand img{width:34px;height:34px;border-radius:8px;}
.brand .n{font-family:'Fraunces',Georgia,serif;font-size:14pt;color:#0a1320;}
.brand .s{font-size:7.5pt;letter-spacing:.2em;text-transform:uppercase;color:#8a6528;}
h1{font-family:'Fraunces',Georgia,serif;color:#1B3A5C;font-size:22pt;margin:0 0 4px;}
.meta{color:#7a8794;font-size:9.5pt;margin:0 0 16px;}
h2{font-family:'Fraunces',Georgia,serif;color:#1B3A5C;font-size:12.5pt;margin:16px 0 4px;break-after:avoid;}
h2 .n{color:#a87d2c;margin-right:8px;font-size:10pt;}
p,li{orphans:3;widows:3;}
ul,ol{padding-left:18px;margin:4px 0 8px;} li{margin-bottom:4px;}
.foot{margin-top:24px;padding-top:10px;border-top:1px solid #e5dfd2;font-size:8.5pt;color:#95a1ad;}
</style></head><body>
<div class="brand"><img src="https://www.aestheticsuccessnetwork.com/asn-nav-icon.png" alt=""><div><div class="n">Aesthetic Success Network</div><div class="s">Powered by Business of Aesthetics</div></div></div>
<h1>Provider Agreement</h1>
<div class="meta">${agreementMeta}</div>
${agreementHtml}
<div class="foot">Aesthetic Success Network, operated by Ekwa Marketing Inc. &middot; Powered by Business of Aesthetics &middot; The current version of this agreement is always at aestheticsuccessnetwork.com/agreement/provider</div>
</body></html>`;
      cached = { buffer: await printHtmlToPdf(page), key };
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
