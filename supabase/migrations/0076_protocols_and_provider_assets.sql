-- =====================================================================
-- ASN: Protocols (tags) + provider-only downloads (social packs, share
-- kits, launch packs) + company-page media.
-- Run AFTER 0075_auth_audit_user_types.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Additive and idempotent. No existing data changes.
--
-- Protocols reuse the `resources` table (one row per file, grouped by
-- topic_slug, owned via originating_expert_id). Members see a Protocol only
-- when is_published = true AND submission_status = 'approved'; the expert
-- sees all of their own straight away (portal API, service role).
-- =====================================================================

-- 1. Tags on each Protocol (Lester's "Med spa, Surgical practice, ...").
alter table public.resources add column if not exists tags text[] not null default '{}';

-- 2. Files that belong to an expert or company but are NOT member content:
--    audience 'owner'        -> only that expert / company sees them in
--                               their own portal (social pack, share kit,
--                               kit overview, launch pack)
--    audience 'company_page' -> shown on the public company page once the
--                               company is live (partner video, PDFs)
create table if not exists public.provider_assets (
  id            uuid primary key default gen_random_uuid(),
  expert_id     uuid references public.experts (id) on delete cascade,
  vendor_id     uuid references public.vendors (id) on delete cascade,
  audience      text not null default 'owner' check (audience in ('owner', 'company_page')),
  group_slug    text not null,
  group_title   text not null,
  title         text not null,
  kind          text not null check (kind in ('image', 'video', 'pdf', 'audio', 'other')),
  storage_path  text not null,
  mime_type     text,
  file_size_bytes bigint,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint provider_assets_owner_check check (expert_id is not null or vendor_id is not null),
  constraint provider_assets_unique unique (group_slug, storage_path)
);
create index if not exists provider_assets_expert_idx on public.provider_assets (expert_id, group_slug, position);
create index if not exists provider_assets_vendor_idx on public.provider_assets (vendor_id, audience, group_slug, position);

-- Service role only (portal APIs check ownership); no browser access.
alter table public.provider_assets enable row level security;
revoke all on public.provider_assets from anon, authenticated;

-- 3. Private bucket for those files (portals hand out short-lived signed links).
insert into storage.buckets (id, name, public, file_size_limit)
values ('provider-assets', 'provider-assets', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = 524288000;

-- Check:
--   select column_name from information_schema.columns where table_name = 'resources' and column_name = 'tags';
--   select count(*) from public.provider_assets;
--   select id, public, file_size_limit from storage.buckets where id = 'provider-assets';
