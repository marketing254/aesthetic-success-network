-- =====================================================================
-- ASN — Job board: reset the FIRST-DRAFT schema before the real one.
-- Run AFTER 0059_pending_registrations.sql and BEFORE 0061_job_board.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- An earlier draft of the job board created public.job_posts and
-- public.job_views with a different shape (text columns instead of
-- enums, no job_post_views, a 4MB banner bucket limit). Those tables
-- were only ever used for testing and are empty. 0061–0064 recreate the
-- board from the reviewed source, and 0061 uses `create table if not
-- exists`, so the draft tables MUST be gone first or the new columns,
-- constraints and enums never land.
--
-- SAFE TO RE-RUN. Only drops the draft objects if they exist.
-- =====================================================================

drop table if exists public.job_views cascade;
drop table if exists public.job_posts cascade;

-- The draft bucket carried a 4MB / mime allow-list set at the bucket
-- level. The reviewed code enforces 5MB + PNG/JPG/WebP in the upload
-- route instead, so clear the bucket-level limits to match.
update storage.buckets
   set file_size_limit = null,
       allowed_mime_types = null
 where id = 'job-banners';

notify pgrst, 'reload schema';
