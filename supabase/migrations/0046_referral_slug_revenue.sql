-- =====================================================================
-- ASN — Referral vanity handles + admin revenue attribution
-- Run after 0045_resource_kind_spotlight_highlight.sql.
--
-- Extends the 0031 referral system with two things:
--
--   1. A name-based vanity handle per referral owner, so an expert/partner
--      can share  aestheticsuccessnetwork.com/drjane  instead of
--      aestheticsuccessnetwork.com/join?ref=DRJAX7K9. The handle resolves to
--      the same referral_codes.code under the hood.
--
--   2. Revenue attribution: how much each referred member has actually
--      paid ASN. Recorded per referral_signups row from the invoice.paid
--      webhook. ADMIN-ONLY — experts/partners still see counts only
--      (per-owner earnings wait for the course-selling phase).
-- =====================================================================

-- ---- 1. Vanity handle ------------------------------------------------
alter table public.referral_codes
  add column if not exists slug text;

-- Case-insensitive uniqueness: /DrParul and /drparul must not both exist.
create unique index if not exists referral_codes_slug_uidx
  on public.referral_codes (lower(slug))
  where slug is not null;

comment on column public.referral_codes.slug is
  'Vanity handle for the shareable link aestheticsuccessnetwork.com/<slug>. Resolves to this row''s code. Auto-generated from the owner name, admin-editable, unique (case-insensitive).';

-- ---- 2. Revenue attribution (admin-only) -----------------------------
alter table public.referral_signups
  add column if not exists revenue_cents   bigint not null default 0,
  add column if not exists currency        text,
  add column if not exists last_payment_at timestamptz;

comment on column public.referral_signups.revenue_cents is
  'Running total (minor units) this referred member has actually PAID ASN, summed from invoice.paid. 0 during the free trial. Admin-only.';

notify pgrst, 'reload schema';
