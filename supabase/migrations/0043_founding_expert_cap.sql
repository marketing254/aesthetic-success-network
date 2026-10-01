-- =====================================================================
-- ASN — Cap the lifetime-free founding-expert cohort at 20
-- Run after 0042_expert_billing_exempt.sql.
--
-- Policy: the FIRST 20 real experts are free for life. Expert 21 onward
-- goes on the normal paid ladder ($0 months 1-6 → $49 months 7-12 →
-- $199 month 13+), exactly like partners.
--
-- Enforced in the DATABASE rather than in app code because the flag can
-- be set from several places (the repair script, the admin console, a
-- future onboarding step). A trigger is the only spot that all of them
-- must pass through, so the 21st expert cannot be made free by accident.
--
-- Mirrors the spirit of FOUNDING_MEMBER_CAP (100) for members: the cap
-- counts LIFETIME grants — revoking is already blocked by 0042's guard,
-- so a freed seat can never be recycled.
-- =====================================================================

create or replace function public.guard_expert_billing_exempt_cap()
returns trigger as $$
declare
  exempt_count integer;
  cap constant integer := 20;
begin
  -- Only check when the exemption is being newly granted. Updates that
  -- leave billing_exempt untouched (profile edits, Stripe syncs, …) must
  -- stay cheap and must never trip this.
  if NEW.billing_exempt = true
     and (TG_OP = 'INSERT' or coalesce(OLD.billing_exempt, false) = false) then

    select count(*) into exempt_count
      from public.experts
     where billing_exempt = true;

    if exempt_count >= cap then
      raise exception
        'Founding-expert cap reached: % of % lifetime-free slots are used. Expert "%" must go on the paid ladder instead.',
        exempt_count, cap, coalesce(NEW.email, NEW.id::text);
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expert_billing_exempt_cap on public.experts;
create trigger trg_expert_billing_exempt_cap
  before insert or update on public.experts
  for each row
  execute function public.guard_expert_billing_exempt_cap();

-- Convenience view for the admin console / reporting: how many founding
-- slots are left before new experts start paying.
create or replace view public.founding_expert_slots as
  select
    20                                             as cap,
    count(*) filter (where billing_exempt)         as used,
    greatest(0, 20 - count(*) filter (where billing_exempt)) as remaining
  from public.experts;

comment on view public.founding_expert_slots is
  'Lifetime-free founding-expert slots: cap, used, remaining. Once remaining hits 0, every new expert is billed on the normal ladder.';
