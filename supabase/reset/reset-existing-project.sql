-- =====================================================================
-- ASN — Reset the EXISTING Supabase project's database before running the
-- new migrations (0001 → 0068).
--
-- Use this when you want to keep the project (URL, keys, Auth users, SMTP,
-- email templates, redirect URLs) but replace the old launch-phase tables
-- (waitlist_signups, members, expert_applications, partner_applications,
-- hotline_*, …) with the full DMN-replica schema.
--
-- WHAT IT DOES
--   1. Drops everything in the `public` schema (tables, views, functions,
--      types, triggers, policies) and recreates an empty `public` schema
--      with Supabase's standard grants.
--   2. Drops every policy on storage.objects (the new migrations recreate
--      the ones they need with the same names).
--   3. Tries to empty the old `agreements` bucket. If Supabase blocks the
--      delete, empty that bucket from Dashboard → Storage and rerun.
--   4. Leaves auth.users untouched. Delete old TEST members/experts/partners
--      yourself in Dashboard → Authentication → Users (keep the admins).
--
-- THIS DELETES ALL APP DATA IN THE PROJECT. Pre-launch test data only.
-- Run once, in the SQL editor, then run 0001_waitlist.sql and onward.
-- =====================================================================

begin;

-- 1. wipe public
drop schema public cascade;
create schema public;
comment on schema public is 'standard public schema';
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;

-- 2. drop every storage.objects policy (old ones may reference dropped functions)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

-- 3. empty the old bucket(s) so the new migrations can reuse the ids
do $$
begin
  delete from storage.objects where bucket_id in ('agreements');
exception when others then
  raise notice 'Could not delete storage objects here (%). Empty the bucket in the Dashboard, then continue.', sqlerrm;
end $$;

commit;

-- Sanity check (should return 0 rows):
--   select table_name from information_schema.tables where table_schema = 'public';
