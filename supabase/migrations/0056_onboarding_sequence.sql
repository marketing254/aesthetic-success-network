-- =====================================================================
-- ASN — Onboarding sequence hardening
-- Run after 0055_member_onboarding.sql.
--
-- The onboarding emails are now FULLY AUTOMATED (Day 0 at payment via
-- the Stripe webhook; days 3/7/14 via the hourly cron). This unique
-- index is the double-send guard: the sender INSERTS the row before
-- transmitting, so a concurrent or repeated run hits the index and
-- backs off. One row per member per email kind, forever.
-- =====================================================================

create unique index if not exists member_onboarding_emails_member_kind_uq
  on public.member_onboarding_emails (member_id, kind);

comment on table public.member_onboarding_emails is
  'Automated member onboarding sequence (day0_welcome / kit_recommendation / day7_hotline / day14_feedback). One row per member per kind (unique index). Sent by the Stripe webhook (day 0) and /api/cron/onboarding (rest). Service-role only.';
