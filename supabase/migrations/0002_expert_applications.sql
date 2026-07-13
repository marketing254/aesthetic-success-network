-- ============================================================
-- ASN launch phase · 0002 — expert applications
-- ============================================================

create table if not exists public.expert_applications (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  company       text,          -- company or practice (optional)
  topics        text,          -- 3–4 areas of expertise
  bio           text,          -- short bio + title / credentials
  booking_link  text,          -- Calendly / Cal.com
  paid_courses  text,          -- Yes / No / Maybe later
  sample_link   text,          -- sample recording or content link
  content_ownership_confirmed boolean not null default false,
  agreement_accepted           boolean not null default false,
  agreement_accepted_at        timestamptz,
  source        text default 'experts-page',
  ip_hash       text,
  user_agent    text,
  status        text not null default 'new'
                check (status in ('new','in_review','approved','declined')),
  reviewed_at   timestamptz,
  reviewed_by   text,          -- admin email who last changed the status
  created_at    timestamptz not null default now()
);

-- one application per email
create unique index if not exists expert_applications_email_key
  on public.expert_applications (lower(email));

create index if not exists expert_applications_created_at_idx
  on public.expert_applications (created_at desc);

create index if not exists expert_applications_status_idx
  on public.expert_applications (status);

-- RLS: deny-all (service role only).
alter table public.expert_applications enable row level security;
