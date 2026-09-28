-- =====================================================================
-- ASN — Expert portal schema
-- Run this AFTER 0017_expert_applications.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Promotes an approved expert_applications row into a first-class `experts`
-- row that owns the sign-in identity, portal access, and (later) resources,
-- analytics, and social posts. Mirrors how `vendors` relates to
-- `vendor_applications`: applications stay around forever as the audit
-- trail; the experts row is the live portal account.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =====================================================================
-- ENUM: expert account status
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expert_status') then
    create type expert_status as enum (
      'invited',     -- approval email sent; auth user created; first login pending
      'active',      -- has signed in at least once; portal usable
      'suspended',   -- temporarily disabled; can't sign in or publish
      'archived'     -- no longer on the bench; soft-delete state
    );
  end if;
end$$;

-- =====================================================================
-- experts
-- =====================================================================
create table if not exists public.experts (
  id                       uuid primary key default gen_random_uuid(),

  -- Link back to the original application (audit trail). Nullable so the
  -- team can manually create an expert outside the application flow.
  application_id           uuid references public.expert_applications(id) on delete set null,

  -- Supabase Auth identity. NULL until the expert clicks the first magic link.
  -- After bootstrap in /auth/callback this gets set permanently.
  auth_user_id             uuid references auth.users (id) on delete set null,

  -- Contact + identity
  email                    citext not null unique,
  full_name                text not null check (char_length(full_name) between 2 and 120),
  display_name             text check (char_length(display_name) <= 120),
  phone                    text check (char_length(phone) <= 32),
  company_name             text check (char_length(company_name) <= 160),

  -- Public-facing profile
  specialty                text not null check (char_length(specialty) between 2 and 240),
  bio                      text check (char_length(bio) <= 4000),
  topics                   text check (char_length(topics) <= 2000),
  website                  text check (char_length(website) <= 240),
  booking_link             text check (char_length(booking_link) <= 240),
  headshot_url             text check (char_length(headshot_url) <= 500),

  -- Lifecycle
  status                   expert_status not null default 'invited',
  invited_at               timestamptz not null default now(),
  activated_at             timestamptz,
  suspended_at             timestamptz,
  archived_at              timestamptz,

  -- Admin attribution
  invited_by               uuid references public.admin_users(id) on delete set null,
  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists experts_auth_user_uniq
  on public.experts (auth_user_id)
  where auth_user_id is not null;

create index if not exists experts_status_idx
  on public.experts (status);

create index if not exists experts_created_idx
  on public.experts (created_at desc);

-- Keep updated_at fresh on every UPDATE without forcing app code to touch it.
create or replace function public.experts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_experts_updated_at on public.experts;
create trigger trg_experts_updated_at
  before update on public.experts
  for each row execute function public.experts_set_updated_at();

-- =====================================================================
-- Row Level Security
-- Service role bypasses RLS (used by /api/admin/experts + bootstrap in
-- /auth/callback). Browser writes go through RLS policies below.
-- =====================================================================
alter table public.experts enable row level security;

drop policy if exists "experts_self_select" on public.experts;
drop policy if exists "experts_self_update" on public.experts;

-- An expert can read + update their own row once Supabase auth links them.
create policy "experts_self_select"
  on public.experts
  for select
  using (auth.uid() = auth_user_id);

-- Self-update is restricted at the app layer (we only let experts edit
-- profile-shaped fields, not status). The policy itself is permissive on
-- their own row; column-level guards live in /api/expert/* routes.
create policy "experts_self_update"
  on public.experts
  for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- =====================================================================
-- GRANTs
-- This project has "Automatically expose new tables" turned OFF (see
-- 0004_grants.sql), so new tables get no role grants by default.
-- Without these, the session-bound Supabase client (middleware, expert
-- portal pages) gets "permission denied for table experts" before RLS
-- ever runs. The grants below let the query reach the table; the
-- self_select / self_update policies above still restrict access to
-- the expert's own row.
-- =====================================================================
grant select, update on public.experts to authenticated;

-- Force PostgREST to reload its schema cache so the grants are visible
-- to the Data API immediately (otherwise it caches for up to a minute).
notify pgrst, 'reload schema';

-- =====================================================================
-- Admin convenience view — recent + lifecycle counts.
-- Read with the service role only.
-- =====================================================================
create or replace view public.experts_recent as
select
  id, email, full_name, display_name, specialty, status,
  invited_at, activated_at, application_id, created_at
from public.experts
order by created_at desc
limit 500;

create or replace view public.expert_counts as
select
  count(*)                                              as total,
  count(*) filter (where status = 'invited')            as invited,
  count(*) filter (where status = 'active')             as active,
  count(*) filter (where status = 'suspended')          as suspended,
  count(*) filter (where status = 'archived')           as archived
from public.experts;
