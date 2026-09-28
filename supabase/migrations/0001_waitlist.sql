-- =====================================================================
-- TD Member Network — Waitlist schema
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)
-- =====================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Enum: waitlist role
do $$
begin
  if not exists (select 1 from pg_type where typname = 'waitlist_role') then
    create type waitlist_role as enum ('member', 'vendor');
  end if;
end$$;

-- Enum: waitlist status (for admin triage)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'waitlist_status') then
    create type waitlist_status as enum ('new', 'contacted', 'converted', 'declined');
  end if;
end$$;

-- =====================================================================
-- waitlist_signups
-- =====================================================================
create table if not exists public.waitlist_signups (
  id              uuid primary key default gen_random_uuid(),
  role            waitlist_role not null,
  email           citext not null,
  full_name       text not null check (char_length(full_name) between 2 and 120),
  practice_name   text check (char_length(practice_name) <= 160),
  phone           text check (char_length(phone) <= 32),
  city_state      text check (char_length(city_state) <= 120),
  message         text check (char_length(message) <= 2000),
  source          text default 'landing' check (char_length(source) <= 60),
  utm             jsonb,
  status          waitlist_status not null default 'new',
  ip_hash         text,
  user_agent      text,
  created_at      timestamptz not null default now(),
  contacted_at    timestamptz,
  notes           text
);

-- One signup per email per role (member and vendor can share an email)
create unique index if not exists waitlist_signups_email_role_uniq
  on public.waitlist_signups (lower(email::text), role);

create index if not exists waitlist_signups_created_idx
  on public.waitlist_signups (created_at desc);

create index if not exists waitlist_signups_status_idx
  on public.waitlist_signups (status);

-- =====================================================================
-- Row Level Security
-- Service role bypasses RLS (used by the Next.js API route + admin).
-- Anon role only gets a tiny read-only count via a view below.
-- =====================================================================
alter table public.waitlist_signups enable row level security;

-- No anon read/write on the raw table. Inserts go through the API
-- (service role). Admin reads via service role too.
drop policy if exists "no_anon_select" on public.waitlist_signups;
drop policy if exists "no_anon_insert" on public.waitlist_signups;
drop policy if exists "no_anon_update" on public.waitlist_signups;

-- =====================================================================
-- Public counter view — safe for anon SELECT (no PII)
-- Powers the "X practice owners already on the list" social proof on the landing.
-- =====================================================================
create or replace view public.waitlist_counts as
select
  count(*)                                                as total,
  count(*) filter (where role = 'member')                 as members,
  count(*) filter (where role = 'vendor')                 as vendors,
  count(*) filter (where created_at > now() - interval '24 hours') as last_24h
from public.waitlist_signups;

grant select on public.waitlist_counts to anon, authenticated;

-- =====================================================================
-- Admin convenience view — recent signups for the admin console.
-- Read with the service role only (RLS on base table blocks anon).
-- =====================================================================
create or replace view public.waitlist_signups_recent as
select
  id, role, email, full_name, practice_name, phone, city_state,
  message, source, status, created_at
from public.waitlist_signups
order by created_at desc
limit 500;
