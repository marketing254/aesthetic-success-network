-- =====================================================================
-- ASN — Expert applications schema
-- Run this AFTER 0016_early_tier_and_sms_consent.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Why a dedicated table (instead of dropping experts into
-- waitlist_signups): expert applications are reviewed by a different
-- team, follow a different funnel (apply → review → invite to record →
-- onboard), and have their own consent text. Mixing them with member
-- waitlist made admin triage messy.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =====================================================================
-- ENUM: review status for expert applications
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expert_application_status') then
    create type expert_application_status as enum (
      'new',
      'reviewing',
      'invited',
      'declined',
      'onboarded'
    );
  end if;
end$$;

-- =====================================================================
-- expert_applications
-- =====================================================================
create table if not exists public.expert_applications (
  id                       uuid primary key default gen_random_uuid(),
  email                    citext not null,
  full_name                text not null check (char_length(full_name) between 2 and 120),
  phone                    text check (char_length(phone) <= 32),
  company_name             text check (char_length(company_name) <= 160),
  specialty                text not null check (char_length(specialty) between 2 and 240),
  topics                   text check (char_length(topics) <= 2000),
  website                  text check (char_length(website) <= 240),
  booking_link             text check (char_length(booking_link) <= 240),
  source                   text default 'landing' check (char_length(source) <= 60),
  utm                      jsonb,
  status                   expert_application_status not null default 'new',
  ip_hash                  text,
  user_agent               text,
  -- Consent audit trail — every applicant ticks the "consider me as a
  -- Founding Expert" box. SMS consent is optional and only captured
  -- when ticked (TCPA / CASL evidence).
  agreement_accepted       boolean not null default false,
  agreement_accepted_at    timestamptz,
  sms_consent              boolean not null default false,
  sms_consent_text         text,
  sms_consent_at           timestamptz,
  created_at               timestamptz not null default now(),
  contacted_at             timestamptz,
  notes                    text
);

-- One application per email. If they reapply, we update the existing
-- row (handled in the API via 23505 → "duplicate" response).
create unique index if not exists expert_applications_email_uniq
  on public.expert_applications (lower(email::text));

create index if not exists expert_applications_created_idx
  on public.expert_applications (created_at desc);

create index if not exists expert_applications_status_idx
  on public.expert_applications (status);

-- =====================================================================
-- Row Level Security
-- Service role bypasses RLS (used by /api/expert/signup + admin).
-- No anon access — applications can contain personal contact details.
-- =====================================================================
alter table public.expert_applications enable row level security;

drop policy if exists "no_anon_select" on public.expert_applications;
drop policy if exists "no_anon_insert" on public.expert_applications;
drop policy if exists "no_anon_update" on public.expert_applications;

-- =====================================================================
-- Admin convenience view — recent applications for the admin console.
-- Read with the service role only (RLS on base table blocks anon).
-- =====================================================================
create or replace view public.expert_applications_recent as
select
  id, email, full_name, phone, company_name, specialty, topics,
  website, booking_link, source, status, created_at, contacted_at
from public.expert_applications
order by created_at desc
limit 500;

-- =====================================================================
-- Public counter view — safe for anon SELECT (no PII)
-- Powers any "X experts applying" admin stat or marketing surface.
-- =====================================================================
create or replace view public.expert_application_counts as
select
  count(*)                                                       as total,
  count(*) filter (where status = 'new')                         as new_count,
  count(*) filter (where status = 'reviewing')                   as reviewing_count,
  count(*) filter (where status = 'invited')                     as invited_count,
  count(*) filter (where status = 'onboarded')                   as onboarded_count,
  count(*) filter (where created_at > now() - interval '24 hours') as last_24h
from public.expert_applications;

-- Counts are aggregate only (no PII), safe to expose to anon if you
-- want a marketing-side ticker. Default: admin/service-role only.
-- Uncomment the next line if you want anon to read counts:
-- grant select on public.expert_application_counts to anon, authenticated;
