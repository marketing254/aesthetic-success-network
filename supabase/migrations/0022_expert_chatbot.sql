-- =====================================================================
-- ASN — Expert chatbot scaffold (LLM integration deferred)
-- Run AFTER 0021_network_feed.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- This migration only stands up the data model + permissions for
-- per-expert AI chatbots. The actual LLM provider (OpenAI / Anthropic),
-- vector store, embeddings, and retrieval pipeline are wired up in a
-- follow-up turn after the team picks a provider.
--
-- Until then, the stub API at /api/network/experts/[id]/chat returns a
-- canned acknowledgement so the UI is testable end-to-end.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMs
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chatbot_message_role') then
    create type chatbot_message_role as enum (
      'member',     -- the member talking to the bot
      'bot',        -- the bot's reply (canned for now)
      'expert'      -- the expert took over the conversation
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chatbot_conversation_status') then
    create type chatbot_conversation_status as enum (
      'open',                -- bot is handling
      'escalated',           -- bot flagged for expert review
      'expert_handling',     -- expert has taken over
      'resolved',            -- closed
      'abandoned'            -- inactive 30+ days
    );
  end if;
end$$;

-- =====================================================================
-- chatbot_conversations
-- One conversation per (member, expert) pair. Reopened if member
-- comes back to the same expert after resolved.
-- =====================================================================
create table if not exists public.chatbot_conversations (
  id                       uuid primary key default gen_random_uuid(),
  expert_id                uuid not null references public.experts(id) on delete cascade,
  member_auth_user_id      uuid not null references auth.users(id) on delete cascade,
  member_display_name      text not null check (char_length(member_display_name) between 1 and 120),
  status                   chatbot_conversation_status not null default 'open',
  last_message_at          timestamptz not null default now(),
  last_member_message_at   timestamptz,
  last_bot_message_at      timestamptz,
  last_expert_message_at   timestamptz,
  message_count            integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists chatbot_conversations_unique_pair
  on public.chatbot_conversations (expert_id, member_auth_user_id);

create index if not exists chatbot_conversations_expert_idx
  on public.chatbot_conversations (expert_id, last_message_at desc);

create or replace function public.chatbot_conversations_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_chatbot_conv_updated_at on public.chatbot_conversations;
create trigger trg_chatbot_conv_updated_at
  before update on public.chatbot_conversations
  for each row execute function public.chatbot_conversations_set_updated_at();

-- =====================================================================
-- chatbot_messages
-- =====================================================================
create table if not exists public.chatbot_messages (
  id                       uuid primary key default gen_random_uuid(),
  conversation_id          uuid not null references public.chatbot_conversations(id) on delete cascade,
  role                     chatbot_message_role not null,
  content                  text not null check (char_length(content) between 1 and 8000),
  -- When role='bot', track whether this was the stub canned response
  -- or a real LLM call (for analytics + cost tracking once LLM lands).
  bot_provider             text check (bot_provider is null or char_length(bot_provider) <= 32),
  bot_model                text check (bot_model is null or char_length(bot_model) <= 64),
  bot_latency_ms           integer check (bot_latency_ms is null or bot_latency_ms >= 0),
  bot_token_input          integer check (bot_token_input is null or bot_token_input >= 0),
  bot_token_output         integer check (bot_token_output is null or bot_token_output >= 0),
  created_at               timestamptz not null default now()
);

create index if not exists chatbot_messages_conversation_idx
  on public.chatbot_messages (conversation_id, created_at);

-- =====================================================================
-- Counter triggers — keep conversation stats in sync.
-- =====================================================================
create or replace function public.chatbot_after_message()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.chatbot_conversations
      set
        message_count = message_count + 1,
        last_message_at = new.created_at,
        last_member_message_at = case when new.role = 'member' then new.created_at else last_member_message_at end,
        last_bot_message_at = case when new.role = 'bot' then new.created_at else last_bot_message_at end,
        last_expert_message_at = case when new.role = 'expert' then new.created_at else last_expert_message_at end
      where id = new.conversation_id;
    return new;
  end if;
  return null;
end$$;

drop trigger if exists trg_chatbot_after_message on public.chatbot_messages;
create trigger trg_chatbot_after_message
  after insert on public.chatbot_messages
  for each row execute function public.chatbot_after_message();

-- =====================================================================
-- Row Level Security
-- Conversations + messages: only the involved member OR the owning
-- expert can read. All writes go through service-role API endpoints
-- so policies are conservative.
-- =====================================================================
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;

drop policy if exists "chatbot_conversations_participants" on public.chatbot_conversations;
drop policy if exists "chatbot_messages_participants" on public.chatbot_messages;

create policy "chatbot_conversations_participants"
  on public.chatbot_conversations
  for select
  using (
    member_auth_user_id = auth.uid()
    or expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

create policy "chatbot_messages_participants"
  on public.chatbot_messages
  for select
  using (
    conversation_id in (
      select id from public.chatbot_conversations
      where member_auth_user_id = auth.uid()
        or expert_id in (select id from public.experts where auth_user_id = auth.uid())
    )
  );

-- =====================================================================
-- GRANTs
-- =====================================================================
grant select on public.chatbot_conversations to authenticated;
grant select on public.chatbot_messages to authenticated;

notify pgrst, 'reload schema';
