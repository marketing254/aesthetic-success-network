# ASN test cases (run in this order)

Scope: the DMN → ASN port in `asn-landing` (2026-09-24). Nothing below was executed by the developer; every case is yours to run. Each case has a precondition, steps and the expected result. Tick them off in order; later sections assume earlier ones passed.

Local safety: while `EMAIL_SANDBOX=true` (default outside production) every outbound email goes to `EMAIL_SANDBOX_TO` (`rushdhaakbar82@gmail.com`) with a `[TEST · would go to …]` subject prefix, Slack posts are off unless `SLACK_ENABLED=true`, and every flag-gated surface is hidden. Keep it that way for all local runs.

---

## 0. Setup (do these first)

| # | Case | Steps | Expected |
|---|---|---|---|
| 0.1 | Supabase project ready | Follow `asn-landing/supabase/README.md` steps 1 to 7 (run the 66 SQL files in order). | Every file runs without error; the last two (0067, 0068) finish with "reload schema". |
| 0.2 | Buckets exist | Supabase → Storage. | `vendor-logos`, `catalog-media`, `member-resources`, `kit-thumbnails`, `expert-resources`, `agreements`, `avatars`, `inquiry-packs`, `job-applications`, `job-banners` are listed; `agreements`, `expert-resources`, `job-applications` are private. |
| 0.3 | Auth settings | Supabase → Authentication. | Site URL and redirect URLs set; public sign-ups disabled; custom SMTP = `support@aestheticsuccessnetwork.com`; Magic Link template contains `{{ .Token }}`; OTP expiry 300 s. |
| 0.4 | Admin users | Authentication → Users. | Auth users exist (auto-confirmed, no password) for `lester@ekwa.com`, `rushdha@ekwa.com`, `rushdhaakbar82@gmail.com`; `admin_users` has the same three rows. |
| 0.5 | Env file | `asn-landing/.env.local` | Supabase URL/keys, Stripe TEST keys and price ids, SMTP values filled; `EMAIL_SANDBOX=true`; `TEAM_DISTRIBUTION_LIST=rushdhaakbar82@gmail.com`; all `NEXT_PUBLIC_*_ENABLED` flags `false`. |
| 0.6 | App starts | `cd asn-landing`, `npm run dev`, open http://localhost:3000. | Home page renders, zero console errors. |
| 0.7 | Stripe CLI | `stripe listen --forward-to localhost:3000/api/stripe/webhook`, paste the `whsec_…` into `.env.local`, restart dev. | CLI shows "Ready". |

## 1. Database and RLS (Supabase SQL editor)

| # | Case | Steps | Expected |
|---|---|---|---|
| 1.1 | Admin seed idempotent | Re-run `0005_admin_seed.sql`. | No error; still exactly three admin rows. |
| 1.2 | Job roles enum | `select unnest(enum_range(null::job_role));` | Ten aesthetics values (`injector_rn_np` … `other`); inserting `dental_hygienist` fails. |
| 1.3 | Event column renamed | `select event_member_interest from event_registrations limit 0;` | Works; `rida_member_interest` does not exist. |
| 1.4 | stripe_events locked | As `anon` and `authenticated` (set role), `select * from stripe_events;` | Permission denied. |
| 1.5 | Members not client-updatable | As `authenticated` with a member's JWT, `update members set subscription_status='active' where auth_user_id=auth.uid();` | Permission denied (update revoked). Service role update of `first_name` still works. |
| 1.6 | Vendor/expert pinned columns | As the partner's `authenticated` user, `update vendors set status='approved', verified=true, subscription_status='active' where auth_user_id=auth.uid();` | Statement succeeds but those columns are unchanged; `contact_email` change does apply. Same for `experts.billing_exempt`. |
| 1.7 | Early lock one-way | Service role: set `early_member_locked=true` then try `false`. | Second update raises "cannot be un-set". |
| 1.8 | Resources visibility | Rows A approved+published, B pending, C unpublished. Select as active member, admin, anon, job seeker. | Member: A only. Admin: A, B, C. Anon: A only and `storage_path` column denied. Job seeker: none. |
| 1.9 | Avatars bucket | Inspect `storage.buckets` row `avatars`; try an authenticated upload. | Public, 5 MB, png/jpeg/webp/gif; authenticated upload 403; service-role upload 200 and public GET 200. |
| 1.10 | Rate-limit RPC | `select check_rate_limit('t:1.1.1.1:a@b.c',3,60);` five times. | true, true, true, false, false. As `authenticated`: permission denied for function. |
| 1.11 | Notifications audiences | Service role inserts for audience expert (recipient_auth_user_id), member (member_id), vendor (vendor_id), and an invalid audience. | FK columns auto-filled; invalid audience rejected; each user selects only their own row and can update only `read_at`. |

## 2. Public website

| # | Case | Steps | Expected |
|---|---|---|---|
| 2.1 | Navbar | Desktop and mobile drawer. | What is ASN, Tools, Experts, Partners, Reviews, Pricing, FAQ. No Resources, Blog, Jobs. |
| 2.2 | Header sign-in menu | Click Sign in. | Members → /member/login, Experts → /expert/login, Partners → /vendor/login with aesthetics subtitles. |
| 2.3 | Logo and footer | Inspect header/footer. | `/asn-nav-icon.png`, alt "Aesthetic Success Network"; footer columns Network / Agreements (Member, Provider) / Legal (Refund & Cancellation, Privacy); phone (855) 567-5323; hello@aestheticsuccessnetwork.com; "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics". |
| 2.4 | Home with flags off | Open `/`. | Hero, hotline demo, pricing, FAQ, footer, sticky CTA. No "Just dropped", tour video, reviews or free-kit section. Hero has no "247+" or "The only network". |
| 2.5 | Hotline demo | Read the section. | Steps name (855) 567-5323 and "2 to 3 business days"; illustrative example "My filler margins are shrinking…"; states it is not a live 24/7 line. |
| 2.6 | Pricing section | With founding open, then closed (see 4.6). | Founding $49/mo with $199 strike and "N of 100 left"; closed → $199 "Open enrollment". Never a $99 or "Early" card. Value list has no dollar figures. |
| 2.7 | ROI calculator | Wherever it is mounted (and `/tools/roi-calculator` as a member). | Defaults show $4,812 and 9.2×; all-zero inputs show -$588 (negative allowed); assumptions visible. |
| 2.8 | FAQ | Read all nine. | ASN wording, no member directory, no $6,400, patient-data answer names ASN. |
| 2.9 | /experts | Open. | Ramp cards $0 / $49 / $199, "you keep 70%", no expert names, no stats, no "free for life", application form at #apply with Provider Agreement links. |
| 2.10 | /partners | Open. | Five commitments, ramp cards, "$50 per referred member, paid after their first payment", category chips from the canon list, only BOA and Ekwa logos. |
| 2.11 | /pricing | Open, view source. | No early tier; JSON-LD with www.aestheticsuccessnetwork.com and /asn-logo-full-dark.png; 30-day guarantee. |
| 2.12 | /reviews | Open. | Honest "no verified member reviews yet" page linking /pricing and /#waitlist; no quotes. |
| 2.13 | /tools and /tools/[id] | Open both. | Three tools with coloured placeholder tiles (no broken images); detail page shows www chrome URL and lock card. |
| 2.14 | /resources, /blog, /blog/x | Open each. | Resource library empty state; blog "No posts yet"; any slug 404; no crash. |
| 2.15 | Legal and agreements | /legal/privacy, /legal/refund, /agreement/member, /agreement/provider, /agreement/vendor, /agreement/expert. | ASN draft copy with DRAFT banner; correct contacts (hello@, members@, partners@ + experts@); PDF links `asn-member-agreement.pdf` and `asn-provider-agreement.pdf`; vendor and expert routes redirect to /agreement/provider. |
| 2.16 | /start | Open with flag off. | ASN copy, roles = canon list, $49/$490 only, footer with Business of Aesthetics, support founding@; no named experts, no podcast/CE cards, no Resource-library pill. With `NEXT_PUBLIC_SHOW_JUST_DROPPED=true`: pill and three un-named cards appear. |
| 2.17 | Held-back routes | /summit, /reshani, /jobs. | /summit 404 (flag off); /reshani 404; /jobs 404 rewrite (flag off). |
| 2.18 | robots.txt and sitemap.xml | GET both. | robots disallows /api/, /admin, /dashboard, /vendor/, /expert/, /upgrade, /auth/, /member/login, /seeker; /experts and /partners crawlable; sitemap only www URLs, no /resources, /blog, /jobs, /summit, /start. |
| 2.19 | llms.txt and pricing.md | GET both. | ASN canon prices and contacts, no dental or DMN words. |
| 2.20 | OG and JSON-LD | View source of `/`. | Title ends "| Aesthetic Success Network"; og:image /og-image.png; Organization logo /asn-logo-full-dark.png; no "<" inside ld+json (escaped). |
| 2.21 | Exit intent | Wait 5 s, move cursor out the top. | Dialog once per session (`asn_exit_offer_shown`); CTA /join/member?promo=DIRECT (see owner decision D2). |
| 2.22 | Referral cookie | Visit `/?ref=MAYA7K3X`, then `/?ref=OTHER`, then `/?ref=%25`. | `asn_ref` set once (90 d, httpOnly); second visit keeps the first; malformed sets nothing. |

## 3. Signup and sign-in (all roles)

| # | Case | Steps | Expected |
|---|---|---|---|
| 3.1 | Member signup | /join/member with a fresh email. | 200 → /upgrade; `asn_checkout` cookie (httpOnly, 2 h); `members` row active/founding; team alert email arrives in the sandbox inbox with `[TEST …]` prefix. |
| 3.2 | Member OTP | /member/login → email → code. | Code email arrives from support@aestheticsuccessnetwork.com with subject "Your Aesthetic Success Network sign-in code: ######"; wrong code → generic error; unknown email → not found; unpaid member lands on /upgrade. |
| 3.3 | Expert application | /experts#apply, submit. | 200; `expert_applications` row; "Application received" email with the $0/$49/$199 ramp and 70% line, Reply-To experts@; team alert. |
| 3.4 | Partner application | /partners#apply, submit. | 200; `vendors` row pending_review; confirmation email with the ramp, Reply-To partners@; team alert. Duplicate email → friendly message, no data leak. |
| 3.5 | Expert/Partner/Admin/Seeker OTP | Each login page. | Codes arrive; wrong-role email refused; audit rows in `auth_audit`; landing paths /expert, /vendor, /admin, /seeker. |
| 3.6 | Admin sign-out | /admin → user menu → Sign out. | Lands on /admin/login; reopening /admin redirects to /admin/login. |
| 3.7 | Rate limits | Six POSTs in 10 min to /api/join/expert/apply (same IP + email). | Sixth returns 429 with Retry-After. Same for /api/join/partner/apply and every login route. |
| 3.8 | Promo code lookup | POST /api/member/promo-code with `{code:"%"}`, then a valid active code, then an inactive one. | invalid (no DB query) / valid with trialDays / inactive. |
| 3.9 | Invite link | Admin creates an expert invite link; open /invite/<code>; accept. | Page shows "Your personal invitation · ASN Expert", agreement link asn-provider-agreement.pdf; acceptance stamps the row; expired link message names founding@. |
| 3.10 | Founding invite | Admin drafts a partner (ladder) invite, sends it, opens /founding/<code>, accepts with test card 4242. | Draft is 404 until sent; email carries `ASN-Founding-Agreement-v4.pdf`; page shows "ASN Founding Partner Agreement (v4)" and the $0/$49/$199 ladder; acceptance creates the vendor row and a subscription schedule; team alert links to /admin/founding. |

## 4. Billing (Stripe test mode, CLI listening)

| # | Case | Steps | Expected |
|---|---|---|---|
| 4.1 | Plan picker | /upgrade after 3.1. | Founding $49/$490 card only (no Early); guarantee line. |
| 4.2 | Founding checkout | Pay founding monthly with 4242. | Webhook 200; `stripe_events` row with processed_at; member active, founding_member_locked true; /dashboard opens; Day-0 welcome email in sandbox inbox; team alert "New paid member". |
| 4.3 | Declined card | Pay with 4000 0000 0000 0002. | Declined in Stripe; nothing written; still on /upgrade. |
| 4.4 | Duplicate subscription | Open /upgrade as an active member. | 409 → redirected to the Stripe portal. |
| 4.5 | Early plan refused | POST /api/stripe/checkout `{plan:"early_monthly"}`. | 409 (cap 0). |
| 4.6 | Founding cap | Temporarily set 100 rows `founding_member_locked=true` (or lower the cap in a test build). | Picker and /pricing show Standard $199 only; founding checkout → 409 sold out. |
| 4.7 | Webhook retry | Break the members update (e.g. wrong service key), trigger `checkout.session.completed`, restore, resend the same event id. | First: 500 and NO `stripe_events` row. Resend: processed. Third: `{deduped:true}`. |
| 4.8 | Webhook signature | curl the webhook without a valid signature. | 400 with a generic message. |
| 4.9 | Partner sign-and-pay | Approved partner first login → /vendor/account, add card 4242. | Gate blocks all pages except account; after card: subscription trialing with trial end 180 days out; confirmation email "You're in…" with plain dates for the first $49 charge and the $199 start, attachment `ASN-Provider-Agreement-v1.pdf`. |
| 4.10 | Expert sign-and-pay | Same for a non-exempt expert. | Same behaviour; billing page ladder rows months 1 to 6 / 7 to 12 / 13 onward with $199; "ASN keeps 30%". |
| 4.11 | Founding expert exemption | Admin sets billing exempt on an expert (21st refused). | First 20 succeed, 21st → 409 from the DB trigger; exempt expert never sees the card form. |
| 4.12 | Trial ending | Test clock to day 178 for a partner. | `trial_will_end` → reminder email "Your ASN partner trial ends…" (never to an exempt expert). |
| 4.13 | Payment failed | Test clock past trial with card 0341. | status past_due, gate says update card, team alert. |
| 4.14 | Customer portal | Update card, cancel at period end. | `card_last4` mirrors; `cancel_at_period_end` true; after period end /dashboard → /upgrade. |
| 4.15 | Promo trial | Active promo code at checkout. | Subscription trialing 90 days; redemption row written by the webhook; deactivated code refused. |
| 4.16 | Referral revenue | Referred member pays; replay `invoice.paid`. | `referral_signups.revenue_cents` increases once; replay deduped. |

## 5. Emails and notifications

| # | Case | Steps | Expected |
|---|---|---|---|
| 5.1 | Sandbox default | Any signup locally. | Only `rushdhaakbar82@gmail.com` receives it; subject prefixed `[TEST · would go to <real address>]`; server log line `[email-sandbox]`. |
| 5.2 | Sandbox with BCC | Set `EMAIL_AUDIT_BCC=a@x.com,b@x.com`; trigger Day-0. | Single email, no BCC header, prefix lists the dropped bcc. |
| 5.3 | Sandbox off | `EMAIL_SANDBOX=false` locally, resend 5.1. | Real recipient gets the clean subject. Turn it back on afterwards. |
| 5.4 | Team list | `TEAM_DISTRIBUTION_LIST=" one@x.com , two@x.com "`. | Team alert To "one@x.com, two@x.com" (sandboxed if on). |
| 5.5 | HTML escaping | Founding invite for name `<img src=x onerror=alert(1)> Tester`; vendor contact `O'Brien & <b>Co</b>` then trigger trial-ending. | Rendered emails show the literal text; nothing executes. |
| 5.6 | Onboarding sequence | Backdate `day0_welcome` sent_at and hit GET /api/cron/onboarding locally. | Day 3 (kit match or Slack no-match log only), Day 7 hotline, Day 14 check-in; From "Lester De Alwis <founding@aestheticsuccessnetwork.com>"; no partner names; no em dashes. |
| 5.7 | Abandoned sequence | Start /start checkout, abandon; advance `pending_registrations` timestamps; run the cron. | Emails 1, 2, 3 in sandbox; email 3 carries a single-use code; unsubscribe link renders the ASN page. |
| 5.8 | Trial reminder amounts | Members with tier founding/standard/early and month/year within 7 days of period end; run cron. | Founding $49/mo or $441/yr; standard and early $199/mo or $1,990/yr. |
| 5.9 | Expert / company approval emails | See section 9 (approval now sends the agreement too). | Reply-To experts@ / partners@; shared layout. |
| 5.10 | Beacon pack | Escalate a Beacon question as a paid member. | Email "Your Aesthetic Success Network pack" with `ASN-member-pack.pdf`, phone (855) 567-5323; Slack silent unless `SLACK_ENABLED=true`. |
| 5.11 | Slack gate | Set `SLACK_ENABLED=true` with a test webhook; repeat 5.10. | Post with context "Beacon · Aesthetic Success Network · Member portal" and support@ reply line. |
| 5.12 | Kit no-op | `KIT_API_KEY` unset; POST /api/waitlist. | Log "[kit] not configured"; no ConvertKit request; signup succeeds. |
| 5.13 | Lead magnet | With `LEAD_MAGNETS` empty POST /api/lead-magnets/starter-kit. | 404. After registering the slug: 200, lead row, email sends even if the PDF is missing (logged). |
| 5.14 | Job emails | Flag on; post a job, approve, reject with reason, apply with a CV. | jobs@ sender, support@ reply-to, applicant Reply-To on the practice email, all sandboxed; queue alert To `EMAIL_QUEUE_ALERT_TO`. |
| 5.15 | Supabase OTP template | Request member and admin codes. | Both arrive from "Aesthetic Success Network <support@…>", headline "Your sign-in code"; code rejected after 5 minutes. |

## 6. Member, expert, partner and seeker portals

| # | Case | Steps | Expected |
|---|---|---|---|
| 6.1 | Member sidebar flags | Flags off, then `NEXT_PUBLIC_LIBRARY_ENABLED=true` and `NEXT_PUBLIC_JOB_BOARD_ENABLED=true` (restart). | Off: Overview, Experts, Partners, Tools, Network, Inbox, Profile. On: Resource library, Systems, Jobs appear; never "Practice Playbooks". |
| 6.2 | Member chrome | /dashboard. | (855) 567-5323, members@, ASN footer, notifications bell. |
| 6.3 | Overview and library empty states | No resources rows. | "No kits published yet"; systems page "No systems published yet"; /dashboard/systems/x 404. |
| 6.4 | Coaching card | `NEXT_PUBLIC_COACHING_BOOKING_URL` unset, then set. | Unset: no card. Set: "Book a strategy call" opens a dialog whose button opens the URL in a new tab (no iframe). Expert-attributed kits show "Book with <name>". |
| 6.5 | Tools in portal | /dashboard/tools/treatment-margin-calculator. | Tool HTML loads under X-Frame-Options SAMEORIGIN; defaults "$240 · 37.5%"; consult tool "$2,600/mo". |
| 6.6 | Account | /dashboard/account. | Role dropdown = canon member roles; billing labels $49/$490 or $199/$1,990; members@ contact. |
| 6.7 | Beacon | Open assistant. | "Your ASN guide"; hotline link; escalation confirms "2 to 3 business days"; no dental words. |
| 6.8 | Network page | /dashboard/network. | "Updates from the network" (experts and partners), never "community"; reactions/comments work. |
| 6.9 | Profile edit | Paste 100 chars in first name. | Capped at 80; empty → "First name is required." |
| 6.10 | Expert portal | /expert, /expert/profile (website `javascript:alert(1)`), /expert/resources upload evil.svg. | Footer experts@ and phone; URL rejected inline; SVG upload 415; pptx with correct MIME 200. |
| 6.11 | Partner portal | /vendor, offers/new, redemptions, account, agreement. | partners@; promo placeholder "ASN-YOURS-12"; headline placeholder "12% off the LUX laser handpiece"; plan label Growth $49; agreement page "Provider Agreement (Experts and Partners)" with five key terms. |
| 6.12 | Billing gate | Partner past waiver, no subscription. | Gate copy "Email partners@…"; billing routes still reachable. |
| 6.13 | Referral card | /vendor or /expert overview. | "$50 per referred member, paid after their first payment"; vanity link on www.aestheticsuccessnetwork.com. |
| 6.14 | Notifications bell | Insert expert and member notifications (1.11). | Rows show in the expert and member bells; mark read / mark all read work. |
| 6.15 | Seeker and public jobs | Flag on: /jobs, /jobs/<slug>, /seeker. | "ASN job board"; roles from the aesthetics list; counters hidden until the first live post; pay always shown. |
| 6.16 | Avatar upload | Upload .svg then .gif. | SVG rejected; GIF accepted (5 MB cap). |

## 7. Admin console

| # | Case | Steps | Expected |
|---|---|---|---|
| 7.1 | Non-admin blocked | Member session opens /admin and /api/admin/members. | Redirect to /admin/login; API 403. |
| 7.2 | Members page | Search, Export CSV. | Tier chips Founding/Standard only; CSV `asn-members-YYYY-MM-DD.csv` with the filtered rows; button disabled when empty. |
| 7.3 | Experts page | Open. | "Founding Expert Bench", "n of 20 lifetime-free founding slots left", ladder copy $0 → $49 → $199. |
| 7.4 | Founding invite dialog | New invite. | Pricing default "$49 → $199 ladder"; categories = canon list; placeholder "Acme Aesthetics Supply". |
| 7.5 | Waitlist / referrals / promo / lead magnets / hotline | Open each. | "Practice owners" labels; vanity `aestheticsuccessnetwork.com/<slug>`; promo placeholder ASNTEAM; lead magnets show raw slug; hotline page says Beacon, ASN pack, support@. |
| 7.6 | Summit page | Flag off, then on. | "No event configured" alert; with `SUMMIT_ENABLED=true` header shows the placeholder event. |
| 7.7 | Resources/new | Open. | Six canon categories (+ Book Club for that kit type). |
| 7.8 | Error hygiene | Force a DB error on GET /api/admin/admins. | 500 with "Something went wrong…" only; details in server log. |
| 7.9 | Audit log | After 7.2 to 7.4. | Actions recorded with the acting admin. |

## 8. Security headers, cookies, cron

| # | Case | Steps | Expected |
|---|---|---|---|
| 8.1 | Headers | `curl -I http://localhost:3000/`. | HSTS preload, X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, CSP with js.stripe.com and the Supabase host, without ycb.me / spline.design / maps.googleapis.com. |
| 8.2 | Tool iframe | GET /api/member/tools/<id> as a member. | X-Frame-Options SAMEORIGIN, frame-ancestors 'self'. |
| 8.3 | Gates | /dashboard with only `asn_checkout` cookie; /upgrade with it. | /dashboard → /member/login; /upgrade 200. |
| 8.4 | Dev vendor preview | `vendor_session=test-preview` cookie in development. | /vendor renders; in production build it redirects. |
| 8.5 | Cron auth | `NODE_ENV=production` build: GET /api/cron/onboarding without and with `Authorization: Bearer $CRON_SECRET`. | 401 (503 if secret unset) then 200 JSON. /api/cron/jobs 404 unless the job-board flag is on. |
| 8.6 | Summit APIs | Flag off: /api/events/summit/status?session_id=x; /api/admin/summit. | 404; `{enabled:false, event:null}`. |
| 8.7 | Sweep | `grep -rniE "dental|dentist|dmn|thriving|633-4707" src public tools-html` | Only provenance comments (none user-facing). |

## 9. Provider pricing and emails (owner decision 2026-10-01)

Run `0071_provider_free_period.sql` first. Set `MEMBER_LAUNCH_DATE=2027-01-15` (any future date) in `.env.local` for these tests; with it unset the free period is a provisional 12 months from today and the previews say so.

| # | Case | Steps | Expected |
|---|---|---|---|
| 9.1 | Email drafts | /admin/email-previews, send to `rushdhaakbar82@gmail.com, lester@ekwa.com`. | 13 results, no member emails. Experts: application received, approved, agreement (PDF), welcome to the bench (signed PDF), 7-day reminder. Companies: verified, agreement (PDF), welcome (signed PDF), 7-day reminder. Sign-in code, two team alerts. Every email: same fonts (Fraunces heading, serif body), ASN monogram + name header, footer "Aesthetic Success Network, operated by Ekwa Marketing Inc. · Powered by Business of Aesthetics". Only `rushdhaakbar82@gmail.com` appears inside the bodies as the sign-in email; lester@ receives copies. |
| 9.2 | Terms wording | Read every email and both PDFs from 9.1. | "Your first 6 months are free, starting the day we open to members. After that it's $39 a month, and it stays $39 with no increase." Never "trial", never "12 months", never "$149" for a standard company, never "70%". Free-through date = MEMBER_LAUNCH_DATE + 6 months. |
| 9.3 | PDF pages | Open the three attached PDFs (expert agreement, signed expert, signed company). | Every page has top and bottom margins; no heading stranded at a page bottom; no half-empty page; fee box reads $0 "Free until <date>" then $39 "After that · no increase"; no 70/30 line; Section 8 has the "cancel before your first charge" sentence. |
| 9.4 | Website expert flow | Apply at /experts → admin /admin/experts → start review → approve (graduation-cap icon). | Applicant gets "application received", then "You're approved" and "agreement is ready to sign" (PDF attached, private link). /admin/founding shows the invite with source "Website expert application"; team alert lists every field and the source. No expert row or login until acceptance. |
| 9.5 | Website company flow | Apply at /companies → admin /admin/vendors → approve → pick "$39 (standard)" or "$149 (large company)". | "You're verified" email (no portal button), then the agreement email. Vendor row `billing_plan` = chosen rate. Bulk approve uses $39. |
| 9.6 | Acceptance | Open /founding/<code> from 9.4 or 9.5, accept with card 4242. | Page shows "Due today $0.00", terms "First 6 months, from member launch $0/mo, After that $39/mo (or $149)". Stripe subscription `trialing`, trial_end = MEMBER_LAUNCH_DATE + 6 months, no schedule, nothing charged. ONE welcome email with the signed PDF (expert: "Welcome to the bench" with Book onboarding call when `ONBOARDING_CALL_URL` is set; company: "You're in"). Team alert "Card on file, nothing charged" with all invite details. Portal sign-in works with the 6-digit code. |
| 9.7 | Founding invite (admin) | /admin/founding → new invite, role partner, rate large → send → accept. | Dialog options "Standard … $39" / "Large company … $149"; chip "6 mo free, then $149"; agreement, acceptance page, welcome email and Stripe all show $149 after the free months. |
| 9.8 | Portals | Sign in as the accepted company and expert. | Company account page: "Free until <date>, then $39 a month with no increase", no progress bar, cancellation text with the before-first-charge rule. Expert billing: "Your terms" card, "Free founding months" status chip, no "Course revenue split" box. |
| 9.9 | 7-day reminder | In Stripe test clock or by editing `current_period_end` on the row to 5 days ahead, GET /api/cron/provider-reminders (locally no secret needed). | One email "Your free founding months end in 5 days" with Update payment method and Cancel my membership buttons, grace period "7 days"; row `free_period_reminder_sent_at` stamped; second run sends nothing. |
| 9.10 | Reminder safety net | Fire `customer.subscription.trial_will_end` with the Stripe CLI for a row never reminded, then again. | First event sends the reminder and stamps the row; second sends nothing. |
| 9.11 | Launch date sync | Set `MEMBER_LAUNCH_DATE`, run `node scripts/stripe-sync-free-period.mjs` then `--apply`. | Dry run lists every trialing provider subscription; apply moves trial_end to launch + 6 months; webhook mirrors the new `current_period_end` to the rows. |
| 9.12 | Public pages | /experts, /companies, /pricing, home cards. | Provider pricing reads "first 6 months free from the member launch, then $39 a month, no increase"; no $149, no month 13, no 70%. |

## Owner decisions surfaced by the port (not test failures)

- D1. ASN's private founding agreement text does not exist yet; the founding PDFs carry the ASN Provider Agreement terms until legal supplies it.
- D2. The exit-intent dialog promises "1 month free" via promo `DIRECT`; either create that 30-day code in /admin/promo-codes or disable the dialog in `Header.tsx`.
- D3. Governing law: "Province of Ontario, Canada" in PDFs; "to be confirmed at legal review" on the draft legal pages.
- D4. The home hero keeps DMN's pay-first flow (Start your membership → /join/member) rather than the old ASN waitlist-first flow.
- D5. Provider free periods end 6 months after `MEMBER_LAUNCH_DATE`; until it is set they are provisional (12 months) and `scripts/stripe-sync-free-period.mjs` moves them.
- D6. "Beacon" kept as the assistant name; `member_inquiries.source` default stays `pearl`.
- D7. /experts co-marketing card keeps the approved experts.html wording that mentions podcast and webinar features of the Business of Aesthetics network.
- D8. Lester De Alwis remains the signer of onboarding and abandoned-registration emails (sender founding@).
- D9. Early-tier Stripe env vars must point at the Standard prices (tier can never open).
- D10. Admin headshot/logo uploads keep DMN's image/* check (8 MB); tighten if wanted.
