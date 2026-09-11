-- ============================================================
-- ASN member portal · 0027 — AI assistant message log (stub)
--
-- Schema for the member-portal AI concierge chat widget. No OpenAI (or
-- other LLM) call is wired up yet — POST /api/portal/member/assistant
-- stores the member's message and returns a canned placeholder reply.
-- Wiring a real model just needs an OPENAI_API_KEY and swapping the
-- canned reply in the route handler for a real completion call; this
-- table is already shaped to hold that conversation history.
-- ============================================================

create table if not exists public.member_assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null check (char_length(content) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists member_assistant_messages_member_idx
  on public.member_assistant_messages (member_id, created_at);

alter table public.member_assistant_messages enable row level security;
