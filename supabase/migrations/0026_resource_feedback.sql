-- =====================================================================
-- 0026_resource_feedback.sql
--
-- Lightweight Udemy-style mid-course feedback. When a member crosses 50%
-- progress in a kit, the UI nudges them with a single-question rating
-- (1–5 stars) + optional comment. One row per (member_id, topic_slug).
-- Insert-once, no edit: keeps the signal honest and our admin reporting
-- simple (just average and tail).
--
-- Why topic_slug (a kit) and not resource_id (a single video):
--   Members consume kits as a group — the feedback should sit at the
--   level the user thinks at, not at the resource record level.
-- =====================================================================

create table if not exists public.resource_feedback (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  topic_slug    text not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (char_length(comment) <= 1000),
  -- Snapshot of the % the member had completed when they submitted the
  -- feedback. Useful when reading the admin view: did they bail at 50%
  -- or rate at 90%? Materially different signal.
  progress_pct  smallint not null check (progress_pct between 0 and 100),
  created_at    timestamptz not null default now(),
  unique (member_id, topic_slug)
);

create index if not exists resource_feedback_topic_idx
  on public.resource_feedback (topic_slug, created_at desc);

create index if not exists resource_feedback_member_idx
  on public.resource_feedback (member_id, created_at desc);

-- RLS — members can read & insert their own row. Admin reads via service role.
alter table public.resource_feedback enable row level security;

drop policy if exists resource_feedback_select_self on public.resource_feedback;
create policy resource_feedback_select_self
  on public.resource_feedback for select
  to authenticated
  using (member_id = public.current_member_id());

drop policy if exists resource_feedback_insert_self on public.resource_feedback;
create policy resource_feedback_insert_self
  on public.resource_feedback for insert
  to authenticated
  with check (member_id = public.current_member_id());

grant select, insert on public.resource_feedback to authenticated;
grant all on public.resource_feedback to service_role;

notify pgrst, 'reload schema';
