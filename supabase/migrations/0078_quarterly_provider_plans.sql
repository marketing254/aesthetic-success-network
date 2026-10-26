-- =====================================================================
-- ASN: quarterly founding plans for experts and partners (owner request, 26 Oct 2026)
-- Run AFTER 0077_founding_invite_free.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Same as DMN's quarterly option, with ASN prices. Per founding invite the
-- admin now picks one of:
--   ladder        $39 a month (normal): companies $39 x 12 then $149;
--                 experts 12 months free then $39.                 (existing)
--   flat          $39 a month, no increase (companies).            (existing)
--   quarterly_49  6 months free from the member launch, then $49 every
--                 3 months, no increase. ONE fee covers every role on the
--                 invite (expert access + company listing).        (new)
--   quarterly_39  same, $39 every 3 months.                        (new)
--   free          free founding expert, nothing to pay.            (0077)
--
-- The website, the experts page, the pricing page and the normal Provider
-- Agreement are unchanged: quarterly exists only on founding invites.
--
-- (a) founding_invites.pricing_plan: add the two quarterly values.
-- (b) vendors.billing_plan: add the two quarterly values (the company
--     portal prints its terms from this column).
-- (c) experts.billing_plan (new, nullable): the plan an expert accepted,
--     so the expert billing page can show "$39 every 3 months" or the
--     free label. Null = the normal $39 a month.
-- Idempotent: safe to re-run.
-- =====================================================================

-- (a) founding invites ------------------------------------------------
alter table public.founding_invites
  drop constraint if exists founding_invites_pricing_plan_check;

alter table public.founding_invites
  add constraint founding_invites_pricing_plan_check
  check (pricing_plan in ('ladder', 'flat', 'quarterly_49', 'quarterly_39', 'free'));

comment on column public.founding_invites.pricing_plan is
  'ladder = $39 a month (companies: x12 then $149; experts: 12 months free then $39); flat = $39 a month, no increase (companies); quarterly_49 / quarterly_39 = 6 months free then $49 / $39 every 3 months, one fee for every role; free = free founding expert (expert-only invites).';

-- (b) vendors -----------------------------------------------------------
alter table public.vendors
  drop constraint if exists vendors_billing_plan_check;

alter table public.vendors
  add constraint vendors_billing_plan_check
  check (billing_plan in ('ladder', 'flat', 'quarterly_49', 'quarterly_39'));

comment on column public.vendors.billing_plan is
  'Company plan after the 6 free months: ladder = $39 a month for 12 months then $149 (default); flat = $39 a month, no increase; quarterly_49 / quarterly_39 = $49 / $39 every 3 months, one fee shared with the expert access on the same account.';

-- (c) experts -----------------------------------------------------------
alter table public.experts
  add column if not exists billing_plan text;

alter table public.experts
  drop constraint if exists experts_billing_plan_check;

alter table public.experts
  add constraint experts_billing_plan_check
  check (billing_plan is null or billing_plan in ('ladder', 'flat', 'quarterly_49', 'quarterly_39', 'free'));

comment on column public.experts.billing_plan is
  'Plan the expert accepted: null/ladder = $39 a month after the free months; quarterly_49 / quarterly_39 = one quarterly fee shared with the company listing; free = billing-exempt founding expert.';

notify pgrst, 'reload schema';
