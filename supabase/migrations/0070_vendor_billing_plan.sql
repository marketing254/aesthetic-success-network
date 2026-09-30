-- =====================================================================
-- ASN: vendors.billing_plan (which price ramp a company is on)
-- Run AFTER 0069_asn_application_fields.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- The company portal shows the price ramp for the company's own plan.
-- Until now it always showed the website ladder, even for founding
-- companies. ASN-SWAP-CANON.md section 3, provider pricing cases:
--   'website'          case D: $39 a month for months 1 to 12 from the day
--                      the card is added, then $149 from month 13 (same
--                      ramp as founding_ladder, no free period). Default
--                      for /companies signups.
--   'founding_ladder'  case B, invite pricing_plan 'ladder': $39 a month
--                      for months 1 to 12, then $149 from month 13.
--   'founding_flat'    case B, invite pricing_plan 'flat_49': $39 a month,
--                      no increase.
-- Set by /api/founding/[code]/accept when the invite is accepted. Every
-- statement here is idempotent, so re-running the file is safe.
-- =====================================================================

alter table public.vendors
  add column if not exists billing_plan text not null default 'website'
  check (billing_plan in ('website', 'founding_ladder', 'founding_flat'));

comment on column public.vendors.billing_plan is
  'Price ramp shown in the company portal. website = $39 months 1 to 12 then $149 (no free period, same as founding_ladder); founding_ladder = $39 months 1 to 12 then $149; founding_flat = $39 a month, no increase. Set by the founding accept route; website signups keep the default.';

-- Pin billing_plan client-side. 0067 (c) re-created this trigger function
-- with an explicit column list, so it is re-created here with the new
-- column added. Same body as 0067 otherwise: service role passes through,
-- client inserts are forced to a safe state, client updates keep the old
-- values of every privileged column.
create or replace function public.protect_vendor_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role (API routes) + admin SQL sessions pass through.
  if not public.is_client_role() then
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
    new.billing_plan := 'website';
    new.auth_user_id := coalesce(new.auth_user_id, null);
    return new;
  end if;

  -- UPDATE: privileged columns keep their old values.
  new.status := old.status;
  new.verified := old.verified;
  new.plan_id := old.plan_id;
  new.billing_plan := old.billing_plan;
  new.billing_parent_id := old.billing_parent_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.months_in_program := old.months_in_program;
  new.auth_user_id := old.auth_user_id;
  -- contact_email intentionally NOT pinned: the vendor profile page
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

notify pgrst, 'reload schema';
