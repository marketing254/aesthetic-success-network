-- ============================================================
-- ASN launch phase · 0001 — founding waitlist
-- Run in the Supabase SQL editor, in numeric order.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.waitlist_signups (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  first_name    text not null,
  last_name     text not null,
  phone         text,
  practice_name text,
  practice_role text,          -- "You are a…" select (Dermatologist, Injector, …)
  locations     text,          -- "1", "2–3", "4–9", "10+"
  challenge     text,          -- free-text biggest practice challenge
  agreement_accepted    boolean not null default false,  -- Member Agreement tick
  agreement_accepted_at timestamptz,
  source        text default 'landing',
  utm           jsonb,
  ip_hash       text,          -- salted hash, never the raw IP
  user_agent    text,
  status        text not null default 'new'
                check (status in ('new','contacted','converted','declined')),
  contacted_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- one signup per email
create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

-- Aggregate counts for the admin dashboard / public counter.
create or replace view public.waitlist_counts as
select
  count(*)::int                                                        as total,
  count(*) filter (where created_at >= now() - interval '24 hours')::int as last_24h,
  count(*) filter (where created_at >= now() - interval '7 days')::int   as last_7d
from public.waitlist_signups;

-- RLS: deny-all. Only the service-role key (server API routes) touches
-- this table; the anon/browser key gets nothing.
alter table public.waitlist_signups enable row level security;
