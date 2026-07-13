-- ============================================================
-- ASN launch phase · 0004 — admin team + auth audit
-- ============================================================

create table if not exists public.admin_users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  full_name      text not null,
  role           text not null default 'admin'
                 check (role in ('owner','admin','reviewer','support')),
  active         boolean not null default true,
  auth_user_id   uuid,          -- linked to auth.users on first magic-link sign-in
  last_active_at timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists admin_users_email_key
  on public.admin_users (lower(email));

create table if not exists public.auth_audit (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,        -- login_success, …
  email      text,
  user_id    uuid,
  user_type  text,                 -- admin
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_created_at_idx
  on public.auth_audit (created_at desc);

-- RLS
alter table public.admin_users enable row level security;
alter table public.auth_audit  enable row level security;

-- Signed-in admins may read their own admin row (the middleware and the
-- console shell use the anon key + session for this check). All writes go
-- through the service role.
drop policy if exists admin_users_read_own on public.admin_users;
create policy admin_users_read_own
  on public.admin_users
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ── Seed the admin team (edit emails per vertical) ─────────────────
insert into public.admin_users (email, full_name, role, active)
values ('lester@ekwa.com',  'Lester',  'owner', true),
       ('rushdha@ekwa.com', 'Rushdha', 'admin', true)
on conflict do nothing;
