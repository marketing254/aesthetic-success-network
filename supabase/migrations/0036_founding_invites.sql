-- =====================================================================
-- ASN — Founding invites (private, invitation-only path)
-- Run after 0035_* (or latest).
--
-- Hand-picked founding experts / partners never touch the public form.
-- Lester adds them from the admin panel, which mints an unguessable
-- invite code, renders their PERSONALIZED agreement (name / company /
-- offer merged in), and emails them a private /founding/<code> link.
-- They open it (no login), read their own agreement, tick "I agree,"
-- and pay — same portal-locked pay model as everyone else.
--
-- One row per invite. The row holds the pending person details until
-- acceptance, when the expert/vendor row + auth user + Stripe sub are
-- provisioned.
-- =====================================================================

create table if not exists public.founding_invites (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,          -- unguessable, in the URL
  role                  text not null check (role in ('expert','partner','both')),

  -- Personal details captured by the admin (merged into the agreement).
  full_name             text not null,
  email                 text not null,
  company_name          text,
  member_offer          text,
  phone                 text,
  notes                 text,                          -- internal, never shown

  -- The agreement served + its rendered PDF.
  agreement_version     text not null default 'v3',
  agreement_pdf_path    text,                          -- storage key in `agreements`

  -- Lifecycle: sent -> viewed -> accepted (or expired).
  status                text not null default 'sent'
                          check (status in ('sent','viewed','accepted','revoked')),
  viewed_at             timestamptz,
  accepted_at           timestamptz,
  accepted_ip_hash      text,
  accepted_user_agent   text,
  expires_at            timestamptz not null default (now() + interval '30 days'),

  -- Filled at acceptance.
  expert_id             uuid references public.experts(id) on delete set null,
  vendor_id             uuid references public.vendors(id) on delete set null,
  stripe_customer_id    text,
  stripe_subscription_id text,

  created_by            uuid references public.admin_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists founding_invites_code_uidx
  on public.founding_invites (code);
create index if not exists founding_invites_email_idx
  on public.founding_invites (lower(email));
create index if not exists founding_invites_status_idx
  on public.founding_invites (status, created_at desc);

-- Service-role only — the public /founding/<code> route reads via the
-- admin client after validating the code. No public RLS policies.
alter table public.founding_invites enable row level security;
