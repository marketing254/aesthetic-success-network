-- =====================================================================
-- ASN — Founding experts are billing-exempt (lifetime free)
-- Run after 0041_founding_invite_companies.sql.
--
-- Policy: the founding cohort of experts (first 20 REAL experts, test /
-- internal accounts excluded) is entirely free for life. We never ask
-- them for a card and never create a Stripe subscription for them.
--
-- IMPORTANT — this is expert-side only. Companies (vendors) are still
-- charged on the normal 3-phase ladder. A person who is BOTH an expert
-- and a company keeps paying through their `vendors` row; only their
-- `experts` row is exempt.
--
-- Why an explicit flag instead of "first 20 by created_at": the cohort
-- has to skip test rows, and ordering shifts as rows are added/deleted.
-- A flag is auditable and can't silently re-rank.
-- =====================================================================

alter table public.experts
  add column if not exists billing_exempt            boolean not null default false,
  add column if not exists billing_exempt_reason     text,
  add column if not exists billing_exempt_granted_at timestamptz;

comment on column public.experts.billing_exempt is
  'Lifetime-free founding expert. When true the billing gate always allows access and the portal never asks for a card. Company (vendors) billing is unaffected.';

create index if not exists experts_billing_exempt_idx
  on public.experts (billing_exempt)
  where billing_exempt = true;

-- Guard: like the founding locks, an exemption is a promise we made —
-- it must not be silently revoked by an app-level update. Flipping it
-- back to false requires deliberately dropping this trigger first.
create or replace function public.guard_expert_billing_exempt()
returns trigger as $$
begin
  if OLD.billing_exempt = true and NEW.billing_exempt = false then
    raise exception 'billing_exempt cannot be un-set (expert %) — it is a lifetime grant', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expert_billing_exempt_guard on public.experts;
create trigger trg_expert_billing_exempt_guard
  before update on public.experts
  for each row
  execute function public.guard_expert_billing_exempt();
