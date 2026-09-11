-- ============================================================
-- ASN growth phase · 0014 — founding member invites
--
-- Hand-picked prospects skip the public waitlist: an admin mints an
-- unguessable code, the prospect opens /founding/<code> (no login),
-- reads the Member Agreement, accepts, and goes straight to Stripe
-- Checkout for the Founding plan. Payment is verified server-side on
-- /welcome, which is also where the `members` row actually gets
-- created (see src/app/welcome/page.tsx) — this table just holds the
-- pending invite until then.
--
-- One row per invite. `member_id` fills in once accepted+paid.
-- ============================================================

create table if not exists public.founding_member_invites (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,             -- unguessable, in the URL
  full_name     text not null,
  email         text not null,
  practice_name text,
  notes         text,                      -- internal, admin-only, never shown

  status        text not null default 'sent'
                check (status in ('sent','viewed','accepted','revoked')),
  viewed_at     timestamptz,
  accepted_at   timestamptz,

  member_id     uuid references public.members(id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '30 days'),

  created_by    uuid references public.admin_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists founding_member_invites_code_uidx
  on public.founding_member_invites (code);
create index if not exists founding_member_invites_email_idx
  on public.founding_member_invites (lower(email));
create index if not exists founding_member_invites_status_idx
  on public.founding_member_invites (status, created_at desc);

-- Service-role only — the unguessable code is the public credential,
-- same pattern as every other intake table in this schema.
alter table public.founding_member_invites enable row level security;
