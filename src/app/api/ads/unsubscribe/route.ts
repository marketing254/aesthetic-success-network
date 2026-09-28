import { NextResponse } from "next/server";
import { stopSequenceOnUnsubscribe } from "@/lib/abandoned";
import { appUrl } from "@/lib/stripe";
import { escapeHtml } from "@/lib/email/escapeHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ads/unsubscribe?u=… — one-click unsubscribe for the abandoned
 * registration sequence. Stops the sequence immediately (SPEC stop
 * condition) and shows a plain confirmation page. Unknown tokens get the
 * same page — no probing signal.
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  try {
    if (u) await stopSequenceOnUnsubscribe(u);
  } catch (err) {
    console.error("[ads:unsubscribe] failed:", err);
  }
  const startUrl = appUrl("/start");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed | Aesthetic Success Network</title></head>
<body style="background:#F6F1E7;margin:0;padding:60px 16px;font-family:Georgia,serif;color:#0A1320;text-align:center;">
  <div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #E6DDCF;border-radius:12px;padding:36px 32px;">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#D9A84B;margin:0 0 14px;font-family:Arial,sans-serif;">Aesthetic Success Network</p>
    <h1 style="font-size:22px;margin:0 0 12px;">You're unsubscribed.</h1>
    <p style="font-size:15px;line-height:1.65;color:#3B4A55;margin:0;">No more emails about finishing your registration. If you ever want back in, the door is at
    <a href="${escapeHtml(startUrl)}" style="color:#A07823;">www.aestheticsuccessnetwork.com/start</a>.</p>
    <p style="font-size:12px;line-height:1.6;color:#8A929E;margin:18px 0 0;font-family:Arial,sans-serif;">Aesthetic Success Network, operated by Ekwa Marketing Inc. Powered by Business of Aesthetics.</p>
  </div>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
