-- =====================================================================
-- ASN: provider free founding months + flat rate (owner decision 2026-10-01)
-- Run AFTER 0070_vendor_billing_plan.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Every provider (expert or company, founding invite or website signup)
-- now pays nothing until 6 months after the member launch, then a flat
-- monthly rate with no increase:
--   expert            $39
--   company standard  $39   (default)
--   company large     $149  (chosen by the admin at approval / invite)
-- The old ladders ($39 x 12 then $149, 12 months free, flat_49) are gone.
--
-- (a) founding_invites.pricing_plan:  'standard' | 'large'   (was ladder / flat_49)
-- (b) vendors.billing_plan:           'standard' | 'large'   (was website / founding_ladder / founding_flat)
-- (c) experts / vendors.free_period_reminder_sent_at: the single 7-day
--     reminder before the first charge is sent once and stamped here.
-- Every statement is idempotent, so re-running the file is safe.
-- =====================================================================

-- (a) founding invite rate --------------------------------------------
alter table public.founding_invites
  drop constraint if exists founding_invites_pricing_plan_check;

update public.founding_invites
   set pricing_plan = 'standard'
 where pricing_plan is null or pricing_plan not in ('standard', 'large');

alter table public.founding_invites
  alter column pricing_plan set default 'standard';

alter table public.founding_invites
  add constraint founding_invites_pricing_plan_check
  check (pricing_plan in ('standard', 'large'));

comment on column public.founding_invites.pricing_plan is
  'Company rate after the free founding months: standard = $39 a month, large = $149 a month, no increase. Experts are always $39; the value is ignored for expert-only invites.';

-- (b) vendor rate ------------------------------------------------------
alter table public.vendors
  drop constraint if exists vendors_billing_plan_check;

update public.vendors
   set billing_plan = 'standard'
 where billing_plan is null or billing_plan not in ('standard', 'large');

alter table public.vendors
  alter column billing_plan set default 'standard';

alter table public.vendors
  add constraint vendors_billing_plan_check
  check (billing_plan in ('standard', 'large'));

comment on column public.vendors.billing_plan is
  'Company rate after the free founding months: standard = $39 a month, large = $149 a month, no increase. Set by the admin at approval or by the founding invite.';

-- (c) one reminder before the first charge ----------------------------
alter table public.experts
  add column if not exists free_period_reminder_sent_at timestamptz;
alter table public.vendors
  add column if not exists free_period_reminder_sent_at timestamptz;

comment on column public.experts.free_period_reminder_sent_at is
  'When the single "your free founding months end in 7 days" email was sent. Null until then.';
comment on column public.vendors.free_period_reminder_sent_at is
  'When the single "your free founding months end in 7 days" email was sent. Null until then.';

-- Pin billing_plan client-side (same trigger body as 0070, new default).
create or replace function public.protect_vendor_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.verified := false;
    new.billing_parent_id := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.months_in_program := 0;
    new.billing_plan := 'standard';
    new.free_period_reminder_sent_at := null;
    new.auth_user_id := coalesce(new.auth_user_id, null);
    return new;
  end if;

  new.status := old.status;
  new.verified := old.verified;
  new.plan_id := old.plan_id;
  new.billing_plan := old.billing_plan;
  new.free_period_reminder_sent_at := old.free_period_reminder_sent_at;
  new.billing_parent_id := old.billing_parent_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  new.agreement_signed_at := old.agreement_signed_at;
  new.agreement_version := old.agreement_version;
  new.agreement_ip_hash := old.agreement_ip_hash;
  new.agreement_user_agent := old.agreement_user_agent;
  return new;
end;
$$;

drop trigger if exists vendors_protect_privileged on public.vendors;
create trigger vendors_protect_privileged
  before insert or update on public.vendors
  for each row execute function public.protect_vendor_privileged_cols();

notify pgrst, 'reload schema';
