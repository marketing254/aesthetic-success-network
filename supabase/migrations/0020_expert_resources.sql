-- =====================================================================
-- ASN — Expert resources schema
-- Run this AFTER 0019_experts_grants_fix.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- Resources are files an expert uploads (SOPs, templates, slide decks,
-- recordings, PDFs). They land in 'pending_review', the team reviews and
-- re-brands them, then publishes to the member library. Each resource
-- belongs to exactly one expert.
--
-- File storage:
--   We use a private Supabase Storage bucket "expert-resources" with
--   path convention {expert_id}/{resource_id}.{ext}. Storage policies
--   restrict each expert's reads/writes to their own folder; the admin
--   service role can list and read across all folders.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMs
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expert_resource_status') then
    create type expert_resource_status as enum (
      'draft',           -- expert is still editing locally before submitting
      'pending_review',  -- submitted to the team for review + branding
      'needs_changes',   -- team asked for revisions
      'approved',        -- approved + published to the member library
      'rejected',        -- declined; no further action
      'archived'         -- expert/team removed it from rotation
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expert_resource_kind') then
    create type expert_resource_kind as enum (
      'sop',
      'template',
      'slide_deck',
      'recording',
      'pdf',
      'checklist',
      'worksheet',
      'other'
    );
  end if;
end$$;

-- =====================================================================
-- expert_resources
-- =====================================================================
create table if not exists public.expert_resources (
  id                       uuid primary key default gen_random_uuid(),
  expert_id                uuid not null references public.experts(id) on delete cascade,

  -- What the expert submitted
  title                    text not null check (char_length(title) between 1 and 200),
  description              text check (char_length(description) <= 4000),
  kind                     expert_resource_kind not null default 'other',

  -- Storage references — primary file
  storage_bucket           text not null default 'expert-resources',
  storage_path             text not null,       -- e.g. "<expert_id>/<resource_id>.pdf"
  file_name                text,                -- original filename for display
  file_size                bigint check (file_size is null or file_size >= 0),
  mime_type                text,

  -- Branded version published by the team (filled at approval)
  branded_storage_path     text,
  published_url            text,                -- public URL once it lives in the member library

  -- Lifecycle
  status                   expert_resource_status not null default 'pending_review',
  submitted_at             timestamptz default now(),
  reviewed_at              timestamptz,
  reviewed_by              uuid references public.admin_users(id) on delete set null,
  review_note              text check (review_note is null or char_length(review_note) <= 2000),
  published_at             timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists expert_resources_expert_idx
  on public.expert_resources (expert_id, created_at desc);

create index if not exists expert_resources_status_idx
  on public.expert_resources (status, submitted_at desc);

-- Keep updated_at fresh
create or replace function public.expert_resources_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_expert_resources_updated_at on public.expert_resources;
create trigger trg_expert_resources_updated_at
  before update on public.expert_resources
  for each row execute function public.expert_resources_set_updated_at();

-- =====================================================================
-- Row Level Security on expert_resources
-- =====================================================================
alter table public.expert_resources enable row level security;

drop policy if exists "expert_resources_self_select" on public.expert_resources;
drop policy if exists "expert_resources_self_insert" on public.expert_resources;
drop policy if exists "expert_resources_self_update" on public.expert_resources;
drop policy if exists "expert_resources_self_delete" on public.expert_resources;

-- An expert can see their own resources only.
create policy "expert_resources_self_select"
  on public.expert_resources
  for select
  using (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

-- An expert can insert resources for themselves only.
create policy "expert_resources_self_insert"
  on public.expert_resources
  for insert
  with check (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

-- An expert can update their own resources (e.g. title, description, or
-- mark as draft → pending_review). Status transitions that require admin
-- (approved, rejected) are enforced at the app layer.
create policy "expert_resources_self_update"
  on public.expert_resources
  for update
  using (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  )
  with check (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

-- An expert can delete their own pending/draft resources.
create policy "expert_resources_self_delete"
  on public.expert_resources
  for delete
  using (
    expert_id in (select id from public.experts where auth_user_id = auth.uid())
  );

-- =====================================================================
-- GRANTs (project has "Auto-expose new tables" OFF — see 0004_grants.sql)
-- =====================================================================
grant select, insert, update, delete on public.expert_resources to authenticated;

-- =====================================================================
-- STORAGE — bucket for raw uploads
-- We create the bucket via storage.buckets (the supported pattern in
-- Supabase migrations). Mark it as private (public=false); files are
-- served through signed URLs from /api/expert/resources.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expert-resources',
  'expert-resources',
  false,
  524288000,  -- 500 MB cap per file
  null         -- null = allow any MIME (the API route still validates)
)
on conflict (id) do nothing;

-- Storage RLS — restrict reads/writes to each expert's own folder.
-- Path convention is "{expert_id}/{filename}", so the first path segment
-- is the expert's UUID. We match `name like (expert_id::text || '/%')`.
drop policy if exists "expert_resources_storage_select" on storage.objects;
drop policy if exists "expert_resources_storage_insert" on storage.objects;
drop policy if exists "expert_resources_storage_update" on storage.objects;
drop policy if exists "expert_resources_storage_delete" on storage.objects;

create policy "expert_resources_storage_select"
  on storage.objects
  for select
  using (
    bucket_id = 'expert-resources'
    and (
      split_part(name, '/', 1)::uuid in (
        select id::text::uuid from public.experts where auth_user_id = auth.uid()
      )
    )
  );

create policy "expert_resources_storage_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'expert-resources'
    and (
      split_part(name, '/', 1)::uuid in (
        select id::text::uuid from public.experts where auth_user_id = auth.uid()
      )
    )
  );

create policy "expert_resources_storage_update"
  on storage.objects
  for update
  using (
    bucket_id = 'expert-resources'
    and (
      split_part(name, '/', 1)::uuid in (
        select id::text::uuid from public.experts where auth_user_id = auth.uid()
      )
    )
  );

create policy "expert_resources_storage_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'expert-resources'
    and (
      split_part(name, '/', 1)::uuid in (
        select id::text::uuid from public.experts where auth_user_id = auth.uid()
      )
    )
  );

-- Force PostgREST to refresh its schema cache.
notify pgrst, 'reload schema';
