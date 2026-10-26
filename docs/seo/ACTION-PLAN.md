# ASN SEO Action Plan — what to do next, in order

Companion to `FULL-AUDIT-REPORT.md` (19 Oct 2026). Effort: S = under an hour, M = a day, L = a week+.

## 1. Critical — this week

| # | Action | Effort | Owner |
|---|--------|--------|-------|
| 1.1 | Deploy today's branch (hero LCP fix, headshot images, expert sitemap, IndexNow route). Commit + push when you are ready. | S | dev |
| 1.2 | In Vercel → Project → Settings → Environment Variables (Production), add: `NEXT_PUBLIC_GA_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `INDEXNOW_KEY=3457b5ed6ab81621a42132e524c9b7ad`, `CRON_SECRET` (any long random string). Redeploy. | S | you |
| 1.3 | Google Search Console: verify, submit sitemap, request indexing for /, /pricing, /tools, /experts (steps in §5). | S | you |
| 1.4 | Bing Webmaster Tools: verify (or import from GSC), submit sitemap, run IndexNow once (§6, §7). | S | you |
| 1.5 | Fill `Organization.sameAs` in `src/app/layout.tsx` with LinkedIn, Instagram, Facebook, YouTube, Crunchbase and the Business of Aesthetics URL. | S | dev |

## 2. High — within 2 weeks

| # | Action | Effort |
|---|--------|--------|
| 2.1 | **Publish an `/about` page**: who runs ASN (Business of Aesthetics, Ekwa), the team with photos (already in `public/team`), how experts are vetted, how Protocols are made, contact details. Add `AboutPage` + `Person` JSON-LD. This is the biggest E-E-A-T gap. | M |
| 2.2 | **Publish the two drafted blog articles** (`src/lib/blog.ts`, `published: false`) once approved, and add `/blog` + `/blog/*` to the sitemap. Then commit to 2 articles a month, each answering one query an aesthetic practice owner actually types (see §8 keyword list). | M |
| 2.3 | **Public Protocol preview pages** (`/protocols/[slug]`): title, expert, who it is for, 150–250 word summary, what is inside (file list without links), FAQ, CTA. One per Protocol → 3 pages now, one more each time a Protocol ships. Add `Course` or `LearningResource` JSON-LD. Members-only content stays gated. | M |
| 2.4 | Complete the 5 hidden expert profiles (headshot + bio) so they surface in `/experts` and the sitemap. | S |
| 2.5 | `/join`: add metadata and an H1 ("Join Aesthetic Success Network"). Trim `/experts` and `/companies` meta descriptions to ≤ 155 chars. Put the topic before the brand in every title except the homepage. | S |
| 2.6 | Lazy-load the homepage calculator with `next/dynamic` (`ssr: false`) and reduce font weights to 400/600/700. Target: homepage mobile TBT < 200 ms, LCP < 2.5 s on PageSpeed. | S |
| 2.7 | Turn on Vercel Speed Insights (field CWV) and link GA4 to Search Console. | S |

## 3. Medium — within a month

| # | Action | Effort |
|---|--------|--------|
| 3.1 | Collect the first 5 verified member reviews; publish on `/reviews` with `Review` JSON-LD and `aggregateRating` on the pricing `Product` once ≥ 5 exist. | M |
| 3.2 | Add `BreadcrumbList` JSON-LD + visible breadcrumbs on `/tools/*`, `/experts/*`, `/blog/*`, `/protocols/*`. | S |
| 3.3 | Internal linking: homepage → tools, blog and 3 expert profiles; every blog post → one tool + one Protocol preview; footer → About, Blog, Tools. | S |
| 3.4 | Raise minimum text size to 12 px for footer/micro copy and give nav/footer links ≥ 40 px tap height on mobile. | S |
| 3.5 | Add `/manifest.webmanifest` (name, icons from `public/asn-app-icon*.png`, theme colour). | S |
| 3.6 | Update `public/llms.txt`: "kits" → "Protocols", add links to `/pricing.md`, `/tools`, `/about`, the expert profiles and Protocol previews. Re-ping IndexNow. | S |
| 3.7 | Add 3–5 sourced statistics to the homepage and pricing page (industry no-show rates, consult conversion benchmarks, device ROI). Cite the source inline with a link and a year. | S |

## 4. Backlinks & off-site presence (seo-backlinks) — ongoing

No backlink tool is connected, so start with free data:
- Google Search Console → Links (after verification); Bing Webmaster → Backlinks; Ahrefs Webmaster Tools (free for verified sites) for a full profile with Domain Rating.

Link plan for a new domain (highest value first):
1. **Owned properties**: Business of Aesthetics site and podcast pages, Ekwa Marketing site, every expert's own website ("ASN Expert" badge linking to their profile), every partner company's site (Verified Partner badge). That alone is 10–20 relevant links.
2. **Expert profiles → ASN**: ask each expert to add ASN to their LinkedIn "Experience" and bio links.
3. **Directories that AI engines read**: LinkedIn company page, Crunchbase, G2/Capterra ("Medical Practice Management" category), Product Hunt launch, Trustpilot.
4. **Industry press & podcasts**: pitch "the Expert Hotline" angle to Aesthetic Authority, Modern Aesthetics, Dermatology Times, The Aesthetic Guide, med spa podcasts. One article in each is worth more than 50 directory links.
5. **Expert guest content**: each ASN expert writes one piece for a trade publication with a bio link back to their ASN profile.
6. **Community**: answer practice-owner questions in relevant Reddit (r/medspa, r/PlasticSurgery practice threads), Facebook med spa owner groups and Quora, citing ASN tools where genuinely useful. Reddit is the #2 source for ChatGPT citations.
7. **Tools as link magnets**: the three calculators are linkable assets. Promote them to practice-management newsletters and consultants.

Avoid: paid link packages, PBNs, reciprocal link schemes, and any directory that lists everyone. Disavow nothing until there is an actual manual action.

## 5. Google Search Console — step by step

1. https://search.google.com/search-console → Add property → **URL prefix** `https://www.aestheticsuccessnetwork.com/` (also add a **Domain** property `aestheticsuccessnetwork.com` to catch the bare domain and any subdomains).
2. Verification: choose **HTML tag**, copy only the `content="…"` value, set it as `GOOGLE_SITE_VERIFICATION` in Vercel (Production), redeploy, click Verify. (`src/app/layout.tsx` already renders the tag.) For the Domain property use the DNS TXT record in your registrar.
3. Sitemaps → add `sitemap.xml` → Submit.
4. URL Inspection → paste `/`, `/pricing`, `/tools`, `/experts` → **Request indexing** (one at a time; quota ~10/day).
5. Settings → Users → add the team. Settings → Associations → link the GA4 property.
6. Weekly: Pages (indexing) report for "Crawled, currently not indexed" and "Discovered, not indexed"; Performance report → Queries, filter Position > 10 for pages close to page 1; Core Web Vitals report (appears once there is field data).

## 6. Bing Webmaster Tools — step by step

1. https://www.bing.com/webmasters → Sign in → **Import from Google Search Console** (fastest; copies site + sitemap) **or** Add site manually: `https://www.aestheticsuccessnetwork.com`.
2. If manual: verification → **HTML Meta Tag** → copy the `msvalidate.01` content value → set as `BING_SITE_VERIFICATION` in Vercel → redeploy → Verify.
3. Sitemaps → Submit `https://www.aestheticsuccessnetwork.com/sitemap.xml`.
4. **IndexNow** → the key file is already served at `/3457b5ed6ab81621a42132e524c9b7ad.txt`; after the first ping Bing shows submissions under IndexNow → Insights.
5. Turn on **Site Scan** (free crawler audit) and check Backlinks and Search Performance monthly. Bing feeds ChatGPT search, Copilot and DuckDuckGo, so this is also your AI-visibility channel.

## 7. IndexNow — code and usage

Already in the repo:

- Key file: `public/3457b5ed6ab81621a42132e524c9b7ad.txt` (contains the key; public by design).
- CLI: `scripts/indexnow.mjs` (submits the whole sitemap or given URLs; reads `INDEXNOW_KEY` from `.env.local`).
- API route: `src/app/api/indexnow/route.ts` (new today), protected by `CRON_SECRET`.

Set in Vercel (Production): `INDEXNOW_KEY=3457b5ed6ab81621a42132e524c9b7ad` and `CRON_SECRET=<long random string>`.

Ping after every content change:

```bash
# whole sitemap, from your machine
node scripts/indexnow.mjs

# or hit the deployed endpoint (works from CI, a deploy hook, or cron)
curl -X POST https://www.aestheticsuccessnetwork.com/api/indexnow \
     -H "Authorization: Bearer $CRON_SECRET"

# just the pages you changed
curl -X POST https://www.aestheticsuccessnetwork.com/api/indexnow \
     -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"urls":["https://www.aestheticsuccessnetwork.com/blog/new-post"]}'
```

To automate on every deploy, add to `vercel.json`:

```json
"crons": [
  { "path": "/api/indexnow", "schedule": "0 6 * * 1" }
]
```

(Vercel cron only sends GET, so if you want the cron, add `export const GET = POST;` to the route. Weekly is plenty; IndexNow ignores unchanged URLs.)

Expected response: `{"submitted":16,"status":200,"ok":true}`. A `202` on the first call is normal (key validation pending). `422` means a URL is on the wrong host; `403` means the key file did not match.

## 8. Google Analytics 4 — setup and what to track

1. https://analytics.google.com → Admin → Create property "Aesthetic Success Network" → Web data stream `https://www.aestheticsuccessnetwork.com` → copy the **Measurement ID** (`G-XXXXXXXXXX`).
2. Set `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX` in Vercel (Production) → redeploy. `src/components/analytics/GoogleAnalytics.tsx` already loads gtag with SPA page views and skips `/admin`. The CSP already allows googletagmanager.com and google-analytics.com.
3. Verify with Admin → DebugView while browsing the live site (install the GA Debugger Chrome extension or add `?debug_mode=1`).
4. Admin → Data settings → Data retention → **14 months**. Enable Google Signals only if you accept the consent implications.
5. Mark these as **Key events** (conversions): `generate_lead` (waitlist/founding form), `sign_up` (member join), `begin_checkout`, `purchase` (Stripe success page), `tool_use` (calculator run). Fire them with `window.gtag("event", "generate_lead", {...})` from the form success handlers.
6. Admin → Product links → **Search Console** (organic queries in GA4) and **Google Ads** if used.
7. Reports to watch weekly: Acquisition → Traffic acquisition (Organic Search, Organic Social, Referral); Engagement → Landing page (which pages bring organic visitors); Key events by source.
8. Create one Exploration: Funnel = landing page → /pricing → /join/member → purchase.
9. Add Vercel Speed Insights for field Core Web Vitals alongside GA4.

## 9. Keyword & content targets (starting list)

Pages to create or strengthen, with the query each should own:

| Query family | Page |
|--------------|------|
| aesthetic practice membership / community for med spa owners | / and /about |
| med spa business coaching alternative, aesthetic practice consultant cost | /pricing, blog |
| treatment margin calculator aesthetic, med spa profit margin | /tools/treatment-margin-calculator |
| consult conversion rate med spa, how to convert aesthetic consultations | /tools/consult-conversion-calculator + blog |
| how to choose a new aesthetic device / laser ROI | Protocol preview: Technology Decision |
| med spa consultation script / trust-based consultation | Protocol preview: Trust-First Consultation |
| med spa niche / signature treatment strategy | Protocol preview: Signature Niche |
| [expert name] aesthetic consultant | /experts/[id] |
| aesthetic practice vendors / med spa partner discounts | /companies |

Each blog post: one query in the title, a 40–60-word direct answer under the H1, an H2 per sub-question, one sourced statistic, author byline with credentials, "Updated on" date, FAQ block, link to a tool and a Protocol preview.

## 10. Monthly monitoring checklist

- GSC: impressions, clicks, average position for the 20 target queries; indexing errors.
- Bing WMT: index count, IndexNow submissions, backlinks.
- GA4: organic sessions, key events, top landing pages.
- PageSpeed Insights mobile for `/`, `/pricing`, `/tools`: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- AI visibility (manual, free): ask ChatGPT, Perplexity, Gemini and Google AI Overviews the 10 queries in §9 and log whether ASN is cited and who is instead.
- Re-run `node scripts/indexnow.mjs` after every content release.
