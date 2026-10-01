-- =====================================================================
-- ASN — Member Resources library + activation columns (Phase 6)
-- Run this after 0010_notifications.sql.
--
-- Adds:
--   1. Two columns on `members` to track activation + welcome-email sent
--   2. `resources` table     — catalog of every free / paid resource
--   3. `member_resource_progress` — per-member view + completion tracking
--   4. `member-resources` Storage bucket (RLS: signed-in active members read)
--   5. RLS policies + grants + indexes + triggers
-- =====================================================================

-- 1. Track when a waitlist signup became an active member + welcome flow
alter table public.members
  add column if not exists activated_at      timestamptz,
  add column if not exists activated_by      uuid references public.admin_users(id) on delete set null,
  add column if not exists welcome_sent_at   timestamptz;

-- =====================================================================
-- 2. resources — catalog of every learning asset
-- =====================================================================

-- Kinds the player UI knows how to render
do $$
begin
  if not exists (select 1 from pg_type where typname = 'resource_kind') then
    create type resource_kind as enum (
      'video_intro',
      'video_full',
      'video_explainer',
      'video_trailer',
      'audio',
      'action_guide',
      'checklist',
      'key_takeaways',
      'worksheet',
      'slide_deck',
      'email_sequence',
      'other'
    );
  end if;
end$$;

create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  -- Group "episodes" together. e.g. all Consult_Conversion files share a topic.
  topic_slug    text not null,            -- "consult-conversion", "injectables-pricing", etc.
  topic_title   text not null,            -- "Consult Conversion"
  topic_summary text,                     -- short blurb shown on topic card

  -- Per-resource (within a topic)
  title         text not null,            -- "Action Guide", "Worksheet", etc.
  description   text,
  kind          resource_kind not null,

  -- Storage / link
  storage_path  text,                     -- e.g. "consult-conversion/ASN_Action_Guide_Consult_Conversion.pdf"
  external_url  text,                     -- alternative if hosted elsewhere later
  thumbnail_url text,

  -- File metadata for the UI to show without a HEAD request
  mime_type     text,
  file_size_bytes bigint,
  duration_label text,                    -- "8:42" for videos, "12 pages" for PDFs

  -- Display
  position      integer not null default 0,    -- ordering within a topic
  is_free       boolean not null default true,  -- free for every active member; future: paid tier
  is_published  boolean not null default true,  -- admin can unpublish without deleting

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists resources_topic_idx       on public.resources (topic_slug, position);
create index if not exists resources_kind_idx        on public.resources (kind);
create index if not exists resources_published_idx   on public.resources (is_published) where is_published = true;

-- =====================================================================
-- 3. member_resource_progress — per-member view + completion tracking
-- =====================================================================

create table if not exists public.member_resource_progress (
  member_id      uuid not null references public.members(id) on delete cascade,
  resource_id    uuid not null references public.resources(id) on delete cascade,
  last_viewed_at timestamptz,
  completed_at   timestamptz,
  -- For videos: how many seconds the member watched (so we can resume)
  watch_seconds  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (member_id, resource_id)
);

create index if not exists mrp_member_idx   on public.member_resource_progress (member_id, last_viewed_at desc);
create index if not exists mrp_resource_idx on public.member_resource_progress (resource_id);

-- =====================================================================
-- 4. updated_at triggers (same helper as 0002)
-- =====================================================================

drop trigger if exists resources_updated_at on public.resources;
create trigger resources_updated_at
  before update on public.resources
  for each row execute procedure public.set_updated_at();

drop trigger if exists member_resource_progress_updated_at on public.member_resource_progress;
create trigger member_resource_progress_updated_at
  before update on public.member_resource_progress
  for each row execute procedure public.set_updated_at();

-- =====================================================================
-- 5. GRANTS (auto-expose is off in this project — must be explicit)
-- =====================================================================

grant all on public.resources                 to service_role;
grant all on public.member_resource_progress  to service_role;
grant select on public.resources              to authenticated, anon;
grant select, insert, update on public.member_resource_progress to authenticated;

-- =====================================================================
-- 6. RLS — resources are public-read (any active member); progress is
--    strictly per-member.
-- =====================================================================

alter table public.resources                 enable row level security;
alter table public.member_resource_progress  enable row level security;

-- Helper: current member's id, used in RLS.
create or replace function public.current_member_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
    from public.members
   where auth_user_id = auth.uid()
     and status = 'active'
   limit 1;
$$;

revoke all on function public.current_member_id from public;
grant execute on function public.current_member_id to authenticated;

-- RESOURCES — anyone signed in as an active member can read published rows.
-- Admins can write.
drop policy if exists resources_select_active_members on public.resources;
create policy resources_select_active_members
  on public.resources
  for select
  to authenticated
  using (
    is_published = true
    and (
      public.is_admin()
      or public.current_member_id() is not null
    )
  );

drop policy if exists resources_write_admin on public.resources;
create policy resources_write_admin
  on public.resources
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- PROGRESS — strictly per-member
drop policy if exists mrp_select_self on public.member_resource_progress;
create policy mrp_select_self
  on public.member_resource_progress
  for select
  to authenticated
  using (
    public.is_admin()
    or member_id = public.current_member_id()
  );

drop policy if exists mrp_upsert_self on public.member_resource_progress;
create policy mrp_upsert_self
  on public.member_resource_progress
  for insert
  to authenticated
  with check (member_id = public.current_member_id());

drop policy if exists mrp_update_self on public.member_resource_progress;
create policy mrp_update_self
  on public.member_resource_progress
  for update
  to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

-- =====================================================================
-- 7. STORAGE BUCKET — member-resources
--    Public-read so PDFs/videos can be served directly via public URL
--    without signed-URL overhead. Each file is namespaced by topic_slug
--    so admins can drop new files into the right folder.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('member-resources', 'member-resources', true)
on conflict (id) do update set public = excluded.public;

-- Anyone can SELECT (download/view) — gated at the app layer by RLS on the
-- `resources` table; only published rows are returned to non-admin members.
-- The bucket itself stays public so the public-URL pattern works.
drop policy if exists "member resources public read" on storage.objects;
create policy "member resources public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'member-resources');

-- Only admins can write/update/delete to this bucket.
drop policy if exists "member resources admin write" on storage.objects;
create policy "member resources admin write"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'member-resources' and public.is_admin());

drop policy if exists "member resources admin update" on storage.objects;
create policy "member resources admin update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'member-resources' and public.is_admin())
  with check (bucket_id = 'member-resources' and public.is_admin());

drop policy if exists "member resources admin delete" on storage.objects;
create policy "member resources admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'member-resources' and public.is_admin());

notify pgrst, 'reload schema';
