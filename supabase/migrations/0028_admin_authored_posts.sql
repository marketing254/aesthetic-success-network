-- =====================================================================
-- 0028_admin_authored_posts.sql
--
-- The admin "post on behalf" composer needs an audit field so we can
-- always answer "did the expert write this, or did an admin?". Nullable —
-- self-authored expert posts leave this null.
-- =====================================================================

alter table public.expert_posts
  add column if not exists composed_by_admin_id uuid
    references public.admin_users(id) on delete set null;

create index if not exists expert_posts_composed_by_admin_idx
  on public.expert_posts (composed_by_admin_id)
  where composed_by_admin_id is not null;

notify pgrst, 'reload schema';
