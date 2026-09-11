-- ============================================================
-- ASN growth phase · 0015 — personalized expert/partner invite links
--
-- Admin creates a personalized link for an expert or partner prospect
-- and pastes it into a manually written email. The link lands on
-- /invite/<code>, greets the person by name, and pre-fills the normal
-- application form (same expert_applications / partner_applications
-- tables everyone else applies into — this is a head start, not a
-- different track). Modeled on founding_member_invites, minus the
-- agreement/payment columns — no money moves at this step.
-- ============================================================

create table if not exists public.invite_links (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  kind         text not null check (kind in ('expert','partner')),
  full_name    text not null,
  email        text,
  company_name text,               -- partner company OR expert topic/firm
  notes        text,               -- internal, admin-only

  status       text not null default 'active'
               check (status in ('active','viewed','accepted','revoked')),
  viewed_at    timestamptz,
  accepted_at  timestamptz,

  -- Filled in once the application row is created from this link.
  expert_application_id  uuid references public.expert_applications(id) on delete set null,
  partner_application_id uuid references public.partner_applications(id) on delete set null,

  expires_at   timestamptz not null default (now() + interval '60 days'),
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists invite_links_code_uidx
  on public.invite_links (code);
create index if not exists invite_links_status_idx
  on public.invite_links (status, created_at desc);

alter table public.invite_links enable row level security;
