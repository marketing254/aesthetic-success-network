# ASN swap canon (single source of truth for the DMN → ASN port)

Every agent and every edit must follow this file. When the DMN-Replication-Pack and this file disagree, this file wins (it encodes the ASN owner decisions from the handover, the Agreements folder, and the e-sign spec). When something is not covered here, keep DMN's value and list it under "Decisions for the owner" in your report.

## 1. Identity

| DMN value | ASN value |
|---|---|
| Dental Member Network | Aesthetic Success Network |
| DMN (short name, wordmark, subjects, cookie/CSS prefixes) | ASN (`asn_` cookies, `asn-` CSS ids, `x-application: asn-server`) |
| What is DMN / What is DMN? | What is ASN / What is ASN? |
| Thriving Dentist, Thriving Dentist Inc., Thriving Dentist Network, Dental Growth Network, "team behind Thriving Dentist" | Business of Aesthetics (credit line **"Powered by Business of Aesthetics"** everywhere DMN says "Powered by Thriving Dentist" / "Powered by Thriving Dentist Inc.") |
| Legal / operating entity line | "Aesthetic Success Network, operated by Ekwa Marketing Inc." |
| Footer copyright | "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics" |
| Governing law "Province of Ontario, Canada" | Keep the DMN wording but mark it "to be confirmed at legal review" only where the DRAFT banner already exists (legal pages). In PDFs keep Ontario, Canada (Ekwa Marketing Inc. is Canadian). |
| RIDA, Ekwa summit references | Remove RIDA. Ekwa Marketing stays (it is the operating entity). |
| Gary Takacs, Naren Arulrajah as hosts/presenters | Founding team = **Naren Arulrajah** (Founder & CEO, Ekwa Marketing; photo `/team/naren-arulrajah.jpg`) and **Lester De Alwis** (Co-Founder, Aesthetic Success Network; photo `/team/lester-de-alwis.png`). No other people, no bios beyond those titles. |
| Lester De Alwis signs onboarding/abandoned emails as "Co-Founder, Dental Member Network" | Keep Lester as signer: "Lester De Alwis / Co-Founder / Aesthetic Success Network / Powered by Business of Aesthetics" |
| Reviews / testimonials (Ekwa, Thriving Dentist, podcast, Facebook) | **None may be reused and none may be invented.** Reviews page renders an honest "verified member reviews will appear here once we have them" state. Home SocialProof section renders nothing when the list is empty (leave the array empty). |
| Blog posts, blog authors, expert names in copy (Debra, Callie, Ashley, DeVon, Laura Phillips, Parul Dua Makkar, James DeLuca, Monica Watson, Liz Lord, Ameena Basile, Kelly Fox-Galvagni, David Moffet, Christopher Phelps, Omer, Reshani) | Remove. Blog registry ships empty (and `/blog` must not crash when empty). Any card that needed a named person becomes an un-named card or is removed. |
| Summit speakers, DMN × RIDA summit | No ASN summit yet. Keep the summit code paths but constants become env/placeholder driven (`asn-summit-tbd`), the page is not linked or in the sitemap, and all RIDA words are gone. |
| `/reshani` team promo page and `LESTER`/`RESHANI` promo seeds | Remove the page and the seeds. Promo-code system stays. |
| Assistant name "Beacon" | Keep "Beacon" (owner may rename later). |
| "Expert Hotline" | Keep "Expert Hotline". |
| "Practice Playbooks" / "Playbook" / "kits" | Member-facing noun is **"kits"**, the section is **"Resource library"** (nav label "Resource library"). Never "Playbook". |
| "Vendor Network" / "Vendor Directory" / "vendors" (public copy) | "Partner Network" / "Partner directory" / "partners". Code identifiers (`vendor_*`, `/vendor/*`, `/api/vendor/*`, table names) stay unchanged. |
| Dental nouns: dentist(s), dental practice(s), practice owners (dental), dentistry, hygiene, operatory, chairs, PPO, CE credits from dental boards, crown fee, carrier call, DSO, Chairside | Aesthetics: "aesthetic practice(s)", "aesthetic practice owners", "practitioners", "med spa", "injectables", "treatment rooms", "providers". Keep "CE" only as "live AMAs and CE" (ASN canon lists it as a member benefit). |

## 2. Domains, emails, phone

One domain only: **aestheticsuccessnetwork.com**. Canonical site origin is **`https://www.aestheticsuccessnetwork.com`** in every default, JSON-LD, sitemap, robots, llms.txt and email link builder. There is no marketing domain (nothing replaces `joindmn.com` as a second domain).

| DMN address | ASN address |
|---|---|
| hello@joindmn.com | hello@aestheticsuccessnetwork.com (general contact, refund requests, `WAITLIST_SUPPORT_EMAIL` default) |
| partnerships@joindmn.com, partnerships@dentalmembernetwork.com, vendors@ | partners@aestheticsuccessnetwork.com |
| experts@dentalmembernetwork.com, experts@joindmn.com | experts@aestheticsuccessnetwork.com |
| members@joindmn.com, billing@ | members@aestheticsuccessnetwork.com |
| refunds@joindmn.com | hello@aestheticsuccessnetwork.com |
| support@dentalmembernetwork.com | support@aestheticsuccessnetwork.com (transactional Reply-To, agree-and-pay confirmation sender, admin code sender) |
| noreply@dentalmembernetwork.com (Supabase Auth sender, SMTP_TX user, login-page copy) | support@aestheticsuccessnetwork.com (ASN authenticates ONE Rackspace mailbox, support@, and sends-as the others on the same domain) |
| founding@dentalmembernetwork.com | founding@aestheticsuccessnetwork.com |
| lester@dentalmembernetwork.com, lester@ekwa.com (as sender) | founding@aestheticsuccessnetwork.com with display name "Lester De Alwis" |
| jobs@dentalmembernetwork.com | jobs@aestheticsuccessnetwork.com |
| Default `From` display name | "Aesthetic Success Network <…>" |
| (855) 633-4707 / +18556334707 / +1-855-633-4707 (Ekwa tracked) | **(855) 567-5323** / **+18555675323** (ASN's owner-confirmed tracked number) |

### Local-run email safety (mandatory, applies to EVERY outbound email module)
- All team/BCC/CC/audit/sandbox recipient lists move out of source into env with a single default: **`rushdhaakbar82@gmail.com`**. Names: `TEAM_DISTRIBUTION_LIST`, `EMAIL_AUDIT_BCC`, `EMAIL_QUEUE_ALERT_TO`, `EMAIL_SANDBOX_TO` (default `rushdhaakbar82@gmail.com`).
- A shared helper `src/lib/email/sandbox.ts` exports `applyEmailSandbox(msg)`: when `EMAIL_SANDBOX=true` (or `NODE_ENV !== "production"` and `EMAIL_SANDBOX` is not explicitly `false`) it rewrites `to` → `EMAIL_SANDBOX_TO`, drops `cc`/`bcc`, and prefixes the subject with `[TEST · would go to <original to>] `. Every transport (marketing dispatcher, teamNotify, foundingInvite, joinConfirmation, trialEndingReminder, inquiryPack, jobEmails, summitEmails, onboarding, abandoned) must call it right before `sendMail`/Resend. `JOB_EMAILS_SANDBOX` becomes an alias of `EMAIL_SANDBOX`.
- Slack: only posts when `SLACK_BOT_TOKEN`+`SLACK_INQUIRIES_CHANNEL_ID` or `SLACK_INQUIRIES_WEBHOOK_URL` are set AND `SLACK_ENABLED=true`. Otherwise no-op with a console.info line.
- Sales tracker, Kit (ConvertKit), Meta CAPI, summit sheet: already env-gated; keep them env-gated and add nothing that posts anywhere by default.
- Remove every hard-coded personal address (`lester@ekwa.com`, `chamika.p@ekwa.com`, `rushdha@ekwa.com`, `reshani@ekwa.com`, `kavithanaren1@gmail.com`, `narenbizymoms@gmail.com`, `irhamirfan435@gmail.com`, `drjenkins@smile-parlor.com`). `TEST_MEMBER_EMAILS` and `SUPPRESSED_EMAILS` become env lists, default empty.

## 3. Prices, tiers, commercial terms (ASN canon, do not deviate)

- **Member**: Founding **$29/month** or **$290/year** (first **100** members, locked while membership stays active). Standard **$99/month** / **$990/year** after the founding cap. **There is NO $99 "early" tier.** Remove the early tier from every picker, pricing page, reminder table, refund page, ads page and copy; set `EARLY_MEMBER_CAP = 0` so the tier can never open; keep the plan-key plumbing only so the webhook does not crash. Founding annual promo price ($441, promo-annual only) stays.
- Founding annual note: "Pay for 10 months, get 12, save $98/year" stays.
- **30-day money-back guarantee**, cancel anytime.
- **Provider pricing, four cases (owner decision 2026-09-30):**
  - **A. Founding expert** (admin founding invite, role expert): **12 months free** (365-day Stripe trial on `STRIPE_PRICE_EXPERT_GROWTH_MONTHLY`, `FOUNDING_EXPERT_TRIAL_DAYS = 365`), then **$39/month** for good. Card saved at acceptance, nothing charged that day. This REPLACES the old "free for life" default for invites; invites never set `billing_exempt`.
  - **B. Founding company** (admin founding invite, role partner): **$39/month from day 1 for months 1 to 12**, then **$149/month from month 13**. Stripe subscription schedule: phase 1 `STRIPE_PRICE_PARTNER_GROWTH_MONTHLY` x 12 iterations (no trial), phase 2 `STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY` ($149). Invite `pricing_plan` DB values stay `ladder` (default, this ramp) and `flat_49` ("$39 a month with no increase"); labels only changed.
  - **Role "both"**: case A for the expert side and case B for the company side, two subscriptions on one Stripe customer, mirrored onto the `experts` and `vendors` rows respectively.
  - **C. Website expert** (applies at `/experts`, sign-and-pay in the portal): **$0 months 1 to 6** (180-day trial on the expert growth price, `TRIAL_DAYS = 180`), then **$39/month**, and it **stays $39** (no month-13 step). No expert-facing surface may show $199 or $1,990. The expert standard price env keys remain defined but are never shown or offered.
  - **D. Website company** (applies at `/companies`, sign-and-pay in the portal): identical to case B. **$39/month from the day the card is added for months 1 to 12**, then **$149/month from month 13**. Same Stripe subscription schedule as case B (`createCompanyLadderSchedule` in `src/lib/stripe.ts`: phase 1 `STRIPE_PRICE_PARTNER_GROWTH_MONTHLY` x 12, phase 2 `STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY`), first $39 charged today. **There are no free months for companies and no company-facing surface may show $199 or $1,990.** `vendors.billing_plan` stays `website` for these rows (label "Company"); the ramp is the same as `founding_ladder`. The legacy `STRIPE_PRICE_PARTNER_STANDARD_*` env keys stay defined but are never offered or shown.
- **Expert paid courses**: expert keeps **70%**, network 30%.
- **Referral**: **$50 per referred member, paid after their first payment**. Never "stays 60 days".
- **Billing exemption (`experts.billing_exempt`)**: a **manual admin override only** (max **20**, `FOUNDING_EXPERT_CAP = 20`, DB-enforced, cannot be un-set). Founding invites no longer grant it. **INTERNAL ONLY**: never on a public page, public form, public email or public agreement.
- **Companies, every kind**: cases B and D above (no free period, no exemption, no $199). Founding invite pricing plans stay `ladder` (default) and `flat_49`.
- **Promo codes**: default `trial_days 90`, `max_uses 10`; no seeded codes.
- Hotline SLA: "leave a voicemail, get a written action plan by text and email within **2 to 3 business days**, AI-assisted". Never "live", never "24/7", never "2hr". Never claim podcasts, AMAs beyond "monthly live AMAs and CE" (ASN canon lists that benefit).
- Unsourced numbers are removed: `247+`, `10K+`, `500+`, "thousands of practice owners", `$6,400`, `$6,000+`, `$6K+`, `$2,400/yr … $10,500+/yr` value stack, "Coached 2,200+ practices", "42 resources", "24/7". The pricing value stack lists what a member gets with no dollar figures. "The only network where…" superlatives become "A network where…".
- Worked examples stay labelled "illustrative".
- **No member directory and no member-to-member community claims** on public pages (practice owners are competitors). The in-portal Network feed is expert/partner-authored; describe it as "updates from the network's experts and partners", never as a member community or member directory.

## 4. Option lists (approved ASN vocabulary)

- `memberRoles` (waitlist/member signup/account): `["Dermatologist", "Plastic surgeon", "Med spa owner", "Esthetician", "Injector", "Practice manager", "Other aesthetic practice"]`
- `locationOptions`: `["1", "2–3", "4–9", "10+"]`
- `challengeOptions`: `["Pricing & margins", "Consult conversion", "Hiring & retention", "Vendor costs", "Marketing & new patients", "Systems & operations", "Other"]`
- `heardAboutOptions`: `["Business of Aesthetics", "Ekwa Marketing", "An expert", "A partner company", "Google", "Instagram or social media", "A friend or colleague", "Other"]`
- Partner categories (`vendorCategories`, `CATALOG_CATEGORIES`, admin founding dialog, forms): `["Injectables & pharmaceuticals", "Devices & equipment (lasers, energy-based)", "Skincare & product lines", "Practice-management software", "Marketing & growth", "Patient financing", "Staffing & HR", "Coaching & consulting", "Continuing education", "Accounting & CFO", "Other"]`
- Expert topics/specialties (placeholders and chips): "Injectables pricing & margins", "Consult conversion", "Med spa operations", "Team & injector hiring", "Aesthetic marketing", "Patient retention & memberships", "Compliance & medical direction", "Finance & CFO".
- Resource categories (admin kit editor, importer default): `["Pricing & Margins", "Consult & Conversion", "Team & Culture", "Patient Experience", "Marketing & Growth", "Operations & Compliance"]`
- Job roles (`job_role` enum in `0061`, `JOB_ROLES`, `JobRoleValue`, `roleLabel()` fallback "Aesthetic role"): `injector_rn_np` "Nurse injector (RN/NP)", `physician_assistant` "Physician assistant", `aesthetician` "Aesthetician / esthetician", `laser_technician` "Laser technician", `medical_director` "Medical director", `practice_manager` "Practice / clinic manager", `patient_coordinator` "Patient coordinator", `front_desk` "Front desk", `marketing_coordinator` "Marketing coordinator", `other` "Other".
- Member account `PRACTICE_ROLES` and ads `ROLES` use `memberRoles`.
- Waitlist `role` enum in `0001` stays (`member`, `vendor`, `expert`); the admin waitlist "Dentists" label becomes "Practice owners".

## 5. Assets

| DMN asset | ASN asset (already in `public/`) |
|---|---|
| `/DGN-logo.png` (square lockup in `Logo.tsx`, emails, PDFs) | `/asn-nav-icon.png` (128px navy rounded tile monogram). **Do not apply the `brightness(0) invert(1)` filter** to it; the navy tile works on light and dark. For emails/PDF use `/asn-logo-full-white.png` (light backgrounds) or `/asn-logo-full-dark.png` (dark). |
| `src/app/icon.png`, `src/app/apple-icon.png`, `/faviconicon.png` | `src/app/icon.png` ← `public/asn-app-icon.png`; `src/app/apple-icon.png` ← `public/apple-touch-icon.png`; delete faviconicon references (use `/asn-app-icon.png`). |
| `/td-logo-horizontal-dark.svg` (missing OG/logo) | `/asn-logo-full-dark.png` for JSON-LD logo; OG image `/og-image.png` (1200×630, generated from the dark lockup). |
| `/td-logo.png`, `/lid-logo.png`, `/iu-logo.png`, `/rida-logo.png`, `/dms-logo.png`, `/vet.png`, `/hero-dental.svg`, `/dmn-wordmark.png` | Deleted. `poweredBy` list = `[{ name: "Business of Aesthetics", logo: "/boa-logo.png" }, { name: "Ekwa Marketing", logo: "/ekwa-logo.png" }]`. |
| `/team/gary-takacs.jpg` | Deleted. `/team/naren-arulrajah.jpg` and `/team/lester-de-alwis.png` exist. |
| `/agreements/dmn-member-agreement.pdf`, `dmn-expert-agreement.pdf`, `dmn-partner-agreement.pdf`, `dmn-expert-partner-agreement.pdf` | `/agreements/asn-member-agreement.pdf`; **one** `/agreements/asn-provider-agreement.pdf` serves expert, partner and expert+partner (ASN uses a single Provider Agreement); `/agreements/asn-refund-and-cancellation-policy.pdf`; `/agreements/asn-privacy-policy.pdf`. |
| `public/blog/*`, `public/ads/*.jpg`, `public/rida/*`, `public/free-kit/*`, `public/tools/previews/*` | Deleted. Any code path that needs them must degrade gracefully (no image, or the section hidden) — never a broken image. |
| `public/llms.txt`, `public/pricing.md`, `public/README.md`, `public/HERO_IMAGE_README.md` | Rewrite for ASN (llms.txt + pricing.md with ASN canon and no held-back URLs; README describes the ASN logo pack; delete HERO_IMAGE_README.md). |

Approved ASN legal and agreement copy to port from: `_asn-source-copy/member-agreement.html`, `provider-agreement.html`, `privacy.html`, `refund-policy.html` (DRAFT banner pending counsel stays). Approved ASN public copy reference: `_asn-source-copy/index.html`, `experts.html`, `partners.html`.

## 6. Navigation and phase-one holdbacks

- Public navbar (`navLinks`): **What is ASN, Tools, Experts, Partners, Reviews, Pricing, FAQ**. Removed: Resources, Jobs, Blog.
- Footer "Network" column: What is ASN?, Experts, Partners, Reviews, Pricing, FAQ, Tools. Agreements column: Member Agreement (`/agreement/member`), Provider Agreement (`/agreement/provider`). Legal: Refund & Cancellation Policy (`/legal/refund`), Privacy Policy (`/legal/privacy`).
- Sitemap and llms.txt: no `/resources`, `/blog`, `/blog/*`, `/jobs`, `/jobs/*`, `/summit`, `/reshani`.
- Home page order stays; `JustDropped` renders only when `NEXT_PUBLIC_SHOW_JUST_DROPPED === "true"` (default hidden). `TourVideo` stays (placeholder, click-to-play, never autoplay). `SocialProof` renders nothing with an empty list. `FreeKitMagnet` renders only when `NEXT_PUBLIC_LEAD_MAGNET_ENABLED === "true"`.
- `/start` ad page: "Playbooks" nav pill and the library strip render only when `NEXT_PUBLIC_SHOW_JUST_DROPPED === "true"`; expert cards with named people are replaced by un-named value cards.
- Member portal sidebar: "Resource library" and "Systems" entries render only when `NEXT_PUBLIC_LIBRARY_ENABLED === "true"` (default hidden); Jobs stays behind `NEXT_PUBLIC_JOB_BOARD_ENABLED` exactly as DMN.
- Admin sidebar: keep everything, Job board / Job seekers behind `NEXT_PUBLIC_JOB_BOARD_ENABLED` exactly as DMN.
- Agreement routes: `/agreement/member` (ASN member agreement), new `/agreement/provider` (ASN provider agreement); `/agreement/vendor` and `/agreement/expert` redirect to `/agreement/provider` so every existing link keeps working.

## 7. Security fixes to apply while porting (from the pack's "fix first" list)

1. `stripe_events` gets RLS enabled (no policies).
2. `members`: revoke `update` from `authenticated`; add a column-pinning trigger that is NOT `security definer`.
3. Recreate the 0052 pinning triggers for `vendors`/`experts` without `security definer` (test `session_user`/role via `current_setting('request.jwt.claim.role', true)`), plus an `early_member_locked` one-way guard.
4. `resources` select policies consolidated; anon limited to a column-level grant.
5. `avatars` bucket created in a migration (public).
6. Notifications table reconciled with the code (audience check includes `expert`, `member`; `expert_id`, `member_id` columns).
7. Promo/referral code lookups: strict regex `/^[A-Z0-9-]{4,16}$/i` before any `.ilike`, and `.eq` where possible.
8. `JsonLd.tsx` escapes `<` (`<`).
9. One shared `escapeHtml` used in every email interpolation (fix `foundingInvite.ts`, `trialEndingReminder.ts`, lead-magnet route, webhook team alert).
10. Rate limits on `/api/join/expert/apply` and `/api/join/partner/apply`; one `hashIp()` helper that throws in production without `IP_HASH_SALT`.
11. Every route error goes through `errorResponse.ts` (`serverError()`), no raw `error.message` to clients.
12. Stripe webhook: store the event only after successful handling (or mark `processed_at` null on failure) so Stripe's retry is not deduplicated away.
13. `robots.ts`: disallow `/expert/` and `/vendor/` (trailing slash) so `/experts` and `/partners` stay crawlable; AI-crawler rules also disallow `/admin`, `/api/`, `/dashboard`.
14. Every public page exports its own `canonical`; sitemap, JSON-LD and llms.txt all use the `www` origin.
15. `next` 16.3.6, `nodemailer` ^10 (already in package.json); remove dead code: `magicToken.ts`, `VENDOR_MAGIC_SECRET`, `client.ts`/`getSupabaseAnon`, `NEXT_PUBLIC_CLERK_*`, `ANTHROPIC_API_KEY`, `WAITLIST_MOCK_MODE`.
16. Admin seed lives in a gitignored local file (`supabase/seed.local.sql` template provided as `supabase/seed.local.example.sql`); `0005` seeds only placeholder-free ASN owner/admin rows: `lester@ekwa.com` (owner, "Lester"), `rushdha@ekwa.com` (admin, "Rushdha"), `rushdhaakbar82@gmail.com` (admin, "Rushdha (test)").

## 8. Env variable names (keep DMN names; ASN additions)

Keep every DMN name. Add: `EMAIL_SANDBOX`, `EMAIL_SANDBOX_TO`, `EMAIL_AUDIT_BCC`, `EMAIL_QUEUE_ALERT_TO`, `SLACK_ENABLED`, `TEST_MEMBER_EMAILS`, `SUPPRESSED_EMAILS`, `NEXT_PUBLIC_SHOW_JUST_DROPPED`, `NEXT_PUBLIC_LEAD_MAGNET_ENABLED`, `NEXT_PUBLIC_LIBRARY_ENABLED`, `SUMMIT_EVENT_ID`, `SUMMIT_ENABLED`. Remove: `NEXT_PUBLIC_CLERK_*`, `ANTHROPIC_API_KEY`, `VENDOR_MAGIC_SECRET`, `WAITLIST_MOCK_MODE`, `KIT_API_KEY` stays optional.

## 9. Style rules

- No em-dashes in any member-facing copy, email, PDF or agreement text (use commas, periods, colons). Code comments may keep them.
- Email-safe font stacks only in emails (Fraunces / Georgia serif for display, Inter / Arial sans for body).
- Colours: keep every DMN hex (DMN and ASN share navy `#0A1320`/`#0E2A3D`, gold `#D9A84B`, ivory `#F6F1E7`).
- Fonts: keep Manrope + Fraunces.
- File names lowercase-hyphenated.
