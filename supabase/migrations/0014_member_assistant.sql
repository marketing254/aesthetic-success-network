-- =====================================================================
-- ASN — Member portal AI assistant (Phase 8)
-- Run after 0013_resources_v2.sql.
--
-- Adds persistent message history for the Claude-powered member portal
-- concierge bot. One row per message; conversation = every row for that
-- member ordered by created_at.
-- =====================================================================

create table if not exists public.member_assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  -- Token accounting — only stamped on 'assistant' rows by the API after
  -- a successful Claude response. Used for usage dashboards + rate-limit
  -- audit; not exposed to the chat UI.
  tokens_input    integer,
  tokens_output   integer,
  -- Set on user rows when a message was blocked or trimmed by safety
  -- filtering. NULL on normal rows.
  blocked_reason  text,
  created_at      timestamptz not null default now()
);

create index if not exists mam_member_idx
  on public.member_assistant_messages (member_id, created_at);

-- Rate-limit lookup — count user messages in the last 24h per member
create index if not exists mam_rate_limit_idx
  on public.member_assistant_messages (member_id, created_at desc)
  where role = 'user';

-- =====================================================================
-- RLS — members can read their own conversation; the API writes via
-- the service-role client (bypasses RLS). No one else can read.
-- =====================================================================
alter table public.member_assistant_messages enable row level security;

drop policy if exists "member reads own messages"
  on public.member_assistant_messages;
create policy "member reads own messages"
  on public.member_assistant_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = member_assistant_messages.member_id
        and m.auth_user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

grant select on public.member_assistant_messages to authenticated;
