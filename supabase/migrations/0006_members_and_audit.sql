-- ============================================================
-- ASN launch phase · 0006 — members + review-action audit trail
-- Backs the admin console's Members page (waitlist → member
-- activation) and the Audit log (every admin state change).
-- ============================================================

create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  first_name         text not null,
  last_name          text not null,
  practice_name      text,
  practice_role      text,
  phone              text,
  status             text not null default 'active'
                     check (status in ('active','paused','churned')),
  tier               text not null default 'founding',
  waitlist_signup_id uuid references public.waitlist_signups(id),
  activated_at       timestamptz,
  activated_by       text,          -- admin email
  joined_at          timestamptz,
  notes              text,
  created_at         timestamptz not null default now()
);

create unique index if not exists members_email_key
  on public.members (lower(email));

create index if not exists members_created_at_idx
  on public.members (created_at desc);

-- Every admin state change writes one of these — the Audit log page is
-- the source of truth for who did what, when.
create table if not exists public.review_actions (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,   -- waitlist_signup | expert_application | partner_application | member | admin_user
  target_id   uuid,
  action      text not null,
  note        text,
  admin_id    uuid,
  admin_email text not null,
  created_at  timestamptz not null default now()
);

create index if not exists review_actions_created_at_idx
  on public.review_actions (created_at desc);

-- RLS: deny-all (service role only).
alter table public.members        enable row level security;
alter table public.review_actions enable row level security;
