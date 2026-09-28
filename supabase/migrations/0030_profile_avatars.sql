-- =====================================================================
-- 0030_profile_avatars.sql
--
-- Adds avatar_url to every role table (members, experts, vendors) so each
-- portal can show + edit a profile picture from the sidebar identity card.
--
-- experts.headshot_url already exists; that stays as the authoritative
-- public-facing headshot. avatar_url is the in-portal profile picture
-- (also used in the comment threads + dashboards).
-- =====================================================================

alter table public.members  add column if not exists avatar_url text;
alter table public.vendors  add column if not exists avatar_url text;
alter table public.experts  add column if not exists avatar_url text;

notify pgrst, 'reload schema';
