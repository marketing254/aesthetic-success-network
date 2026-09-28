-- =====================================================================
-- 0031_referrals.sql
--
-- Referral system for experts + partners (vendors). Each expert / vendor
-- gets one referral code (auto-generated, short, human-readable). When
-- a visitor signs up with ?ref=CODE the code is stamped on the new
-- member row, and a `referral_signups` row records the attribution.
--
-- Admin analytics page (`/admin/referrals`) reads off these two tables.
-- =====================================================================

create table if not exists public.referral_codes (
  id           uuid primary key default gen_random_uuid(),
  -- Exactly one of these is set per row.
  expert_id    uuid references public.experts(id) on delete cascade,
  vendor_id    uuid references public.vendors(id) on delete cascade,
  code         text not null unique check (length(code) between 4 and 16),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint referral_one_owner check (
    (expert_id is not null and vendor_id is null)
    or
    (expert_id is null and vendor_id is not null)
  )
);

create index if not exists referral_codes_expert_idx on public.referral_codes (expert_id);
create index if not exists referral_codes_vendor_idx on public.referral_codes (vendor_id);

-- Stamp the code that brought a member in, and link to the actual
-- referral row for owner attribution.
alter table public.members
  add column if not exists referral_code_id uuid references public.referral_codes(id) on delete set null;

create table if not exists public.referral_signups (
  id           uuid primary key default gen_random_uuid(),
  code_id      uuid not null references public.referral_codes(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  -- Set by the Stripe webhook when the member's subscription transitions
  -- to active. NULL = signup happened but no paid conversion yet.
  converted_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (code_id, member_id)
);

create index if not exists referral_signups_code_idx
  on public.referral_signups (code_id, created_at desc);
create index if not exists referral_signups_member_idx
  on public.referral_signups (member_id);

-- RLS: service role only. The portal endpoints read via service-role keys.
alter table public.referral_codes   enable row level security;
alter table public.referral_signups enable row level security;

grant all on public.referral_codes   to service_role;
grant all on public.referral_signups to service_role;

notify pgrst, 'reload schema';
