-- =====================================================================
-- ASN — Stripe billing (Phase 9)
-- Run after 0014_member_assistant.sql.
--
-- Adds the columns we sync from Stripe so the member portal can:
--   • show "Active / Past due / Canceled" badges
--   • render "Card ending 4242"
--   • route the right button (Subscribe vs Manage subscription)
--   • enforce the founding-member rate-lock invariant
--
-- We never store full card numbers — Stripe keeps those. We only
-- mirror a shadow of the subscription state for fast UI rendering.
-- =====================================================================

alter table public.members
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
  add column if not exists founding_member_locked    boolean not null default false;

create unique index if not exists members_stripe_customer_uidx
  on public.members (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists members_subscription_status_idx
  on public.members (subscription_status);

-- =====================================================================
-- stripe_events — append-only log of every webhook we process.
-- Used for idempotency (skip already-processed event ids) and a manual
-- audit trail if anything ever looks weird in the dashboard.
-- =====================================================================
create table if not exists public.stripe_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type      text not null,
  member_id       uuid references public.members(id) on delete set null,
  payload         jsonb,
  processed_at    timestamptz not null default now()
);

create unique index if not exists stripe_events_event_uidx
  on public.stripe_events (stripe_event_id);

create index if not exists stripe_events_member_idx
  on public.stripe_events (member_id, processed_at desc);

-- =====================================================================
-- Founding-rate invariant — once a member is locked into the founding
-- tier, the tier flag never flips back. The webhook flips this on the
-- first time it sees a subscription with founding_member=true metadata.
-- =====================================================================
create or replace function public.guard_founding_lock()
returns trigger as $$
begin
  if OLD.founding_member_locked = true and NEW.founding_member_locked = false then
    raise exception 'founding_member_locked cannot be un-set (member %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_founding_lock_guard on public.members;
create trigger trg_founding_lock_guard
  before update on public.members
  for each row
  execute function public.guard_founding_lock();
