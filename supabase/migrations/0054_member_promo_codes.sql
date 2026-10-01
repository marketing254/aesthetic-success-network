-- =====================================================================
-- ASN — Member promotional codes (3-month free trial)
-- Run after 0053_kit_access_counts.sql.
--
-- Every expert and partner gets a promo code. Naming:
--   expert only          → first name          (MARY)
--   partner only         → company word        (COOP)
--   expert + partner     → one combined code   (MARY-COOP), with BOTH
--                          expert_id and vendor_id set so it shows in
--                          both of their portals.
-- When the team ACTIVATES a code, a joining member who enters it at the
-- payment step still adds their card, but gets a 3-month (90-day)
-- Stripe trial before the first charge. Deactivating a code makes it
-- unusable at checkout immediately.
--
-- Codes are auto-ensured for existing + future experts/partners by the
-- admin "Promo codes" console (GET /api/admin/promo-codes sweeps and
-- creates any that are missing). Team-owned codes (no expert/vendor)
-- are created from the console. Nothing is seeded here.
-- =====================================================================

create table if not exists public.member_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,                              -- human label, e.g. "Jane Doe — Example Skincare Co."
  expert_id uuid references public.experts(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  active boolean not null default false,   -- the team flips this on to run a promo
  trial_days integer not null default 90,  -- 3 months
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- Owner combinations: expert only, partner only, BOTH (an expert who is
  -- also a partner shares one combined code), or neither (team codes).
);

create unique index if not exists member_promo_codes_code_ci on public.member_promo_codes (upper(code));
create index if not exists member_promo_codes_expert_idx on public.member_promo_codes (expert_id) where expert_id is not null;
create index if not exists member_promo_codes_vendor_idx on public.member_promo_codes (vendor_id) where vendor_id is not null;

create table if not exists public.member_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.member_promo_codes(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (promo_code_id, member_id)
);

comment on table public.member_promo_codes is
  'Member-signup promo codes owned by experts/partners/team. Active codes grant a trial (default 90 days) at Stripe checkout. Service-role only.';
comment on table public.member_promo_redemptions is
  'One row per member who completed checkout with a promo code. Written by the Stripe webhook. Service-role only.';

-- Service-role only — all reads/writes go through guarded API routes.
revoke all on public.member_promo_codes from anon, authenticated;
revoke all on public.member_promo_redemptions from anon, authenticated;
alter table public.member_promo_codes enable row level security;
alter table public.member_promo_redemptions enable row level security;

-- No seeded codes. ASN canon: promo codes default to trial_days 90 and
-- max_uses 10 (added in 0055); the team creates codes from the console.

notify pgrst, 'reload schema';
