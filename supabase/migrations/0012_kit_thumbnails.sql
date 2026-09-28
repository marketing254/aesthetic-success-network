-- =====================================================================
-- ASN — Kit cover thumbnails (Phase 6.1)
-- Run after 0011_member_resources.sql.
--
-- Adds:
--   1. topic_thumbnail_url column on resources (denormalized per-topic)
--   2. Public `kit-thumbnails` Storage bucket
--   3. Public-read RLS policy on that bucket
--
-- The companion script landing/supabase/seed/upload-thumbnails.mjs uploads
-- the JPGs at <project-root>/thumbnails/ and writes the public URL onto
-- every resources row that shares the same topic_slug.
-- =====================================================================

-- 1. Per-topic cover thumbnail URL stored on the resources table.
--    Denormalized so every row in a topic carries the same URL — the API
--    already groups by topic, and the upload script keeps all rows in sync.
alter table public.resources
  add column if not exists topic_thumbnail_url text;

-- 2. Public storage bucket for the JPGs themselves.
insert into storage.buckets (id, name, public)
values ('kit-thumbnails', 'kit-thumbnails', true)
on conflict (id) do nothing;

-- 3. Public read so any browser can fetch the cover.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'kit-thumbnails public read'
  ) then
    create policy "kit-thumbnails public read"
      on storage.objects
      for select
      to public
      using (bucket_id = 'kit-thumbnails');
  end if;
end $$;
