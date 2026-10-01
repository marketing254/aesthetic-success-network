import "server-only";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import {
  COMPANY_LAUNCH_LABEL,
  COMPANY_LAUNCH_MONTHS,
  COMPANY_STANDARD_LABEL,
  EXPERT_RATE_LABEL,
  FOUNDING_EXPERT_FREE_MONTHS,
  PROVIDER_FREE_MONTHS,
  companyStandardStartsAt,
  formatLongDate,
  normalizeProviderRate,
} from "@/lib/providerBilling";

/**
 * Personalized founding agreement renderer (ASN).
 *
 * The founding documents are HTML templates (src/lib/pdf/templates/*.html,
 * bodies ported from the ASN Provider Agreement; ASN's own private founding
 * agreement text is still pending with the owner). We substitute only the
 * documented tokens, then print the result through headless Chrome at
 * Letter size so the attached/signed PDF matches the legal source.
 *
 * Callers name the file ASN-Founding-Agreement-{version}.pdf.
 *
 * Chrome itself differs by environment: on Vercel (or any Lambda-style
 * host) there's no system browser, so we launch the bundled serverless
 * Chromium from @sparticuz/chromium. Locally we drive whatever Chrome/
 * Edge is already installed — no extra setup for developers.
 */

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Fonts are embedded as base64 data URIs rather than fetched from Google
// Fonts at render time. The serverless Chromium starts with almost no
// fonts and has to fetch them fresh on every cold start; if that fetch is
// slow or fails, text falls back to a different font with different
// metrics — shifting pagination and page breaks versus what renders
// locally. Embedding removes that network dependency entirely so the PDF
// is byte-identical regardless of environment. Both files are variable
// fonts, so one file each covers every weight used (600/700 for
// Fraunces, 400/500/600/700 for Inter).
let FONT_FACE_CSS: string | null = null;
async function getFontFaceCss(): Promise<string> {
  if (FONT_FACE_CSS) return FONT_FACE_CSS;
  const [fraunces, inter] = await Promise.all([
    readFile(new URL("./fonts/fraunces-latin.woff2", import.meta.url)),
    readFile(new URL("./fonts/inter-latin.woff2", import.meta.url)),
  ]);
  const frauncesUrl = `data:font/woff2;base64,${fraunces.toString("base64")}`;
  const interUrl = `data:font/woff2;base64,${inter.toString("base64")}`;
  FONT_FACE_CSS = [600, 700]
    .map(
      (w) =>
        `@font-face{font-family:'Fraunces';font-style:normal;font-weight:${w};src:url(${frauncesUrl}) format('woff2');}`,
    )
    .concat(
      [400, 500, 600, 700].map(
        (w) =>
          `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};src:url(${interUrl}) format('woff2');}`,
      ),
    )
    .join("");
  return FONT_FACE_CSS;
}

function loadTemplate(role: FoundingAgreementPdfInput["role"]): Promise<string> {
  switch (role) {
    case "expert":
      return readFile(new URL("./templates/agreement_expert.html", import.meta.url), "utf8");
    case "partner":
      return readFile(new URL("./templates/agreement_partner.html", import.meta.url), "utf8");
    case "both":
      return readFile(new URL("./templates/agreement_expert_partner.html", import.meta.url), "utf8");
  }
}

export type FoundingAgreementPdfInput = {
  role: "partner" | "expert" | "both";
  /**
   * Company plan: "ladder" ($39 x 12 then $149) or "flat" ($39). Experts
   * are always 12 months free then $39. Every template carries a
   * {{RAMP_BLOCK}}; "both" prints both schedules.
   */
  pricing?: string | null;
  /** ISO date the free founding months end, when known (accepted copies). Expert side for role "both". */
  freePeriodEndsAt?: string | null;
  /** Role "both": the company side's free end (companies get 6 months, experts 12). */
  companyFreePeriodEndsAt?: string | null;
  signer: {
    name: string;
    email: string;
    companyName?: string | null;
  };
  // When a partner/expert names several companies, list them here. The PDF
  // itemizes each one and {{COMPANY}} becomes the joined list. Falls back to
  // signer.companyName when omitted.
  companies?: { name: string; category?: string | null; member_offer?: string | null }[] | null;
  memberOffer?: string | null;
  signedAt: Date;
  ipHashLast6: string;
  accepted?: boolean;
};

/**
 * Fee schedule for "3. What it costs". Static HTML, no user input, so it
 * is injected raw like {{COMPANIES_LIST}}.
 *   expert:  12 free months, then $39/mo with no increase.
 *   partner: 6 free months, then $39/mo for 12 months then $149/mo
 *            (ladder) or $39/mo with no increase (flat).
 *   both:    both schedules, labelled.
 */
function rampBlockHtml(
  role: FoundingAgreementPdfInput["role"],
  pricing: FoundingAgreementPdfInput["pricing"],
  freePeriodEndsAt?: string | null,
  companyFreePeriodEndsAt?: string | null,
): string {
  const step = (amount: string, label: string) =>
    `<div class="rstep"><div class="n">${amount}</div><div class="l">${label}</div></div>`;
  const mo = `<span style="font-size:9pt;color:#5C6B7A;">/mo</span>`;
  const heading = (text: string) =>
    `<div style="font-size:9pt;color:#5C6B7A;margin:6px 0 0;font-weight:600;">${text}</div>`;
  const tail =
    " A card is saved at acceptance; nothing is charged until your free months end, and we remind you 7 days before the first charge.";

  // Expert: 12 free months, then $39 flat.
  const eUntil = formatLongDate(freePeriodEndsAt ?? null);
  const eFreeLabel = eUntil ? `Free until ${eUntil}` : `First ${FOUNDING_EXPERT_FREE_MONTHS} months free`;
  const eFreeSentence = eUntil
    ? `Your first ${FOUNDING_EXPERT_FREE_MONTHS} months are free, through ${eUntil}.`
    : `Your first ${FOUNDING_EXPERT_FREE_MONTHS} months are free, starting the day the network opens to members.`;
  const expertBlock =
    `<div class="ramp">${step("$0", eFreeLabel)}${step(`${EXPERT_RATE_LABEL}${mo}`, "After that &middot; no increase")}</div>` +
    `<p style="font-size:9pt;color:#5C6B7A;">${eFreeSentence} After that your expert access is ${EXPERT_RATE_LABEL} a month, and it stays ${EXPERT_RATE_LABEL} for as long as it stays continuously active.${tail}</p>`;

  // Company: 6 free months, then ladder ($39 x 12, then $149) or flat ($39).
  const cEnd = companyFreePeriodEndsAt ?? (role === "partner" ? freePeriodEndsAt : null) ?? null;
  const cUntil = formatLongDate(cEnd);
  const cFreeLabel = cUntil ? `Free until ${cUntil}` : `First ${PROVIDER_FREE_MONTHS} months free`;
  const cFreeSentence = cUntil
    ? `Your first ${PROVIDER_FREE_MONTHS} months are free, through ${cUntil}.`
    : `Your first ${PROVIDER_FREE_MONTHS} months are free, starting the day the network opens to members.`;
  const stdFrom = cEnd ? formatLongDate(companyStandardStartsAt(new Date(cEnd))) : null;
  const companyBlock =
    normalizeProviderRate(pricing) === "flat"
      ? `<div class="ramp">${step("$0", cFreeLabel)}${step(`${COMPANY_LAUNCH_LABEL}${mo}`, "After that &middot; no increase")}</div>` +
        `<p style="font-size:9pt;color:#5C6B7A;">${cFreeSentence} After that your company listing is ${COMPANY_LAUNCH_LABEL} a month, and it stays ${COMPANY_LAUNCH_LABEL} for as long as it stays continuously active.${tail}</p>`
      : `<div class="ramp">${step("$0", cFreeLabel)}${step(`${COMPANY_LAUNCH_LABEL}${mo}`, `Next ${COMPANY_LAUNCH_MONTHS} months &middot; launch rate`)}${step(`${COMPANY_STANDARD_LABEL}${mo}`, stdFrom ? `From ${stdFrom} &middot; standard` : "After that &middot; standard")}</div>` +
        `<p style="font-size:9pt;color:#5C6B7A;">${cFreeSentence} After that your company listing is ${COMPANY_LAUNCH_LABEL} a month for your first ${COMPANY_LAUNCH_MONTHS} paid months, then ${COMPANY_STANDARD_LABEL} a month (the standard company rate) for as long as it stays continuously active.${tail}</p>`;
  if (role === "expert") return expertBlock;
  if (role === "partner") return companyBlock;
  return heading("Expert access") + expertBlock + heading("Company listing") + companyBlock;
}

/** Join names for prose: ["A","B","C"] → "A, B and C". */
function joinAnd(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEffectiveDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function memberOfferFor(
  input: FoundingAgreementPdfInput,
  companyCount: number,
): string {
  if (input.role === "expert") return "";
  // Multi-company agreements list each company's own offer under
  // "Companies covered" in Schedule B — the single line just points there.
  if (companyCount > 1) {
    return 'Per company: each offer is listed under "Companies covered" in Schedule B.';
  }
  const offer = input.memberOffer?.trim() || input.companies?.[0]?.member_offer?.trim();
  return offer || "To be confirmed before your listing goes live.";
}

async function renderAgreementHtml(input: FoundingAgreementPdfInput): Promise<string> {
  const [template, fontFaceCss] = await Promise.all([loadTemplate(input.role), getFontFaceCss()]);
  const accepted = input.accepted !== false;

  // Resolve the company list. Prefer the explicit companies[]; fall back to
  // the single companyName so single-company invites are unchanged.
  const companyList = (input.companies ?? [])
    .map((c) => ({
      name: (c.name ?? "").trim(),
      category: c.category?.trim() || null,
      member_offer: c.member_offer?.trim() || null,
    }))
    .filter((c) => c.name);
  const fallbackName = input.signer.companyName?.trim() || input.signer.name;
  const names = companyList.length ? companyList.map((c) => c.name) : [fallbackName];
  const companyJoined = joinAnd(names);

  // The primary company's offer may live on the invite itself rather than
  // the companies[0] entry — fold it in so the itemized list is complete.
  if (companyList.length > 0 && !companyList[0].member_offer && input.memberOffer?.trim()) {
    companyList[0].member_offer = input.memberOffer.trim();
  }

  const tokens: Record<string, string> = {
    SIGNER_NAME: input.signer.name,
    SIGNER_EMAIL: input.signer.email,
    COMPANY: companyJoined,
    MEMBER_OFFER: memberOfferFor(input, companyList.length),
    EFFECTIVE_DATETIME: formatEffectiveDate(input.signedAt),
    STATUS: accepted
      ? `Accepted electronically. IP fingerprint SHA-256 ${input.ipHashLast6}`
      : "Awaiting electronic acceptance via your private invite link",
  };

  // Itemized list for the "Companies covered" block — each company with its
  // category AND its own member-exclusive offer. Injected raw (after the
  // escaped-token pass) with every value individually escaped.
  const listSource = companyList.length
    ? companyList
    : names.map((n) => ({ name: n, category: null as string | null, member_offer: null as string | null }));
  const companiesListHtml = listSource
    .map((c) => {
      const offer =
        input.role === "expert"
          ? ""
          : `<div style="font-size:9pt;color:#3B4A55;margin-top:1px;"><span style="color:#7a8794;">Member offer:</span> ${
              c.member_offer
                ? escapeHtml(c.member_offer)
                : "to be confirmed before this listing goes live"
            }</div>`;
      return `<li style="margin-bottom:5px;">${escapeHtml(c.name)}${
        c.category ? ` <span style="color:#7a8794;">&middot; ${escapeHtml(c.category)}</span>` : ""
      }${offer}</li>`;
    })
    .join("");

  const withFonts = template.replace("{{FONT_FACE_CSS}}", fontFaceCss);
  const withTokens = Object.entries(tokens).reduce(
    (html, [token, value]) => html.replaceAll(`{{${token}}}`, escapeHtml(value)),
    withFonts,
  );
  return withTokens
    .replaceAll("{{COMPANIES_LIST}}", companiesListHtml)
    .replaceAll("{{RAMP_BLOCK}}", rampBlockHtml(input.role, input.pricing, input.freePeriodEndsAt, input.companyFreePeriodEndsAt));
}

async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }
  const { resolveLocalChromeExecutable } = await import("./resolveLocalChrome");
  return puppeteer.launch({
    executablePath: resolveLocalChromeExecutable(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

export async function printHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // Templates pull Google Fonts via a <link>, which doesn't block the
    // load event — wait for the actual font files so the PDF doesn't
    // print with the fallback font.
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      // Real page margins on EVERY page. The templates used to carry the
      // whole margin inside the body, so page 2 onward printed flush
      // against the paper edge and large "keep together" blocks left
      // half-empty pages. Side margins stay in the template (.wrap).
      margin: { top: "0.7in", bottom: "0.7in", left: "0", right: "0" },
      timeout: 30_000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function renderFoundingAgreementPdf(
  input: FoundingAgreementPdfInput,
): Promise<Buffer> {
  return printHtmlToPdf(await renderAgreementHtml(input));
}
