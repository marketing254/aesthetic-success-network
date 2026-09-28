-- =====================================================================
-- 0027_book_club_and_analytics.sql
--
-- Two related pieces of the partner-/expert-resource pipeline:
--
-- 1) `resources.kit_type` — distinguishes a standard kit from a Book Club
--    kit so the member portal can render Book Club entries with their
--    own shape (quotes, chapters, discussion prompts).
--
-- 2) `resources.book_club_payload` — JSONB blob that holds the Book Club
--    specific fields. We don't normalise these into their own tables
--    because the consumer is purely the member-portal renderer; flat
--    JSONB stays the cheapest, simplest path.
--
-- 3) `resource_views` — counts member views per resource. Powers the
--    partner/expert analytics dashboard ("how many members opened your
--    kit"). One row per view event so we can compute unique-members AND
--    raw view counts off the same table.
-- =====================================================================

-- ---- 1 & 2. Book Club shape on resources --------------------------------
alter table public.resources
  add column if not exists kit_type text
    not null default 'standard'
    check (kit_type in ('standard', 'book_club'));

alter table public.resources
  add column if not exists book_club_payload jsonb;

create index if not exists resources_kit_type_idx
  on public.resources (kit_type)
  where kit_type <> 'standard';

-- ---- 3. Resource view events --------------------------------------------
create table if not exists public.resource_views (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources(id) on delete cascade,
  member_id     uuid references public.members(id) on delete set null,
  -- IP hash + UA fingerprint kept so unauthenticated previews could be
  -- correlated later; for now we only insert authenticated views.
  ip_hash       text,
  user_agent    text,
  viewed_at     timestamptz not null default now()
);

create index if not exists resource_views_resource_idx
  on public.resource_views (resource_id, viewed_at desc);

create index if not exists resource_views_member_idx
  on public.resource_views (member_id, viewed_at desc)
  where member_id is not null;

alter table public.resource_views enable row level security;

drop policy if exists resource_views_insert_authed on public.resource_views;
create policy resource_views_insert_authed
  on public.resource_views for insert
  to authenticated
  with check (true);

-- Reads happen via service-role only (admin / partner / expert analytics
-- endpoints). No SELECT policy for `authenticated` — keeps view records
-- internal.

grant insert on public.resource_views to authenticated;
grant all on public.resource_views to service_role;

notify pgrst, 'reload schema';
