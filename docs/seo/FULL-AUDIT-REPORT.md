# Aesthetic Success Network — SEO, Performance & AI-Visibility Audit

Audited: 19 Oct 2026 · Live site: https://www.aestheticsuccessnetwork.com · Stack: Next.js 16 on Vercel, Supabase, MUI

## 1. Executive summary

**SEO Health Score: 68 / 100** (before today's fixes) → **~72 / 100** with the four fixes applied in this branch (hero paint, headshot images, expert profiles in sitemap, IndexNow).

Business type: B2B membership / SaaS-style subscription for aesthetic practice owners (national, US). Not a local business, so no Google Business Profile or map-pack work applies.

The technical foundation is strong (clean robots, sitemap, canonicals, HTTPS + HSTS + CSP, no layout shift, every AI crawler explicitly allowed, llms.txt and pricing.md already live). The site is held back by three things:

1. **Homepage Largest Contentful Paint was 6.5 s on mobile** because the hero headline was hidden until React hydrated. Fixed in code today.
2. **Almost nothing to rank.** 13 URLs in the sitemap, zero blog posts, zero reviews, no About page, expert and company profiles not discoverable by crawlers. Google and AI engines cannot cite pages that do not exist.
3. **No measurement wired up in production.** Google Analytics tag is not loading, Search Console and Bing verification are unset, IndexNow was never activated.

### Top 5 critical issues

| # | Issue | Impact |
|---|-------|--------|
| 1 | Hero headline hidden at `opacity:0` until JS hydrates, then a 0.9 s fade: LCP 6.5 s mobile / 3.3 s desktop | Fails Core Web Vitals on the most important page. **Fixed today.** |
| 2 | Google Analytics not firing in production (`NEXT_PUBLIC_GA_ID` unset); no Search Console / Bing verification tags | You are flying blind. Nothing is measured. |
| 3 | Blog registry empty, `/reviews` empty, no About/Team page, 13 indexable URLs total | No long-tail queries, no E-E-A-T signals, nothing for AI engines to cite beyond the homepage |
| 4 | `/experts` directory loads via client-side fetch; profile pages are server-rendered and indexable but unlinked in HTML and absent from the sitemap | Expert profile pages (the best Person/E-E-A-T pages you have) were invisible to AI crawlers. **Sitemap fixed today.** |
| 5 | Organization schema has `sameAs: []` — no social/Wikipedia/LinkedIn entity links | Weak entity recognition in Google Knowledge Graph and LLMs |

### Top 5 quick wins

1. Set `NEXT_PUBLIC_GA_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY`, `CRON_SECRET` in Vercel → redeploy (15 min).
2. Submit the sitemap in Search Console and Bing Webmaster; run IndexNow once (10 min).
3. Fill `sameAs` with LinkedIn, Instagram, Facebook, YouTube, Crunchbase URLs (5 min).
4. Raise expert headshot quality + weight (done today: 947 KB JPEG → ~30 KB WebP via next/image).
5. Give `/join` a real title, description and H1 (currently inherits the homepage's and has no H1).

## 2. Measurements

### Lab Core Web Vitals (headless Chrome, 4× CPU slowdown, 1.6 Mbps "slow 4G"; PageSpeed API quota was exhausted today)

| Page | Profile | TTFB | FCP | LCP | LCP element | CLS | TBT |
|------|---------|-----:|----:|----:|-------------|----:|----:|
| / | mobile | 534 ms | 4.10 s | **6.53 s** | H1 (JS-gated fade) | 0.000 | 391 ms |
| /pricing | mobile | 66 ms | 1.34 s | 2.94 s | subtitle text | 0.000 | 87 ms |
| /tools | mobile | 55 ms | 1.18 s | 3.35 s | subtitle text | 0.000 | 291 ms |
| /experts | mobile | 76 ms | 1.29 s | 3.36 s | subtitle text | 0.000 | 21 ms |
| / | desktop | 1.65 s* | 2.07 s | 3.27 s | H1 | 0.000 | 231 ms |
| /pricing | desktop | 82 ms | 0.29 s | 1.35 s | H1 | 0.000 | 11 ms |

\* first request of the run; edge cache HIT on retry. Thresholds: LCP good ≤ 2.5 s, CLS good ≤ 0.1, TBT good ≤ 200 ms.

After today's fix the headline paints at first paint and animates from there. Locally LCP now lands ~150 ms after FCP instead of after hydration + 900 ms; expect homepage mobile LCP in the 2.0–2.8 s range on the live edge, with the remaining gap being font + JS download on slow 4G (see §6).

### Mobile / desktop render check (6 pages)

- Horizontal overflow: **none** on any page at 390 px.
- Layout shift: **0.000** everywhere.
- Console errors: **0**.
- Page weight: 100–170 KB transferred for most pages; `/experts` desktop was **1.15 MB** because of one 947 KB headshot JPEG served raw (fixed: now resized WebP via next/image).
- Tap targets: 60–70 % of links/buttons are under 40 px tall (footer links, nav links, pill links). Not a ranking factor any more, but it is a usability flag in Lighthouse.
- Smallest text: 9.9 px on desktop, 10.5–12.5 px on mobile (eyebrows, micro labels, footer). Lighthouse "legible font sizes" wants ≥ 12 px for the bulk of text; eyebrows are fine, body copy is already 16 px+.
- Hero CTA sits just below the first mobile viewport (H1 is 17 words). Worth testing a shorter H1.

### Crawl inventory (live)

| URL | Status | Indexable | Notes |
|-----|-------:|-----------|-------|
| / | 200 | yes | Org + FAQPage JSON-LD, 1,474 words |
| /pricing | 200 | yes | Product + Offer JSON-LD |
| /experts, /companies, /tools, /tools/* (3), /reviews | 200 | yes | `/reviews` has no reviews yet |
| /experts/[id] (3 public) | 200 | yes | Not in sitemap, not in HTML links → **added to sitemap today** |
| /blog | 200 | yes | Empty registry, "no posts yet" |
| /resources, /start | 200 | noindex | Intentional phase-one holdback |
| /partners | 200 | canonical → /companies | fine |
| /join | 200 | yes | **No H1, inherits homepage title/description** |
| /jobs, /summit, /waitlist | 404 | — | 404s correct, but still linked in older material? Verify no inbound links |
| /manifest.webmanifest | 404 | — | Minor: add a web manifest for PWA/installs |

## 3. Technical SEO — 85/100

**Passing**
- `robots.txt` generated from `src/app/robots.ts`: portals disallowed, GPTBot / ChatGPT-User / ClaudeBot / anthropic-ai / PerplexityBot / Google-Extended / Applebot-Extended explicitly allowed, CCBot blocked, sitemap declared.
- Sitemap valid, www host, lastmod present. Trailing-slash and bare-domain → www both 308.
- Canonicals self-referencing on every public page; `/partners` → `/companies` alias correct.
- HTTPS everywhere, HSTS with preload, strict CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`. `X-Powered-By` removed.
- `<html lang="en">`, viewport meta, robots meta with `max-image-preview:large`.
- Fonts self-hosted via `next/font` with `display: swap`, 3 preloads.
- 404 returns a real 404 with noindex.
- Edge cache HIT on all marketing pages (TTFB 55–100 ms warm).

**Gaps**
- Verification tags absent in production HTML (env vars unset).
- No web manifest (404).
- `Cache-Control: max-age=0, must-revalidate` on HTML is Vercel's default; fine, but static assets should (and do) carry long cache headers.
- Sitemap `lastmod` is build time for every static URL. Acceptable, but Google ignores lastmod it can't trust; keep it since redeploys do change copy.

## 4. On-page SEO — 80/100

**Passing**: unique titles and descriptions on every public page, one H1 per page (except `/join`), logical H2 structure, descriptive OG/Twitter tags with a 1200×630 share image, `alt` on all homepage images.

**Gaps**
- Homepage H1 is 17 words. Fine for a brand hero, but it carries no searchable phrase ("aesthetic practice" appears only in the eyebrow). Suggested: keep the headline, add the phrase into the H1 or the first paragraph, e.g. "…for aesthetic practice owners."
- Title tags lead with the brand, not the query: "Aesthetic Success Network | Every practice problem…". For pages other than the homepage, put the topic first ("Pricing for Aesthetic Practice Membership | ASN").
- `/join`: no H1, no own metadata.
- Company logos on `/companies` have empty alt (2 images).
- Meta descriptions on `/experts` and `/companies` are > 160 chars (truncated in SERP).
- Internal linking is thin: homepage links to 16 internal URLs, none to tools or blog; no breadcrumbs on tool/expert pages.

## 5. Content quality & E-E-A-T — 45/100

This is where rankings and AI citations are won, and it is the weakest area.

- **Blog**: registry is empty. The template already emits `BlogPosting` JSON-LD with author/date; it just needs articles. Two draft articles exist in `src/lib/blog.ts` marked unpublished.
- **Reviews**: page exists, states none are published. Google will not show star ratings and AI engines have nothing to quote.
- **About / Team**: none. There are team photos in `public/team` but no page explaining who runs ASN (Business of Aesthetics / Ekwa), credentials, or editorial process. This is the single biggest E-E-A-T gap.
- **Expert profiles**: 3 public now, well-structured (Person schema, bio, specialty). 8 experts exist in the DB; 5 lack headshot or bio so they are hidden. Completing those profiles adds 5 citable pages for free.
- **Protocols**: the 3 Dr Rivkin Protocols are member-only. A public "preview" page per Protocol (title, who it's for, 150-word summary, expert, what's inside, CTA) would create indexable, highly specific pages ("how to decide on a new aesthetic device") without giving away the content.
- **Homepage copy**: strong, specific, has a real FAQ (also in JSON-LD). Good.
- No statistics with sources, no dated "last updated" labels, no author bylines anywhere public.

## 6. Performance — 55/100 before, ~80/100 after today's fix

Root cause of the homepage LCP failure (`src/app/site.css` ~line 412): `.js .hero h1 { opacity: 0 }` until `PageFx` adds `.in` after hydration, then a 0.9 s transition. Replaced with a CSS keyframe animation that starts at first paint; `PageFx` no longer touches hero elements. The no-JS fallback still renders static.

Remaining opportunities, in order of value:
1. **JS on the homepage**: TBT 391 ms on throttled mobile. The homepage ships MUI + the calculator + waitlist form. Lazy-load the calculator (`next/dynamic`, `ssr: false`) below the fold and keep the hero free of client components.
2. **Fonts**: Playfair Display italic + 4 Plus Jakarta weights = 6 font files. Drop to weights 400/600/700 and only the italic you use in headlines.
3. **Third-party**: none on marketing pages today. Keep it that way; load GA via `strategy="afterInteractive"` (already done) and never add Facebook pixel to the public site unless needed.
4. Add `priority` to the first hero image if one is ever added; currently LCP is text, which is ideal.
5. Enable Vercel Speed Insights or CrUX in Search Console to get field data (there is none yet — the site has too little traffic for the CrUX dataset).

## 7. Schema / structured data — 75/100

Present: `Organization` (+ContactPoint) and `WebSite` site-wide, `FAQPage` on home, `Product` + `Offer` ×3 on pricing, `BlogPosting` template, Person on expert pages, JobPosting template. All JSON-LD, server-rendered.

Gaps:
- `Organization.sameAs` is empty. Add LinkedIn, Instagram, Facebook, YouTube, Crunchbase, and the Business of Aesthetics site.
- No `BreadcrumbList` on `/tools/*`, `/experts/*`, `/blog/*`.
- No `WebSite.potentialAction` (SearchAction) — only worth it if you add site search.
- `Product` on pricing has no `aggregateRating`; add once real reviews exist (never fabricate).
- Validate after deploy with https://search.google.com/test/rich-results (FAQ rich results are now limited to government/health sites, so expect "valid, not eligible" for FAQ; it still helps AI extraction).

## 8. AI search readiness (GEO) — 75/100

Strong: every major AI crawler explicitly allowed; `llms.txt` (4.8 KB, well written) and `pricing.md` live; FAQ in both HTML and JSON-LD; clear definitional first paragraph; pricing fully transparent.

Gaps:
- **Third-party presence is near zero**: AI engines cite Wikipedia, Reddit, G2/Capterra, LinkedIn and industry press 6× more than brand sites. ASN has no LinkedIn company page link, no review-site listings, no press.
- `llms.txt` still says "kits" in one bullet; update to "Protocols" and add links to `/pricing.md`, `/tools`, expert profiles.
- No statistics with sources on any page. Even "aesthetic practices lose X% of consults to no-shows (source)" style facts lift citation probability ~37 %.
- Add an `/about` page and bylines so "who is behind this" is answerable.

## 9. Images — 60/100 before, ~80/100 after

- Expert headshots were raw `<img>` from Supabase (947 KB, no alt). Now `next/image` with `sizes`, WebP/AVIF, descriptive alt. Member tool previews and company logos still use plain `<img>`; 2 company logos have empty alt.
- `og-image.png` is 272 KB at 1200×630: fine, but a JPEG/WebP at ~80 KB would share faster on social.

## 10. Backlinks (seo-backlinks)

No DataForSEO or Ahrefs connection is configured in this environment, so no live backlink data could be pulled. Free check options: Bing Webmaster Tools → Backlinks report (once verified), Google Search Console → Links report, Ahrefs Webmaster Tools (free for verified owners). For a brand-new domain the realistic current state is a handful of links from Ekwa / Business of Aesthetics properties. See the action plan §4 for the link strategy.

## 11. Changes made in this branch today (uncommitted)

| File | Change |
|------|--------|
| `src/app/site.css` | Hero entrance now a CSS keyframe from first paint (LCP fix) |
| `src/components/site/PageFx.tsx` | Removed JS-driven hero reveal |
| `src/components/site/ExpertDirectory.tsx` | Headshots via `next/image`, descriptive alt |
| `src/app/sitemap.ts` | Public expert profiles added (DB-driven, house-hidden filtered) |
| `src/app/api/indexnow/route.ts` | New: authenticated endpoint that pings IndexNow with the sitemap or given URLs |
| `public/3457b5ed6ab81621a42132e524c9b7ad.txt` | IndexNow key file (public by design) |
| `.env.local` | `INDEXNOW_KEY` added (set the same value in Vercel) |

Type check and lint pass. Nothing has been committed or pushed.
