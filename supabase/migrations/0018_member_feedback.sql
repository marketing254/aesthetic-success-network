-- ============================================================
-- ASN growth phase · 0018 — member feedback
--
-- General-purpose feedback inbox for the admin console. Simpler than
-- TD's kit-progress-linked `resource_feedback` (that one requires a
-- member portal with per-kit progress tracking, which is Phase 3 scope
-- here — see src/app/api/admin overview). `member_id` is nullable so
-- this table can also hold feedback submitted before a member portal
-- exists (e.g. a future public "tell us what you think" form).
-- ============================================================

create table if not exists public.member_feedback (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid references public.members(id) on delete set null,
  name         text,
  email        text,
  category     text,               -- e.g. "hotline", "deals", "kits", "general"
  rating       smallint check (rating between 1 and 5),
  message      text not null check (char_length(message) between 1 and 4000),
  status       text not null default 'new'
               check (status in ('new','reviewed','archived')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists member_feedback_status_idx
  on public.member_feedback (status, created_at desc);
create index if not exists member_feedback_member_idx
  on public.member_feedback (member_id);

alter table public.member_feedback enable row level security;
