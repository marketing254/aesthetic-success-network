-- ============================================================
-- ASN growth phase · 0021 — resource inquiries
--
-- Holds questions members ask about a specific expert kit
-- (public.expert_kits). Simplified from TD's `resource_inquiries` +
-- `resource_replies` comment-thread system, which lives inside a
-- member portal ASN doesn't have yet (Phase 3 scope). There is no
-- public submission UI in this phase — this table + its admin page
-- exist so the shape is ready the moment that portal UI ships; the
-- admin page will simply read empty until then.
-- ============================================================

create table if not exists public.resource_inquiries (
  id           uuid primary key default gen_random_uuid(),
  expert_kit_id uuid references public.expert_kits(id) on delete cascade,
  member_id    uuid references public.members(id) on delete set null,
  name         text,
  email        text,
  question     text not null check (char_length(question) between 1 and 4000),
  status       text not null default 'open'
               check (status in ('open','answered','closed')),
  admin_note   text,
  resolved_by  uuid references public.admin_users(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists resource_inquiries_status_idx
  on public.resource_inquiries (status, created_at desc);
create index if not exists resource_inquiries_kit_idx
  on public.resource_inquiries (expert_kit_id);

alter table public.resource_inquiries enable row level security;
