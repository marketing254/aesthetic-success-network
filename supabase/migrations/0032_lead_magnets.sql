-- =====================================================================
-- 0032_lead_magnets.sql
--
-- Tracks every email captured by a homepage lead-magnet download
-- (e.g. a free pricing-and-margins kit). The admin
-- Lead Magnets page reads these rows so the team can see who's
-- downloading + follow up.
-- =====================================================================

create table if not exists public.lead_magnet_leads (
  id          uuid primary key default gen_random_uuid(),
  -- Stable slug identifying the magnet (e.g. "pricing-margins" for a free PDF).
  -- Lets us grow to multiple magnets without changing the schema.
  magnet_slug text not null,
  email       text not null,
  full_name   text,
  source      text,            -- e.g. "landing-free-kit"
  utm         jsonb,
  ip_hash     text,
  user_agent  text,
  -- Set when the team has reached out / converted them — manual flag,
  -- updated by the admin Lead Magnets page.
  contacted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (magnet_slug, email)
);

create index if not exists lead_magnet_leads_magnet_idx
  on public.lead_magnet_leads (magnet_slug, created_at desc);

create index if not exists lead_magnet_leads_email_idx
  on public.lead_magnet_leads (email);

alter table public.lead_magnet_leads enable row level security;
grant all on public.lead_magnet_leads to service_role;

notify pgrst, 'reload schema';
