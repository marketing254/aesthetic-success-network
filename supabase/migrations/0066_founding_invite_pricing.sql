-- =====================================================================
-- ASN — Founding invite pricing plan
-- Run after 0065_event_registrations.sql.
--
-- Two provider (partner or expert) price plans can be chosen per founding invite.
-- ASN canon (ASN-SWAP-CANON.md section 3, owner decision 2026-09-30): the
-- company ramp is $39 a month for months 1 to 12, then $149 from month 13.
-- The plan keys 'ladder' and 'flat_49' are historical names kept because
-- the Stripe schedule logic keys off these strings:
--   'ladder'  = $39 a month for months 1 to 12, then $149 from month 13.
--               Agreement, acceptance page, Stripe schedule and
--               confirmation email all show $149.
--   'flat_49' = $39 a month for good, no increase. No $149 anywhere: not
--               in the agreement, not in the email, and the Stripe
--               schedule has no second phase.
--
-- Existing rows default to 'ladder' because that is what those people
-- signed. New invites are created with whatever the admin picks in the
-- console (the form defaults to flat_49).
-- =====================================================================

alter table public.founding_invites
  add column if not exists pricing_plan text not null default 'ladder'
  check (pricing_plan in ('ladder', 'flat_49'));

comment on column public.founding_invites.pricing_plan is
  'ladder = $39 months 1 to 12 then $149 from month 13; flat_49 = $39 a month, no increase. Expert invites always use ladder (12 months free, then $39).';
