# Changelog

Everything since 2026-07-17, split by **status** (committed vs. uncommitted) and **layer** (database vs. code).

---

## ✅ Committed

### Database changes

All committed DB work is Supabase/Postgres migrations under `supabase/migrations/`. Every new table is created with `enable row level security` and **no permissive policy** (deny-all — all access goes through the service-role client behind an app-layer guard), except the three explicit self-read policies noted below.

- **`0001_waitlist.sql`** (edited) — pre-existing waitlist table tweaked.
- **`0005_waitlist_agreement.sql`** — adds `agreement_accepted`, `agreement_accepted_at` to `waitlist_signups`.
- **`0006_members_and_audit.sql`** — new `members` table (waitlist → activated member) and `review_actions` (admin audit trail: who changed what, when).
- **`0007_portal_gate_policies.sql`** — adds the only permissive RLS policies in this whole set: `members_read_own`, `expert_applications_read_own`, `partner_applications_read_own` — each lets a signed-in user read (only) their own row, matched by JWT email. Backs the `/dashboard`, `/expert`, `/vendor` middleware gate.
- **`0008_portals.sql`** — new `hotline_requests`, `hotline_responses`, `vendor_deals`, `expert_kits`. Backs the Expert Hotline (member asks → admin routes to an expert → written action plan), vendor deals, and weekly expert kits.
- **`0009_stripe_billing_members.sql`** — Stripe subscription columns on `members` (`stripe_customer_id`, `subscription_status`, `founding_member_locked`, `early_member_locked`, etc.) + shared `stripe_events` idempotency/audit table (used by members, experts, and partners). Adds a `guard_member_lock_flags()` trigger that makes `founding_member_locked`/`early_member_locked` one-way — cancelling never frees a founding/early seat.
- **`0010_stripe_billing_experts_partners.sql`** — same Stripe/agreement columns on `expert_applications` and `partner_applications`, plus `program_started_at` (6-month free waiver clock) and `founding_expert_locked`/`founding_partner_locked`. Adds two more one-way lock-guard triggers, and `guard_expert_founding_cap()` — hard-enforces a **20-seat lifetime cap** on founding-expert pricing (partners uncapped).
- **`0011_agreements_storage.sql`** — creates the private `agreements` Supabase Storage bucket for signed agreement PDFs. No client-side access path, so no storage RLS policy needed.
- **`0012_blog_and_reviews.sql`** — new `blog_posts`, `member_reviews`. Seeded with 4 placeholder posts + 4 placeholder reviews (clearly marked scaffolding).
- **`0013_public_profile_fields.sql`** — adds `display_name`, `headshot_url`, `website` to `expert_applications` and `display_name`, `logo_url` to `partner_applications`, plus partial indexes on `status = 'approved'` for the public directory.
- **`0014_founding_member_invites.sql`** — new `founding_member_invites` (hand-picked prospects skip the waitlist; `members` row is created on `/welcome` after Stripe payment is verified).
- **`0015_invite_links.sql`** — new `invite_links` (personalized expert/partner invite links that pre-fill the normal application form).
- **`0016_promo_codes.sql`** — new `promo_codes` (record-keeping only; not yet wired into Stripe checkout).
- **`0017_referrals.sql`** — new `referral_codes`, `referral_signups` (no Stripe webhook wiring yet — conversion is marked by hand).
- **`0018_member_feedback.sql`** — new `member_feedback`.
- **`0019_lead_magnet_leads.sql`** — new `lead_magnet_leads` (no public capture form wired up yet).
- **`0020_profile_spotlights.sql`** — new `profile_spotlights` (admin drafting only; no public rendering surface yet).
- **`0021_resource_inquiries.sql`** — new `resource_inquiries` (member Q&A per expert kit; submission UI shipped later in `0023`).
- **`0022_announcements.sql`** — new `announcements` (broadcast tool; "send" only flips a status flag, no real email/Slack dispatch).
- **`0023_kit_progress_feedback.sql`** — new `member_kit_progress`, `kit_feedback`.
- **`0024_network_feed.sql`** — new `network_posts`, `network_post_reactions`, `network_post_comments`. Adds `network_post_reaction_count_sync()` / `network_post_comment_count_sync()` triggers that keep denormalised `reaction_count`/`comment_count` in sync on insert/delete.
- **`0025_saved_items.sql`** — new `saved_items` (polymorphic bookmark table for experts/partners).
- **`0026_system_sops.sql`** — new `system_sops`, seeded with 3 original SOP documents (no-show recovery, consult handoff, staff huddle template).
- **`0027_member_assistant.sql`** — new `member_assistant_messages` (chat log stub — no LLM wired up yet, route returns a canned reply).

### Code changes

- **Admin portal rebuild** — new Audit Log and Members pages, rebranded logo/favicon asset set, new admin login/OTP verify routes, audit-log writer (`src/lib/audit.ts`).
- **Portal security** — middleware + `src/lib/auth/guards.ts` gate `/dashboard`, `/expert`, `/vendor` on activated-member / approved-expert-or-partner status.
- **Member, expert, and partner portals** — full `/dashboard/*`, `/expert/*`, `/vendor/*` sections and layouts, shared `/login` flow, `PortalShell`/`portal/ui.tsx` component kit, admin Deals and Hotline queue pages.
- **Admin console perf** — consolidated Supabase queries (`src/lib/supabase/counts.ts`) to cut the overview page from ~15 round trips to ~4; added a route-level loading skeleton so admin tab switching feels instant.
- **Billing** — Stripe checkout/portal/webhook routes, per-audience billing pages (`/dashboard/billing`, `/expert/billing`, `/vendor/billing`), trial-start flow, signed-agreement PDF generation (`src/lib/pdf/agreementPdf.tsx`), portal access-gating tied to subscription state.
- **Marketing/content pages ported from TD** — `/pricing`, `/blog`, `/blog/[slug]`, `/reviews`, `/resources`, `/tools` (with conversion/margin calculators).
- **Public experts/partners directory** — `/experts/[id]`, `/partners/[id]` detail pages, directory API routes.
- **Founding member invite flow** — `/founding/[code]`, `/welcome`, agreement-accept-then-Stripe-checkout flow.
- **Personalized invite links** — `/invite/[code]`, pre-fills expert/partner application forms.
- **More TD ports** — `/upgrade`, `/start`, `/waitlist/thanks`.
- **Admin console gap-fill (Phase 2)** — Broadcast, Content (blog editor), Feedback, Founding invites, Inquiries, Invite links, Lead Magnets, Promo Codes, Referrals, Resources (kit editor), Spotlights admin pages + their API routes.
- **Member-portal sections (Phase 3)** — experts/partners directories, resource detail + kit engagement, Systems (SOPs), Tools, Inbox (AI assistant widget), Network feed (posts/reactions/comments), saved-items bookmarking.
- **Bug fix** — invisible hero text on `/welcome` and `/founding/[code]` (contrast issue).

---

## 🟡 Uncommitted (working tree)

### Database changes

None.

### Code changes

Mechanical refactor: extracted `formatDate`/`formatDateTime` out of the portal component kit into a standalone module.

- **Added** `src/lib/format.ts` — exports `formatDate(value)` and `formatDateTime(value)`, moved verbatim out of `src/components/portal/ui.tsx`.
- **`src/components/portal/ui.tsx`** — the `formatDate`/`formatDateTime` definitions removed; everything else (`PageHeader`, `SectionCard`, `StatusChip`, `RichText`, etc.) untouched.
- **24 consumer files** rewired to import the two helpers from `@/lib/format` instead of `@/components/portal/ui`:
  `DealsReview.tsx`, `HotlineQueue.tsx`, `dashboard/account/page.tsx`, `dashboard/deals/page.tsx`, `dashboard/experts/[id]/page.tsx`, `dashboard/hotline/[id]/page.tsx`, `dashboard/hotline/page.tsx`, `dashboard/inbox/page.tsx`, `dashboard/kits/page.tsx`, `dashboard/page.tsx`, `dashboard/partners/[id]/page.tsx`, `dashboard/resources/[id]/KitEngagement.tsx`, `dashboard/resources/[id]/page.tsx`, `dashboard/systems/[slug]/page.tsx`, `dashboard/systems/page.tsx`, `expert/kits/KitsManager.tsx`, `expert/page.tsx`, `expert/profile/page.tsx`, `expert/requests/[id]/page.tsx`, `expert/requests/page.tsx`, `vendor/deals/DealsManager.tsx`, `vendor/page.tsx`, `vendor/profile/page.tsx`, `dashboard/BillingSection.tsx`.

No formatting logic changed, no new behavior — pure move-and-rewire.
