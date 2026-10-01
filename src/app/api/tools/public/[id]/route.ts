import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { isPublicTool, toolById } from "@/lib/toolsData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tools/public/[id]
 *
 * Serves ONE allow-listed tool (PUBLIC_TOOL_IDS in toolsData) to anyone,
 * for the "try it free" panel on /tools/[id]. Every other tool stays
 * behind /api/member/tools/[id] and a member session.
 *
 * The inputs work as-is. Before sending, we inject a small script that
 * (1) MASKS the results — every computed figure is overwritten with
 * "$•••,•••" after the tool's own calc runs, so the numbers are not in
 * the DOM, not in a screenshot, and not recoverable from dev tools —
 * (2) blurs the results panel and drops a "results are for members"
 * card into it, and (3) turns the PDF button and Ctrl+P into the same
 * membership gate, with a print stylesheet that blanks the page.
 *
 * The masking is written against the first allow-listed tool's result element ids
 * (the DMN-era write-off calculator; see src/lib/toolsData.ts). If a second tool is
 * ever allow-listed, give it its own RESULT_IDS entry.
 */
/**
 * Result element ids per tool (masked for non-members). Keep in sync with
 * the ids used inside each tools-html file.
 */
const RESULT_IDS_BY_TOOL: Record<string, string[]> = {
  "roi-calculator": ["net", "mult", "deals", "hotline", "savings"],
  "consult-conversion-calculator": ["gain", "annual", "current", "lifted", "rates"],
  "treatment-margin-calculator": ["profit", "margin", "revenue", "pcost", "perunit", "breakdown"],
};

const GATE = `
<style id="asn-gate-style">
  @media print { body > * { display: none !important; } body::before { content: "The PDF is for Aesthetic Success Network members. Join at www.aestheticsuccessnetwork.com/join/member"; display: block; padding: 40px; font: 16px sans-serif; } }
  .grid > .card:nth-child(2) .res-big, .grid > .card:nth-child(2) .res-row, .grid > .card:nth-child(2) .ask, #exitblock { filter: blur(6px); user-select: none; pointer-events: none; }
  .grid > .card:nth-child(2) { position: relative; }
  #asn-lock { position: absolute; left: 16px; right: 16px; top: 96px; background: #fff; border: 1px solid #E0DACE; border-radius: 14px; padding: 20px 18px 16px; text-align: center; box-shadow: 0 20px 40px -20px rgba(10,19,32,.45); z-index: 5; font-family: Inter, system-ui, sans-serif; }
  #asn-lock .ring { width: 40px; height: 40px; border-radius: 50%; background: #0E2A3D; color: #fff; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  #asn-lock h3 { font-family: Fraunces, Georgia, serif; font-weight: 500; font-size: 19px; color: #0A1320; margin: 0 0 6px; }
  #asn-lock p { color: #5C6770; font-size: 13px; line-height: 1.5; margin: 0 0 12px; }
  #asn-lock a { display: inline-block; border-radius: 999px; padding: 9px 16px; font-weight: 700; font-size: 13px; text-decoration: none; margin: 3px; }
  #asn-lock .join { background: #D9A84B; color: #0A1320; }
  #asn-lock .signin { background: #fff; color: #0A1320; border: 1px solid #E0DACE; }
  #asn-gate { position: fixed; inset: 0; background: rgba(10,19,32,.55); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 9999; font-family: Inter, system-ui, sans-serif; }
  #asn-gate.open { display: flex; }
  #asn-gate .card { background: #fff; border-radius: 16px; max-width: 440px; width: 100%; padding: 28px 26px 22px; text-align: center; box-shadow: 0 24px 50px -24px rgba(10,19,32,.5); }
  #asn-gate .ring { width: 48px; height: 48px; border-radius: 50%; background: #0E2A3D; color: #fff; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  #asn-gate h2 { font-family: Fraunces, Georgia, serif; font-weight: 500; font-size: 22px; color: #0A1320; margin: 0 0 8px; }
  #asn-gate p { color: #5C6770; font-size: 14px; line-height: 1.55; margin: 0 0 16px; }
  #asn-gate a { display: inline-block; border-radius: 999px; padding: 11px 20px; font-weight: 700; font-size: 14px; text-decoration: none; margin: 4px; }
  #asn-gate .join { background: #D9A84B; color: #0A1320; }
  #asn-gate .signin { background: #fff; color: #0A1320; border: 1px solid #E0DACE; }
  #asn-gate button { margin-top: 10px; background: none; border: 0; color: #8A929E; font-size: 12px; cursor: pointer; text-decoration: underline; }
</style>
<template id="asn-lock-tpl">
  <div id="asn-lock">
    <div class="ring"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
    <h3>Your results are ready for members</h3>
    <p>Enter your numbers free. Members see the full results and the reframe, and download it all as a PDF.</p>
    <a class="join" href="/join/member" target="_top">Become a member</a>
    <a class="signin" href="/member/login?redirect=%2Fdashboard%2Ftools%2F__ID__" target="_top">Sign in</a>
  </div>
</template>
<div id="asn-gate" role="dialog" aria-modal="true" aria-labelledby="asn-gate-title">
  <div class="card">
    <div class="ring"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
    <h2 id="asn-gate-title">The PDF comes with membership</h2>
    <p>Entering your numbers is free. Members see the results and download them as a PDF, plus the other calculators, the resource library and the expert hotline.</p>
    <a class="join" href="/join/member" target="_top">Become a member</a>
    <a class="signin" href="/member/login?redirect=%2Fdashboard%2Ftools%2F__ID__" target="_top">Sign in</a>
    <div><button type="button" onclick="document.getElementById('asn-gate').classList.remove('open')">Keep using the calculator</button></div>
  </div>
</div>
<script>
  (function () {
    var gate = document.getElementById("asn-gate");
    var open = function () { gate.classList.add("open"); };

    // Mask every computed figure. Listeners run in registration order,
    // so this runs AFTER the tool's calc() on every input and overwrites
    // what it wrote. The real numbers never persist in the DOM.
    var MASK = "$•••,•••";
    var RESULT_IDS = __RESULT_IDS__;
    var mask = function () {
      RESULT_IDS.forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = MASK; });
      var five = document.getElementById("fiveyear"); if (five) five.textContent = "That is " + MASK + " over five years.";
      var m = document.getElementById("marketing"); if (m) m.innerHTML = "The question: <b>if you spent " + MASK + " a year on marketing instead, what would you have?</b>";
    };
    document.querySelectorAll("input").forEach(function (i) { i.addEventListener("input", mask); });
    mask();

    // Lock card inside the results panel.
    var panel = document.querySelector(".grid > .card:nth-child(2)");
    var tpl = document.getElementById("asn-lock-tpl");
    if (panel && tpl) panel.appendChild(tpl.content.cloneNode(true));
    window.print = open;
    document.querySelectorAll("button").forEach(function (b) {
      if (/pdf|print|download/i.test(b.textContent || "")) {
        b.onclick = null;
        b.addEventListener("click", function (e) { e.preventDefault(); open(); });
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) { e.preventDefault(); open(); }
    });
    gate.addEventListener("click", function (e) { if (e.target === gate) gate.classList.remove("open"); });
  })();
</script>
`;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tool = toolById(id);
  // Allow-list first: an unknown or non-public id never touches the disk.
  if (!tool || !isPublicTool(tool.id)) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }

  try {
    const abs = path.join(process.cwd(), "tools-html", tool.file);
    const raw = await fs.readFile(abs, "utf8");
    const resultIds = RESULT_IDS_BY_TOOL[tool.id] ?? [];
    const gate = GATE.replace("__ID__", tool.id).replace("__RESULT_IDS__", JSON.stringify(resultIds));
    const html = raw.includes("</body>") ? raw.replace("</body>", `${gate}</body>`) : raw + gate;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        // Only our own site may frame it.
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tool file unavailable." }, { status: 500 });
  }
}
