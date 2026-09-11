-- ============================================================
-- ASN member-portal phase · 0023 — kit progress + feedback
--
-- Ported from TD's `member_resource_progress` / `resource_feedback`,
-- adapted to ASN's content model: ASN has no separate `resources` table
-- (TD tracks individual video/pdf/audio items inside a "topic"; ASN's
-- public.expert_kits is already the whole kit, one row per kit — see
-- 0021's note). So progress + feedback are tracked per kit, not per
-- sub-resource. `resource_inquiries` (0021) is reused unchanged as the
-- per-kit Q&A thread this migration finally gives a submission UI to.
-- ============================================================

create table if not exists public.member_kit_progress (
  member_id     uuid not null references public.members(id) on delete cascade,
  expert_kit_id uuid not null references public.expert_kits(id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  completed_at  timestamptz,
  primary key (member_id, expert_kit_id)
);

create index if not exists member_kit_progress_kit_idx
  on public.member_kit_progress (expert_kit_id);

alter table public.member_kit_progress enable row level security;

create table if not exists public.kit_feedback (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  expert_kit_id uuid not null references public.expert_kits(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (member_id, expert_kit_id)
);

create index if not exists kit_feedback_kit_idx
  on public.kit_feedback (expert_kit_id);

alter table public.kit_feedback enable row level security;
