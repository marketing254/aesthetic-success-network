-- ASN — Pending registration follow-up sequence (SPEC, Lester 3 Sep 2026)
--
-- Someone starts the /start join form, reaches their work email, and
-- doesn't pay → up to three emails over seven days with a resume link;
-- email 3 carries a per-person one-month-free code valid 48 hours.
-- Everything stops the moment they pay.
--
-- One row per sequence. "One sequence per email per 30 days" is enforced
-- in code against captured_at (not a DB constraint, so an old completed
-- sequence never blocks a fresh one later).

create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  practice_name text,
  role text,
  plan text,
  utm jsonb,
  -- resume + unsubscribe tokens: opaque, unguessable, never the email
  resume_token text not null unique,
  unsubscribe_token text not null unique,
  captured_at timestamptz not null default now(),
  -- sequence progress
  email1_sent_at timestamptz,
  email2_sent_at timestamptz,
  email3_sent_at timestamptz,
  -- the one-month-free code (exists only once email 3 sends)
  code text,
  code_expires_at timestamptz,
  code_used_at timestamptz,
  resumed_at timestamptz,             -- first successful resume-link open
  -- stop state
  stopped_at timestamptz,
  stop_reason text,               -- purchased | unsubscribed | completed
  purchased_at timestamptz,
  recovered_via_email int,        -- 1/2/3: which email had been sent last when they bought
  created_at timestamptz not null default now()
);

create index if not exists pending_regs_email_idx on public.pending_registrations (lower(email));
create index if not exists pending_regs_open_idx on public.pending_registrations (captured_at)
  where stopped_at is null;
create unique index if not exists pending_regs_code_ci on public.pending_registrations (upper(code))
  where code is not null;

comment on table public.pending_registrations is
  'Pending (incomplete) registrations + their 3-email follow-up sequence (SPEC 2026-09-03). Service-role only.';

revoke all on public.pending_registrations from anon, authenticated;
alter table public.pending_registrations enable row level security;
