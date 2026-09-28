-- =====================================================================
-- ASN — Resources v2: founding kit set (Phase 7)
-- Run after 0012_kit_thumbnails.sql.
--
-- Wipes the old EP_* resources catalog and migrates the schema to the
-- founding-kit structure:
--   • per-kit category (Practice Management / Front Desk / Team & Culture /
--     Patient Experience)
--   • two thumbnail variants:
--       portal_card_url   — square cover for the member portal grid
--       resource_card_url — wide hero for the landing page + kit detail
--   • a submission / approval workflow for the admin portal
-- =====================================================================

-- 1. Wipe existing data — the old 89-file EP_* set is being replaced.
--    Storage files at member-resources/EP_*/* should be cleared separately
--    via the seed/clear-storage.mjs script before running the upload.
truncate table public.resources cascade;
truncate table public.member_resource_progress cascade;

-- 2. New per-kit metadata + two-thumbnail model + submission workflow.
alter table public.resources
  add column if not exists category text,
  add column if not exists portal_card_url text,
  add column if not exists resource_card_url text,
  add column if not exists submission_status text not null default 'approved'
    check (submission_status in ('draft', 'pending_review', 'approved', 'rejected')),
  add column if not exists submitted_by uuid references public.admin_users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by uuid references public.admin_users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_reason text;

-- 3. The old topic_thumbnail_url (single-image model) is superseded by the
--    two new url columns. Drop it once data is wiped.
alter table public.resources drop column if exists topic_thumbnail_url;

-- 4. Indexes for the new query patterns.
create index if not exists resources_category_idx
  on public.resources (category)
  where category is not null;

create index if not exists resources_submission_status_idx
  on public.resources (submission_status);

create index if not exists resources_approved_published_idx
  on public.resources (topic_slug, position)
  where submission_status = 'approved' and is_published = true;

-- 5. RLS — members can only see approved + published resources.
--    Drop the existing policy from 0011 and recreate with the new condition.
drop policy if exists resources_active_member_read on public.resources;
create policy resources_active_member_read on public.resources
  for select
  to authenticated
  using (
    submission_status = 'approved'
    and is_published = true
    and exists (
      select 1 from public.members m
      where m.auth_user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

-- 6. Public read for the landing /resources teaser grid.
--    Only metadata is exposed (title, summary, category, thumbnails).
--    The actual file URLs in external_url are public Supabase URLs anyway,
--    but the landing page UI shows a locked overlay and never links to them
--    for anonymous visitors.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'resources'
      and policyname = 'resources_public_landing_read'
  ) then
    create policy resources_public_landing_read on public.resources
      for select
      to anon
      using (submission_status = 'approved' and is_published = true);
  end if;
end $$;

-- 7. Reusable trigger to stamp approved_at on status transition.
create or replace function public.set_resources_approved_at()
returns trigger as $$
begin
  if NEW.submission_status = 'approved'
     and (OLD.submission_status is distinct from 'approved')
     and NEW.approved_at is null then
    NEW.approved_at = now();
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_resources_approved_at on public.resources;
create trigger trg_resources_approved_at
  before update on public.resources
  for each row
  execute function public.set_resources_approved_at();
