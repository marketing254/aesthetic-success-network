# Changelog

## 2026-09-24: full DMN replication (phase one)

`asn-landing` was rebuilt from the Dental Member Network codebase (`D:/TD - Member Network/landing`, branch `feat/join-signpay-esign`, commit `bdc582c`, the state documented in `../DMN-Replication-Pack/`) with every ASN swap applied. The earlier launch-phase site (waitlist + admin, 27 migrations) is preserved in `../asn-landing-launch-phase-backup-2026-09-24/` (`moved-out/` holds the old `src`, `public`, `supabase`; `dmn-assets-not-used/` holds every DMN person, brand and tool asset that was removed from the copy).

The single source of truth for every swap decision is `ASN-SWAP-CANON.md` in this folder.

### What is in the app now

- Public site: home, experts, partners, pricing, reviews (honest empty state), tools (3 ASN calculators), legal pages, member agreement, provider agreement (one document for experts and partners; `/agreement/vendor` and `/agreement/expert` redirect to it), `/start` paid-ads page, `/welcome`, join flows, founding invite and invite-link acceptance. Resources, blog, jobs and summit pages exist but are held back from the navbar, footer, sitemap and llms.txt.
- Member portal (`/dashboard`), expert portal (`/expert`), partner portal (`/vendor`), job-seeker portal (`/seeker`), admin console (`/admin`, all 25 pages), OTP sign-in for every role.
- Stripe: member checkout, partner and expert sign-and-pay (180-day trial on the $49 growth price), webhook, customer portal, founding invites with subscription schedules, promo codes, referrals.
- Emails: every DMN template with ASN copy, senders on `aestheticsuccessnetwork.com`, and a global sandbox (`EMAIL_SANDBOX`) that redirects every outbound email to `EMAIL_SANDBOX_TO` (default `rushdhaakbar82@gmail.com`) outside production. Slack posts only when `SLACK_ENABLED=true`.
- Database: DMN migrations 0001 to 0066 (edited: 0005 admin seed, 0054 promo seed removed, 0061 aesthetics job roles, 0065 column rename) plus `0067_asn_security_hardening.sql` and `0068_notifications_reconcile.sql`. Operator guide in `supabase/README.md`.

### Phase-one holdbacks (feature flags, all default off)

`NEXT_PUBLIC_JOB_BOARD_ENABLED`, `NEXT_PUBLIC_SHOW_JUST_DROPPED`, `NEXT_PUBLIC_LEAD_MAGNET_ENABLED`, `NEXT_PUBLIC_LIBRARY_ENABLED`, `SUMMIT_ENABLED`, `NEXT_PUBLIC_TOUR_VIDEO_URL`, `NEXT_PUBLIC_COACHING_BOOKING_URL`.

### Security fixes applied while porting (from the pack's "fix first" list)

RLS on `stripe_events`; members no longer client-updatable plus non-security-definer pinning triggers on members, vendors and experts; one-way `early_member_locked` guard; consolidated `resources` policies with a column-level anon grant; `avatars` bucket in a migration; Postgres-backed rate limiter (`check_rate_limit`) with in-memory fallback; rate limits on the two agreement-first application routes; strict code regex before promo and referral lookups; JSON-LD `<` escaping; shared `escapeHtml` in every email; single `hashIp()` that throws in production without a salt; every route error through `errorResponse.ts`; Stripe webhook stores the event only after a successful handler so retries reprocess; upload allow-lists (SVG rejected); dead code removed (magic tokens, anon client, Clerk and Anthropic env); `next` 16.3.6 and `nodemailer` 10.0.10; CSP without YouCanBook.me, Spline and Google Maps; robots.txt no longer blocks `/experts` and `/partners`.

### Verification performed

`tsc --noEmit` (0 errors) and `next build`. No runtime flows, emails, Supabase, Stripe or Slack calls were exercised; the ordered manual test plan is in `../ASN-TEST-CASES.md`.
