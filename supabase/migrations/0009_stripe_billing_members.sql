-- ============================================================
-- ASN billing phase · 0009 — Stripe subscription shadow for members
--
-- Members pay from day one on a founding-waiver ladder: Founding
-- ($49/mo, first 100 lifetime seats) → Early ($99/mo, next 400) →
-- Standard ($199/mo, uncapped once both caps are full). Cancelling
-- never frees a seat — `founding_member_locked`/`early_member_locked`
-- are one-way flags, enforced below by trigger, not just app code.
--
-- `stripe_events` is shared across all three billable audiences
-- (members here, experts/partners in 0010) so the webhook handler and
-- the admin/API layer have one place to check "have we already
-- processed this Stripe event id" regardless of who it's about.
-- ============================================================

alter table public.members
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id        text,
  add column if not exists subscription_status    text,
  add column if not exists subscription_interval  text,
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end   boolean not null default false,
  add column if not exists canceled_at            timestamptz,
  add column if not exists card_brand             text,
  add column if not exists card_last4             text,
  add column if not exists founding_member_locked boolean not null default false,
  add column if not exists early_member_locked    boolean not null default false;

-- members.tier already exists (text default 'founding') — the billing
-- code also writes 'early' | 'standard' into it once locked. No new
-- column needed.

create unique index if not exists members_stripe_customer_uidx
  on public.members (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists members_subscription_status_idx
  on public.members (subscription_status);
create index if not exists members_founding_locked_idx
  on public.members (founding_member_locked) where founding_member_locked = true;
create index if not exists members_early_locked_idx
  on public.members (early_member_locked) where early_member_locked = true;

-- ── Shared webhook idempotency + audit log ───────────────────────────
create table if not exists public.stripe_events (
  id                      uuid primary key default gen_random_uuid(),
  stripe_event_id         text not null,
  event_type              text not null,
  audience                text check (audience in ('member','expert','partner')),
  member_id               uuid references public.members(id) on delete set null,
  expert_application_id   uuid references public.expert_applications(id) on delete set null,
  partner_application_id  uuid references public.partner_applications(id) on delete set null,
  payload                 jsonb,
  processed_at            timestamptz not null default now()
);

create unique index if not exists stripe_events_event_uidx
  on public.stripe_events (stripe_event_id);
create index if not exists stripe_events_member_idx
  on public.stripe_events (member_id, processed_at desc);
create index if not exists stripe_events_expert_idx
  on public.stripe_events (expert_application_id, processed_at desc);
create index if not exists stripe_events_partner_idx
  on public.stripe_events (partner_application_id, processed_at desc);

alter table public.stripe_events enable row level security;

-- ── Lock invariant: a founding/early seat, once granted, is forever ──
create or replace function public.guard_member_lock_flags()
returns trigger as $$
begin
  if OLD.founding_member_locked = true and NEW.founding_member_locked = false then
    raise exception 'founding_member_locked cannot be un-set (member %)', OLD.id;
  end if;
  if OLD.early_member_locked = true and NEW.early_member_locked = false then
    raise exception 'early_member_locked cannot be un-set (member %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_member_lock_guard on public.members;
create trigger trg_member_lock_guard
  before update on public.members
  for each row execute function public.guard_member_lock_flags();
