-- =====================================================================
-- ASN: company plan values become ladder | flat (owner decision 2026-10-02)
-- Run AFTER 0073.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Final provider pricing:
--   founding expert   12 months free (from member launch), then $39 flat
--   website expert    6 months free, then $39 flat
--   every company     6 months free, then
--       ladder: $39 a month for 12 months, then $149   (default)
--       flat:   $39 a month, no increase               (admin choice)
-- (a) founding_invites.pricing_plan: 'ladder' | 'flat'
-- (b) vendors.billing_plan:          'ladder' | 'flat'
-- Old values (standard, large, flat_49, website, founding_*) are mapped.
-- Idempotent.
-- =====================================================================

alter table public.founding_invites drop constraint if exists founding_invites_pricing_plan_check;
update public.founding_invites set pricing_plan = 'flat'   where pricing_plan in ('flat', 'flat_49');
update public.founding_invites set pricing_plan = 'ladder' where pricing_plan is null or pricing_plan not in ('ladder', 'flat');
alter table public.founding_invites alter column pricing_plan set default 'ladder';
alter table public.founding_invites add constraint founding_invites_pricing_plan_check check (pricing_plan in ('ladder', 'flat'));
comment on column public.founding_invites.pricing_plan is
  'Company plan after the 6 free months: ladder = $39 a month for 12 months then $149; flat = $39 a month, no increase. Experts are always $39 flat; ignored for expert-only invites.';

alter table public.vendors drop constraint if exists vendors_billing_plan_check;
update public.vendors set billing_plan = 'flat'   where billing_plan in ('flat', 'flat_49', 'founding_flat');
update public.vendors set billing_plan = 'ladder' where billing_plan is null or billing_plan not in ('ladder', 'flat');
alter table public.vendors alter column billing_plan set default 'ladder';
alter table public.vendors add constraint vendors_billing_plan_check check (billing_plan in ('ladder', 'flat'));
comment on column public.vendors.billing_plan is
  'Company plan after the 6 free months: ladder = $39 a month for 12 months then $149 (default); flat = $39 a month, no increase. Chosen by the admin at approval or on the founding invite.';

-- Trigger default follows the new value (same body as 0071 otherwise).
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
    new.billing_plan := 'ladder';
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
