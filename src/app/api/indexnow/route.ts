import { NextResponse } from "next/server";

/**
 * POST /api/indexnow — push every public URL to IndexNow so Bing, Yandex,
 * DuckDuckGo and Brave (and therefore ChatGPT search + Copilot, which read
 * the Bing index) recrawl within minutes instead of days. Google ignores
 * IndexNow; the sitemap + Search Console cover Google.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (same secret Vercel cron
 * uses). Call it from a Vercel deploy hook, a cron entry, or by hand:
 *
 *   curl -X POST https://www.aestheticsuccessnetwork.com/api/indexnow \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Optional JSON body `{ "urls": ["https://www...."] }` submits only those
 * URLs (for example right after publishing one blog post). With no body it
 * submits the whole sitemap.
 *
 * Setup: INDEXNOW_KEY env var (8–128 hex chars) and the matching
 * public/<key>.txt file containing the key, which proves domain ownership.
 * The key is public by design, so it's safe in the repo.
 */
const HOST = "www.aestheticsuccessnetwork.com";
const ENDPOINT = "https://api.indexnow.org/IndexNow";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  if (!/^[a-f0-9]{8,128}$/i.test(key)) {
    return NextResponse.json({ error: "INDEXNOW_KEY missing or not 8–128 hex chars." }, { status: 503 });
  }

  let urls: string[] = [];
  try {
    const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
    if (Array.isArray(body?.urls)) urls = body.urls.filter((u): u is string => typeof u === "string");
  } catch {
    /* no body: fall through to the sitemap */
  }
  if (urls.length === 0) {
    const res = await fetch(`https://${HOST}/sitemap.xml`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `sitemap fetch failed: ${res.status}` }, { status: 502 });
    const xml = await res.text();
    urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  }

  // IndexNow rejects URLs whose host differs from the key file's host.
  const urlList = [...new Set(urls.map((u) => u.replace(/^https?:\/\/(www\.)?aestheticsuccessnetwork\.com/i, `https://${HOST}`)))].filter((u) => u.startsWith(`https://${HOST}/`)).slice(0, 10000);
  if (urlList.length === 0) return NextResponse.json({ error: "No URLs on this host to submit." }, { status: 400 });

  const upstream = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
  });

  // 200 = ok, 202 = accepted (key validation pending). Anything else is a config problem.
  return NextResponse.json({ submitted: urlList.length, status: upstream.status, ok: upstream.status === 200 || upstream.status === 202 }, { status: upstream.ok || upstream.status === 202 ? 200 : 502 });
}
