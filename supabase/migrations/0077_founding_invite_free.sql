-- =====================================================================
-- ASN: "Free (no payment)" founding expert invites (owner request, 26 Oct 2026)
-- Run AFTER 0076_protocols_and_provider_assets.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- A hand-picked set of founding experts pay nothing, ever. The admin picks
-- "Free (no payment)" on the founding invite:
--   * the invite page shows no price and asks for no card,
--   * acceptance creates the expert with experts.billing_exempt = true
--     (the lifetime grant from 0042, guarded + capped at 20 by 0043),
--     no Stripe customer, no subscription,
--   * so the portal never asks for a card and the reminder cron, the
--     Stripe webhook and every billing email skip them.
--
-- founding_invites.pricing_plan gains the value 'free'. It is only valid
-- on expert-only invites (the API enforces that); companies always pay.
-- Idempotent: safe to re-run.
-- =====================================================================

alter table public.founding_invites
  drop constraint if exists founding_invites_pricing_plan_check;

alter table public.founding_invites
  add constraint founding_invites_pricing_plan_check
  check (pricing_plan in ('ladder', 'flat', 'free'));

comment on column public.founding_invites.pricing_plan is
  'ladder = $39 a month for 12 months then $149 (companies); flat = $39 a month, no increase (companies); free = free founding expert, nothing to pay, no card (expert-only invites). Paid expert invites store ladder (12 months free, then $39).';

notify pgrst, 'reload schema';
