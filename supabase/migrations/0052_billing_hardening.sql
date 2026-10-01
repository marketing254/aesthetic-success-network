-- =====================================================================
-- ASN — Billing-gate hardening
-- Run after 0051_invite_links.sql.
--
-- Closes the loopholes found in the billing audit (2026-08-07):
--
--  1. vendors/experts are client-updatable (RLS row-scoped, but ALL
--     columns) — a signed-in partner/expert could set their own
--     subscription_status / stripe_subscription_id / billing_exempt /
--     verified / status from the browser console and defeat every gate.
--     → BEFORE triggers pin privileged columns unless the write comes
--       from the service role (API routes) or an admin SQL session.
--
--  2. current_vendor_can_publish() gated on status+verified only, so an
--     approved partner with NO card could publish offers/catalog straight
--     to the DB (the vendor portal writes client-side).
--     → add the billing condition (own subscription, or covered by a
--       billing parent).
-- =====================================================================

-- ---- 1a. Pin privileged vendor columns against client writes ---------
create or replace function public.protect_vendor_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (API routes) + admin SQL sessions pass through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Self-service inserts can never arrive pre-approved or pre-billed.
    new.status := 'pending_review';
    new.verified := false;
    new.billing_parent_id := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.months_in_program := 0;
    new.auth_user_id := coalesce(new.auth_user_id, null);
    return new;
  end if;

  -- UPDATE: privileged columns keep their old values.
  new.status := old.status;
  new.verified := old.verified;
  new.plan_id := old.plan_id;
  new.billing_parent_id := old.billing_parent_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  -- contact_email intentionally NOT pinned — the vendor profile page
  -- legitimately edits it client-side.
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

-- ---- 1b. Pin privileged expert columns against client writes ---------
create or replace function public.protect_expert_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- experts has no client insert grant today; if one ever appears,
    -- fail closed on the privileged fields.
    new.status := 'invited';
    new.billing_exempt := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.months_in_program := 0;
    return new;
  end if;

  new.status := old.status;
  new.billing_exempt := old.billing_exempt;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  new.email := old.email;
  new.agreement_signed_at := old.agreement_signed_at;
  new.agreement_version := old.agreement_version;
  new.agreement_ip_hash := old.agreement_ip_hash;
  new.agreement_user_agent := old.agreement_user_agent;
  return new;
end;
$$;

drop trigger if exists experts_protect_privileged on public.experts;
create trigger experts_protect_privileged
  before insert or update on public.experts
  for each row execute function public.protect_expert_privileged_cols();

-- ---- 2. Publishing requires live billing -----------------------------
-- Covered companies (billing_parent_id) inherit the parent's payment;
-- everyone else needs their own subscription that isn't past_due /
-- canceled / unpaid. (Null status with a subscription id covers the
-- moment between trial start and the first webhook sync.)
create or replace function public.current_vendor_can_publish()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.vendors v
    where v.auth_user_id = auth.uid()
      and v.status = 'approved'
      and v.verified = true
      and (
        v.billing_parent_id is not null
        or (
          v.stripe_subscription_id is not null
          and (v.subscription_status is null
               or v.subscription_status in ('active', 'trialing'))
        )
      )
  );
$$;

revoke all on function public.current_vendor_can_publish from public;
grant execute on function public.current_vendor_can_publish to authenticated;

notify pgrst, 'reload schema';
