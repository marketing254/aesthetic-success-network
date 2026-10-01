-- =====================================================================
-- ASN — Vendor + Expert Stripe billing
-- Run after 0032_lead_magnets.sql.
--
-- Mirrors what 0015_stripe_billing.sql did for members onto the vendors
-- and experts tables. Both audiences now subscribe through the same
-- 3-phase ladder ($0 months 1-6, $49 months 7-12, $199 month 13+, with
-- a 2-month-free annual pre-pay option after month 6).
--
-- Stripe is the source of truth — these columns are the shadow we read
-- from to render the billing UI without round-tripping to the Stripe API
-- on every page render.
-- =====================================================================

-- ---------- vendors ----------
alter table public.vendors
  add column if not exists stripe_customer_id        text,
  add column if not exists stripe_subscription_id    text,
  add column if not exists stripe_price_id           text,
  add column if not exists subscription_status       text,
  add column if not exists subscription_interval     text,
  add column if not exists current_period_end        timestamptz,
  add column if not exists cancel_at_period_end      boolean default false,
  add column if not exists canceled_at               timestamptz,
  add column if not exists card_brand                text,
  add column if not exists card_last4                text,
  add column if not exists founding_partner_locked   boolean not null default false;

create unique index if not exists vendors_stripe_customer_uidx
  on public.vendors (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists vendors_subscription_status_idx
  on public.vendors (subscription_status);

-- ---------- experts ----------
alter table public.experts
  add column if not exists stripe_customer_id        text,
  add column if not exists stripe_subscription_id    text,
  add column if not exists stripe_price_id           text,
  add column if not exists subscription_status       text,
  add column if not exists subscription_interval     text,
  add column if not exists current_period_end        timestamptz,
  add column if not exists cancel_at_period_end      boolean default false,
  add column if not exists canceled_at               timestamptz,
  add column if not exists card_brand                text,
  add column if not exists card_last4                text,
  add column if not exists months_in_program         integer not null default 0,
  add column if not exists founding_expert_locked    boolean not null default false;

create unique index if not exists experts_stripe_customer_uidx
  on public.experts (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists experts_subscription_status_idx
  on public.experts (subscription_status);

-- ---------- guards ----------
-- Lock invariants: once a founding badge is set on a vendor or expert,
-- it can never be un-set (same pattern as members.founding_member_locked).
create or replace function public.guard_vendor_founding_lock()
returns trigger as $$
begin
  if OLD.founding_partner_locked = true and NEW.founding_partner_locked = false then
    raise exception 'founding_partner_locked cannot be un-set (vendor %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_vendor_founding_lock_guard on public.vendors;
create trigger trg_vendor_founding_lock_guard
  before update on public.vendors
  for each row
  execute function public.guard_vendor_founding_lock();

create or replace function public.guard_expert_founding_lock()
returns trigger as $$
begin
  if OLD.founding_expert_locked = true and NEW.founding_expert_locked = false then
    raise exception 'founding_expert_locked cannot be un-set (expert %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expert_founding_lock_guard on public.experts;
create trigger trg_expert_founding_lock_guard
  before update on public.experts
  for each row
  execute function public.guard_expert_founding_lock();

-- ---------- stripe_events extension ----------
-- 0015 created stripe_events as members-only; widen the schema so vendor
-- + expert webhook events can be journaled in the same table.
alter table public.stripe_events
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists expert_id uuid references public.experts(id) on delete set null,
  add column if not exists customer_kind text check (customer_kind in ('member','vendor','expert'));

create index if not exists stripe_events_vendor_idx
  on public.stripe_events (vendor_id, processed_at desc);

create index if not exists stripe_events_expert_idx
  on public.stripe_events (expert_id, processed_at desc);
