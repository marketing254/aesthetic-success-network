-- =====================================================================
-- ASN — Founding invite pricing plan
-- Run after 0065_event_registrations.sql.
--
-- Two provider (partner or expert) price plans can be chosen per founding invite.
-- ASN canon (ASN-SWAP-CANON.md §3): ramp is $0 months 1-6, $49 months
-- 7-12, $199 from month 13. The plan keys 'ladder' and 'flat_49' are
-- unchanged because the Stripe schedule logic keys off these strings:
--   'ladder'  — the original ramp: $0 months 1-6, $49 months 7-12,
--               $199 from month 13. Agreement, acceptance page, Stripe
--               schedule and confirmation email all mention $199.
--   'flat_49' — $0 months 1-6, then $49 a month for good. No $199
--               anywhere: not in the agreement, not in the email, and
--               the Stripe schedule has no third phase.
--
-- Existing rows default to 'ladder' because that is what those people
-- signed. New invites are created with whatever the admin picks in the
-- console (the form defaults to flat_49).
-- =====================================================================

alter table public.founding_invites
  add column if not exists pricing_plan text not null default 'ladder'
  check (pricing_plan in ('ladder', 'flat_49'));

comment on column public.founding_invites.pricing_plan is
  'ladder = $49 months 7-12 then $199 (original ramp); flat_49 = $49 from month 7 onward, no increase.';
