-- =====================================================================
-- ASN — Founding invites can carry MULTIPLE companies (separate fields).
-- Run after 0040.
--
-- A partner/expert can name several companies on one agreement. We capture
-- them as a JSON list so the agreement PDF itemizes each one, and so that
-- acceptance can fan them out into one paying (principal) partner + covered
-- company listings. companies[0] is the principal (carries the card +
-- subscription); companies[1..] become covered listings.
--
-- Additive: single-company invites leave companies NULL and keep using the
-- existing company_name column exactly as before.
-- =====================================================================

alter table public.founding_invites
  add column if not exists companies jsonb;
