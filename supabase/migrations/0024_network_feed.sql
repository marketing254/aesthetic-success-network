-- ============================================================
-- ASN member-portal phase · 0024 — Network feed
--
-- Ported from TD's expert_posts / post_reactions / post_comments.
-- Simplified for ASN's schema (no separate `experts`/`vendors`
-- identity table — expert_applications / partner_applications ARE
-- those tables, see 0002/0003) and for this pass's scope: only
-- experts and partners can author posts (matches TD); members can
-- read, react and comment. Reactor/commenter identity is denormalised
-- (auth_user_id + kind + display name) rather than joined, exactly
-- like TD's post_reactions/post_comments, since a reactor can be any
-- of four different role tables.
--
-- Realtime: ASN ships this with polling refresh, not a Supabase
-- Realtime channel subscription — see PLAN notes for Phase 3. The
-- schema is realtime-ready (add these three tables to the
-- supabase_realtime publication later) but wiring the client
-- .channel() subscription is deferred.
-- ============================================================

create table if not exists public.network_posts (
  id            uuid primary key default gen_random_uuid(),
  expert_id     uuid references public.expert_applications(id) on delete cascade,
  partner_id    uuid references public.partner_applications(id) on delete cascade,
  author_name   text not null,        -- denormalised for member-facing reads
  content       text not null check (char_length(content) between 1 and 4000),
  link_url      text,
  status        text not null default 'published'
                check (status in ('draft','published','hidden')),
  published_at  timestamptz,
  reaction_count int not null default 0,
  comment_count  int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint network_posts_one_author check (
    (expert_id is not null and partner_id is null) or
    (expert_id is null and partner_id is not null)
  )
);

create index if not exists network_posts_status_idx
  on public.network_posts (status, published_at desc);
create index if not exists network_posts_expert_idx
  on public.network_posts (expert_id, created_at desc);
create index if not exists network_posts_partner_idx
  on public.network_posts (partner_id, created_at desc);

create table if not exists public.network_post_reactions (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null references public.network_posts(id) on delete cascade,
  auth_user_id         uuid not null,
  author_kind          text not null check (author_kind in ('member','expert','partner','admin')),
  author_display_name  text not null,
  kind                 text not null default 'heart'
                       check (kind in ('heart','insightful','helpful','agree')),
  created_at           timestamptz not null default now()
);

create unique index if not exists network_post_reactions_unique
  on public.network_post_reactions (post_id, auth_user_id);

create table if not exists public.network_post_comments (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null references public.network_posts(id) on delete cascade,
  auth_user_id         uuid not null,
  author_kind          text not null check (author_kind in ('member','expert','partner','admin')),
  author_display_name  text not null,
  content              text not null check (char_length(content) between 1 and 2000),
  created_at           timestamptz not null default now()
);

create index if not exists network_post_comments_post_idx
  on public.network_post_comments (post_id, created_at asc);

-- Keep the denormalised counters on network_posts in sync so the feed
-- list query never needs a count(*) join.
create or replace function public.network_post_reaction_count_sync()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.network_posts set reaction_count = reaction_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.network_posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists network_post_reactions_count on public.network_post_reactions;
create trigger network_post_reactions_count
  after insert or delete on public.network_post_reactions
  for each row execute function public.network_post_reaction_count_sync();

create or replace function public.network_post_comment_count_sync()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.network_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.network_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists network_post_comments_count on public.network_post_comments;
create trigger network_post_comments_count
  after insert or delete on public.network_post_comments
  for each row execute function public.network_post_comment_count_sync();

-- RLS: deny-all (service role only, same as every portal table).
alter table public.network_posts          enable row level security;
alter table public.network_post_reactions enable row level security;
alter table public.network_post_comments  enable row level security;
