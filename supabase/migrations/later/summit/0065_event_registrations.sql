-- =====================================================================
-- ASN — Event registrations (summits, webinars and future events)
-- Run AFTER 0059_pending_registrations.sql (0060–0064 are the job board and
-- are independent of this file — order between them does not matter).
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- One row per (event, email). The application database is the source
-- of truth for who registered; the ops sheet is a MIRROR written by the
-- n8n workflow and can be rebuilt from here.
--
-- Nothing here is readable by any client role. Every read and write goes
-- through service-role API routes:
--   - /api/events/summit/checkout      (pending_payment → row created)
--   - Stripe webhook                   (→ paid, Zoom requested)
--   - /api/events/summit/zoom-callback (→ zoom_registered / zoom_failed)
--   - /api/events/summit/register      (existing member → entitled)
--
-- The Zoom JOIN LINK is personal to the registrant and is stored here so
-- the confirmation email can be resent; it is never exposed to anon.
-- =====================================================================

create table if not exists public.event_registrations (
  id                    uuid primary key default gen_random_uuid(),
  event_id              text not null,                              -- e.g. asn-summit-2026-11-05 (SUMMIT_EVENT_ID env)
  member_id             uuid references public.members(id) on delete set null,

  -- Registrant, exactly as submitted (mirrors the Zoom registration form)
  email                 text not null,
  first_name            text not null,
  last_name             text not null,
  phone                 text,
  practice_website_name text,                                       -- Zoom custom question
  country               text,                                       -- ISO 3166-1 alpha-2
  speaker_question      text,                                       -- Zoom custom question (optional)
  event_member_interest text,                                       -- Zoom custom question (single choice): interest in ASN membership

  -- Attribution
  utm                   jsonb not null default '{}'::jsonb,
  landing_url           text,

  -- Entitlement + Zoom lifecycle
  --   pending_payment  form submitted, Stripe checkout opened, not paid
  --   entitled         payment verified by webhook (or existing paid member)
  --   zoom_requested   handed to the n8n workflow
  --   zoom_registered  Zoom accepted, join link stored
  --   zoom_failed      n8n / Zoom reported a failure — manual follow-up
  status                text not null default 'pending_payment'
                        check (status in ('pending_payment','entitled','zoom_requested','zoom_registered','zoom_failed')),
  entitled_via          text check (entitled_via is null or entitled_via in ('trial_checkout','existing_member')),
  stripe_session_id     text,
  stripe_subscription_id text,
  entitled_at           timestamptz,

  zoom_webinar_id       text,
  zoom_registrant_id    text,
  zoom_join_url         text,
  zoom_requested_at     timestamptz,
  zoom_registered_at    timestamptz,
  zoom_attempts         integer not null default 0 check (zoom_attempts >= 0),
  zoom_error            text check (zoom_error is null or char_length(zoom_error) <= 1000),

  confirmation_sent_at  timestamptz,
  sheet_synced_at       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint event_registrations_one_per_email unique (event_id, email)
);

create index if not exists event_registrations_event_status_idx
  on public.event_registrations (event_id, status);
create index if not exists event_registrations_member_idx
  on public.event_registrations (member_id);
create index if not exists event_registrations_session_idx
  on public.event_registrations (stripe_session_id);

create or replace function public.event_registrations_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_event_registrations_updated_at on public.event_registrations;
create trigger trg_event_registrations_updated_at
  before update on public.event_registrations
  for each row execute function public.event_registrations_set_updated_at();

-- Service-role only. RLS on, no policies, no grants to client roles.
alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;

comment on table public.event_registrations is
  'Event/webinar registrations gated on ASN membership. Service-role only. The n8n workflow mirrors rows to the ops sheet; this table is the source of truth.';

notify pgrst, 'reload schema';
