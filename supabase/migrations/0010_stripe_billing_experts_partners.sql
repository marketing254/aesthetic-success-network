-- ============================================================
-- ASN billing phase · 0010 — Stripe subscription shadow for experts
-- and partners, plus the founding-waiver program clock.
--
-- Experts and partners get a 6-month free waiver starting the moment
-- an admin approves them (`program_started_at`), then Growth ($49/mo,
-- months 7-12), then Standard ($199/mo, month 13+). Starting a trial
-- locks the discounted Growth rate for life via `founding_expert_locked`
-- / `founding_partner_locked` — one-way flags, same pattern as 0009.
--
-- The founding-expert discount is capped at 20 lifetime seats; the
-- 21st (and beyond) still gets the 6-month waiver but goes straight to
-- the open rate once it starts billing. Partners are not capped.
--
-- Agreement e-sign is captured as an audit trail (timestamp, hashed
-- IP, user agent, version) plus a path to a generated PDF stored in
-- the private `agreements` bucket created in 0011.
-- ============================================================

-- ---------- expert_applications ----------
alter table public.expert_applications
  add column if not exists stripe_customer_id           text,
  add column if not exists stripe_subscription_id       text,
  add column if not exists stripe_price_id              text,
  add column if not exists subscription_status          text,
  add column if not exists subscription_interval        text,
  add column if not exists current_period_end           timestamptz,
  add column if not exists cancel_at_period_end          boolean not null default false,
  add column if not exists canceled_at                  timestamptz,
  add column if not exists card_brand                   text,
  add column if not exists card_last4                   text,
  add column if not exists founding_expert_locked       boolean not null default false,
  add column if not exists program_started_at           timestamptz,
  add column if not exists billing_agreement_signed_at  timestamptz,
  add column if not exists billing_agreement_version    text,
  add column if not exists billing_agreement_ip_hash    text,
  add column if not exists billing_agreement_user_agent text,
  add column if not exists billing_agreement_pdf_path   text;

create unique index if not exists expert_applications_stripe_customer_uidx
  on public.expert_applications (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists expert_applications_subscription_status_idx
  on public.expert_applications (subscription_status);
create index if not exists expert_applications_founding_locked_idx
  on public.expert_applications (founding_expert_locked) where founding_expert_locked = true;

-- ---------- partner_applications ----------
alter table public.partner_applications
  add column if not exists stripe_customer_id           text,
  add column if not exists stripe_subscription_id       text,
  add column if not exists stripe_price_id              text,
  add column if not exists subscription_status          text,
  add column if not exists subscription_interval        text,
  add column if not exists current_period_end           timestamptz,
  add column if not exists cancel_at_period_end          boolean not null default false,
  add column if not exists canceled_at                  timestamptz,
  add column if not exists card_brand                   text,
  add column if not exists card_last4                   text,
  add column if not exists founding_partner_locked      boolean not null default false,
  add column if not exists program_started_at           timestamptz,
  add column if not exists billing_agreement_signed_at  timestamptz,
  add column if not exists billing_agreement_version    text,
  add column if not exists billing_agreement_ip_hash    text,
  add column if not exists billing_agreement_user_agent text,
  add column if not exists billing_agreement_pdf_path   text;

create unique index if not exists partner_applications_stripe_customer_uidx
  on public.partner_applications (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists partner_applications_subscription_status_idx
  on public.partner_applications (subscription_status);
create index if not exists partner_applications_founding_locked_idx
  on public.partner_applications (founding_partner_locked) where founding_partner_locked = true;

-- ── Lock invariants (no-unset) ───────────────────────────────────────
create or replace function public.guard_expert_founding_lock()
returns trigger as $$
begin
  if OLD.founding_expert_locked = true and NEW.founding_expert_locked = false then
    raise exception 'founding_expert_locked cannot be un-set (expert_application %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expert_founding_lock_guard on public.expert_applications;
create trigger trg_expert_founding_lock_guard
  before update on public.expert_applications
  for each row execute function public.guard_expert_founding_lock();

create or replace function public.guard_partner_founding_lock()
returns trigger as $$
begin
  if OLD.founding_partner_locked = true and NEW.founding_partner_locked = false then
    raise exception 'founding_partner_locked cannot be un-set (partner_application %)', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_partner_founding_lock_guard on public.partner_applications;
create trigger trg_partner_founding_lock_guard
  before update on public.partner_applications
  for each row execute function public.guard_partner_founding_lock();

-- ── Founding-expert lifetime cap (20 lockable seats) ─────────────────
create or replace function public.guard_expert_founding_cap()
returns trigger as $$
declare
  locked_count integer;
  cap constant integer := 20;
begin
  if NEW.founding_expert_locked = true
     and (TG_OP = 'INSERT' or coalesce(OLD.founding_expert_locked, false) = false) then
    select count(*) into locked_count
      from public.expert_applications
     where founding_expert_locked = true;
    if locked_count >= cap then
      raise exception
        'Founding-expert cap reached: % of % lifetime-locked slots are used. Expert "%" must go on the open rate instead.',
        locked_count, cap, coalesce(NEW.email, NEW.id::text);
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expert_founding_cap on public.expert_applications;
create trigger trg_expert_founding_cap
  before insert or update on public.expert_applications
  for each row execute function public.guard_expert_founding_cap();
