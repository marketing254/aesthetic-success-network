-- 0023_network_realtime.sql
--
-- Enable Supabase Realtime broadcasting on the three network tables so the
-- client-side feed (NetworkFeed.tsx) receives push events when posts,
-- reactions, or comments change — no more polling for inbound activity.
--
-- Supabase's Realtime is driven by the `supabase_realtime` publication.
-- Adding a table to that publication tells Postgres to stream wal events
-- for that table out through the Realtime gateway. The client connects
-- via createBrowserSupabase().channel("…").on("postgres_changes", …).
--
-- Safe to re-run: `add table` is idempotent in modern Postgres (15+) when
-- the table is already a member, but we wrap each in DO blocks so older
-- engines don't error either.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'expert_posts'
  ) then
    alter publication supabase_realtime add table public.expert_posts;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_reactions'
  ) then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_comments'
  ) then
    alter publication supabase_realtime add table public.post_comments;
  end if;
end $$;

-- The Realtime gateway also requires SELECT on the table for the role
-- the channel subscribes as (anon or authenticated). The existing 0021
-- migration already grants select on all three tables to authenticated;
-- this is a no-op restate so anyone running this file standalone gets a
-- consistent grant matrix.
grant select on public.expert_posts to authenticated;
grant select on public.post_reactions to authenticated;
grant select on public.post_comments to authenticated;

notify pgrst, 'reload schema';
