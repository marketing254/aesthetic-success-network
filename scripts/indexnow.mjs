#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * indexnow.mjs — submit URLs to Bing + Yandex via the IndexNow protocol
 * for instant indexing. (Google does NOT honour IndexNow; for Google we
 * rely on the sitemap + Search Console.)
 *
 * Why it matters: Bing, Yandex, DuckDuckGo (Bing-powered), and Brave
 * (also Bing-derived) re-crawl submitted URLs within minutes instead of
 * days. ChatGPT search and Copilot pull from the Bing index, so faster
 * Bing re-crawling also speeds up AI citation refresh.
 *
 * Usage:
 *   # Every URL in the live sitemap:
 *   node scripts/indexnow.mjs
 *
 *   # Specific URLs (override sitemap):
 *   node scripts/indexnow.mjs https://www.aestheticsuccessnetwork.com/pricing
 *
 *   # Dry run (print what would be submitted):
 *   node scripts/indexnow.mjs --dry-run
 *
 * The host is www because Vercel serves production on www and 308s the
 * bare domain there; IndexNow rejects URLs whose host doesn't match the
 * key file's host. The key comes from the INDEXNOW_KEY env var (set it in
 * .env.local; never commit it). The matching key file must exist at
 * /public/<INDEXNOW_KEY>.txt containing the key as its only line.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local so INDEXNOW_KEY is available without exporting it by hand.
// Only keys not already set in the shell are taken from the file.
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
} catch {
  // No .env.local — rely on the shell environment.
}

const HOST = "www.aestheticsuccessnetwork.com";
const API_KEY = (process.env.INDEXNOW_KEY || "").trim();
const KEY_LOCATION = `https://${HOST}/${API_KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";
const SITEMAP = `https://${HOST}/sitemap.xml`;
const SITE_ORIGIN_RE = /^https?:\/\/(www\.)?aestheticsuccessnetwork\.com/i;

const dryRun = process.argv.includes("--dry-run");
const overrideUrls = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (!/^[a-f0-9]{8,128}$/i.test(API_KEY)) {
  console.error(
    "Missing or invalid INDEXNOW_KEY (8-128 hex chars). Set it in .env.local and place the key file at public/<key>.txt.",
  );
  process.exit(1);
}

/** Read the live sitemap and normalise every URL onto the www host. */
async function sitemapUrls() {
  const res = await fetch(SITEMAP, { redirect: "follow" });
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const normalised = urls.map((u) => u.replace(SITE_ORIGIN_RE, `https://${HOST}`));
  return [...new Set(normalised)];
}

const urls = overrideUrls.length
  ? overrideUrls.map((u) => u.replace(SITE_ORIGIN_RE, `https://${HOST}`))
  : await sitemapUrls();

const payload = { host: HOST, key: API_KEY, keyLocation: KEY_LOCATION, urlList: urls };

console.log(`IndexNow → ${ENDPOINT}`);
console.log(`Submitting ${urls.length} URL${urls.length === 1 ? "" : "s"}:`);
for (const u of urls) console.log("  •", u);

if (dryRun) {
  console.log("[dry-run] payload:");
  console.log(JSON.stringify({ ...payload, key: "<INDEXNOW_KEY>" }, null, 2));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

const body = await res.text().catch(() => "");
console.log(`Status: ${res.status} ${res.statusText}`);
if (body) console.log(`Body  : ${body}`);

if (res.status === 200 || res.status === 202) {
  console.log("✓ Submitted. Bing/Yandex will recrawl within minutes.");
  process.exit(0);
}
console.error("✗ Submission failed. Check the host + keyLocation match.");
process.exit(1);
