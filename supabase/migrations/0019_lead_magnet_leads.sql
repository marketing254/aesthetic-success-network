-- ============================================================
-- ASN growth phase · 0019 — lead magnet leads
--
-- Tracks emails captured by a gated download (e.g. a free pricing
-- calculator or "PPO fees" style guide, reframed for aesthetic
-- practices). `magnet_slug` keeps this open to multiple magnets
-- without a schema change. No public capture form exists in ASN yet
-- (the Phase 1 /tools page has no email-gate) — this table + its admin
-- page exist ahead of that capture flow so the team can start planning
-- the download itself; wiring a real form is future work.
-- ============================================================

create table if not exists public.lead_magnet_leads (
  id           uuid primary key default gen_random_uuid(),
  magnet_slug  text not null,
  email        text not null,
  full_name    text,
  practice_name text,
  source       text,
  utm          jsonb,
  ip_hash      text,
  user_agent   text,
  contacted_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (magnet_slug, email)
);

create index if not exists lead_magnet_leads_magnet_idx
  on public.lead_magnet_leads (magnet_slug, created_at desc);
create index if not exists lead_magnet_leads_email_idx
  on public.lead_magnet_leads (lower(email));

alter table public.lead_magnet_leads enable row level security;
