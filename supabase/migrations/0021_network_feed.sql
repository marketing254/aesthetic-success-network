-- =====================================================================
-- ASN — Network social feed (posts + reactions + comments)
-- Run AFTER 0020_expert_resources.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Three tables power the cross-network social feed:
--   - expert_posts        : status updates authored by experts
--   - post_reactions      : member/partner/expert reactions on a post
--   - post_comments       : threaded-ish (flat) comments on a post
--
-- Author identity on reactions + comments is recorded at write time
-- (auth_user_id + author_kind + display_name + subtitle) so reads never
-- have to join across members/vendors/experts. Costs a little stored
-- redundancy, saves a lot of query complexity.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMs
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expert_post_status') then
    create type expert_post_status as enum (
      'draft',
      'published',
      'hidden',     -- admin moderation
      'deleted'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'network_author_kind') then
    create type network_author_kind as enum (
      'expert',
      'member',
      'partner',
      'admin'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_reaction_kind') then
    create type post_reaction_kind as enum (
      'heart',
      'insightful',
      'helpful',
      'agree'
    );
  end if;
end$$;

-- =====================================================================
-- expert_posts
-- =====================================================================
create table if not exists public.expert_posts (
  id                       uuid primary key default gen_random_uuid(),
  expert_id                uuid not null references public.experts(id) on delete cascade,
  content                  text not null check (char_length(content) between 1 and 4000),
  image_url                text check (image_url is null or char_length(image_url) <= 500),
  link_url                 text check (link_url is null or char_length(link_url) <= 500),
  status                   expert_post_status not null default 'published',
  published_at             timestamptz default now(),
  hidden_at                timestamptz,
  hidden_by                uuid references public.admin_users(id) on delete set null,
  hidden_reason            text check (hidden_reason is null or char_length(hidden_reason) <= 500),
  reaction_count           integer not null default 0 check (reaction_count >= 0),
  comment_count            integer not null default 0 check (comment_count >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists expert_posts_feed_idx
  on public.expert_posts (status, published_at desc)
  where status = 'published';

create index if not exists expert_posts_expert_idx
  on public.expert_posts (expert_id, created_at desc);

create or replace function public.expert_posts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_expert_posts_updated_at on public.expert_posts;
create trigger trg_expert_posts_updated_at
  before update on public.expert_posts
  for each row execute function public.expert_posts_set_updated_at();

-- =====================================================================
-- post_reactions
-- One reaction kind per (post, auth_user) — toggle by upsert + delete.
-- =====================================================================
create table if not exists public.post_reactions (
  id                       uuid primary key default gen_random_uuid(),
  post_id                  uuid not null references public.expert_posts(id) on delete cascade,
  author_auth_user_id      uuid not null references auth.users(id) on delete cascade,
  author_kind              network_author_kind not null,
  author_display_name      text not null check (char_length(author_display_name) between 1 and 120),
  kind                     post_reaction_kind not null default 'heart',
  created_at               timestamptz not null default now()
);

create unique index if not exists post_reactions_uniq
  on public.post_reactions (post_id, author_auth_user_id);

create index if not exists post_reactions_post_idx
  on public.post_reactions (post_id, created_at desc);

-- =====================================================================
-- post_comments (flat, no nested replies for v1)
-- =====================================================================
create table if not exists public.post_comments (
  id                       uuid primary key default gen_random_uuid(),
  post_id                  uuid not null references public.expert_posts(id) on delete cascade,
  author_auth_user_id      uuid not null references auth.users(id) on delete cascade,
  author_kind              network_author_kind not null,
  author_display_name      text not null check (char_length(author_display_name) between 1 and 120),
  author_subtitle          text check (author_subtitle is null or char_length(author_subtitle) <= 160),
  content                  text not null check (char_length(content) between 1 and 2000),
  hidden_at                timestamptz,
  hidden_by                uuid references public.admin_users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);

create or replace function public.post_comments_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_post_comments_updated_at on public.post_comments;
create trigger trg_post_comments_updated_at
  before update on public.post_comments
  for each row execute function public.post_comments_set_updated_at();

-- =====================================================================
-- Counter triggers — keep reaction_count + comment_count in sync.
-- Cheaper than aggregating on every read.
-- =====================================================================
create or replace function public.bump_post_reaction_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.expert_posts
      set reaction_count = reaction_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.expert_posts
      set reaction_count = greatest(0, reaction_count - 1)
      where id = old.post_id;
    return old;
  end if;
  return null;
end$$;

drop trigger if exists trg_post_reactions_count on public.post_reactions;
create trigger trg_post_reactions_count
  after insert or delete on public.post_reactions
  for each row execute function public.bump_post_reaction_count();

create or replace function public.bump_post_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.expert_posts
      set comment_count = comment_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.expert_posts
      set comment_count = greatest(0, comment_count - 1)
      where id = old.post_id;
    return old;
  end if;
  return null;
end$$;

drop trigger if exists trg_post_comments_count on public.post_comments;
create trigger trg_post_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.bump_post_comment_count();

-- =====================================================================
-- Row Level Security
-- All reads happen through service-role API routes that pre-filter, so
-- we keep the RLS shape minimal: enable RLS to block anon, allow
-- authenticated to read published posts only.
-- =====================================================================
alter table public.expert_posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "expert_posts_read_published" on public.expert_posts;
drop policy if exists "expert_posts_self_modify" on public.expert_posts;
drop policy if exists "post_reactions_read" on public.post_reactions;
drop policy if exists "post_reactions_self_modify" on public.post_reactions;
drop policy if exists "post_comments_read" on public.post_comments;
drop policy if exists "post_comments_self_insert" on public.post_comments;
drop policy if exists "post_comments_self_modify" on public.post_comments;

-- Any authenticated user can READ posts that are published.
create policy "expert_posts_read_published"
  on public.expert_posts
  for select
  using (status = 'published');

-- Expert can update/delete their own posts.
create policy "expert_posts_self_modify"
  on public.expert_posts
  for all
  using (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  )
  with check (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

-- Anyone authenticated can read reactions + comments on visible posts.
create policy "post_reactions_read"
  on public.post_reactions
  for select
  using (true);

create policy "post_reactions_self_modify"
  on public.post_reactions
  for all
  using (author_auth_user_id = auth.uid())
  with check (author_auth_user_id = auth.uid());

create policy "post_comments_read"
  on public.post_comments
  for select
  using (hidden_at is null);

create policy "post_comments_self_insert"
  on public.post_comments
  for insert
  with check (author_auth_user_id = auth.uid());

create policy "post_comments_self_modify"
  on public.post_comments
  for update
  using (author_auth_user_id = auth.uid())
  with check (author_auth_user_id = auth.uid());

-- =====================================================================
-- GRANTs (project has "Auto-expose new tables" OFF)
-- =====================================================================
grant select, insert, update, delete on public.expert_posts to authenticated;
grant select, insert, update, delete on public.post_reactions to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;

notify pgrst, 'reload schema';
