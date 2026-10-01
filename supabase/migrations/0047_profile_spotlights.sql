-- =====================================================================
-- ASN — Profile Spotlights ("What's New" on expert + partner profiles)
-- Run after 0046_referral_slug_revenue.sql.
--
-- Admins attach news / events / announcements to an expert or a partner.
-- They render in a "Spotlight" section on that profile in the MEMBER
-- portal, and publishing one posts a nudge into the network feed.
--
-- Two parts:
--   1. profile_spotlights — the new content records (expert OR vendor owned).
--   2. Partner authorship on expert_posts — so a partner spotlight can post
--      to the (previously expert-only) network feed. Existing rows are all
--      expert-authored, so the new check constraint holds for them.
-- =====================================================================

-- ---- 1. profile_spotlights ------------------------------------------
do $$ begin
  create type spotlight_kind as enum ('update', 'event', 'news', 'feature');
exception when duplicate_object then null; end $$;

create table if not exists public.profile_spotlights (
  id            uuid primary key default gen_random_uuid(),
  -- Exactly ONE owner (mirrors referral_codes' one-owner pattern).
  expert_id     uuid references public.experts(id) on delete cascade,
  vendor_id     uuid references public.vendors(id) on delete cascade,
  kind          spotlight_kind not null default 'update',
  title         text not null check (length(title) between 3 and 160),
  body          text not null check (length(body) between 3 and 2000),
  link_url      text check (link_url is null or length(link_url) <= 500),
  link_label    text check (link_label is null or length(link_label) <= 60),
  image_url     text check (image_url is null or length(image_url) <= 500),
  event_date    date,                     -- optional, for kind = 'event'
  is_published  boolean not null default false,
  posted_to_feed boolean not null default false,  -- so publish only posts once
  created_by    uuid references public.admin_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  constraint spotlight_one_owner check (num_nonnulls(expert_id, vendor_id) = 1)
);

create index if not exists profile_spotlights_expert_idx
  on public.profile_spotlights (expert_id, is_published, published_at desc);
create index if not exists profile_spotlights_vendor_idx
  on public.profile_spotlights (vendor_id, is_published, published_at desc);

drop trigger if exists profile_spotlights_updated_at on public.profile_spotlights;
create trigger profile_spotlights_updated_at
  before update on public.profile_spotlights
  for each row execute function public.set_updated_at();

alter table public.profile_spotlights enable row level security;
grant all on public.profile_spotlights to service_role;
-- Reads happen through service-role guarded routes (member profile API),
-- so no anon/authenticated policy is needed — same as offers/resources.

-- ---- 2. Partner authorship on the network feed ----------------------
-- The feed (expert_posts) was expert-only. Allow a vendor (partner) author
-- too so partner spotlights can post a feed nudge.
alter table public.expert_posts
  add column if not exists vendor_id uuid references public.vendors(id) on delete cascade;

-- Allow expert_id to be null (a partner-authored post has vendor_id instead).
alter table public.expert_posts alter column expert_id drop not null;

-- Exactly one author. Existing rows (all expert-authored) satisfy this.
alter table public.expert_posts
  drop constraint if exists expert_posts_one_author;
alter table public.expert_posts
  add constraint expert_posts_one_author check (num_nonnulls(expert_id, vendor_id) = 1);

create index if not exists expert_posts_vendor_idx on public.expert_posts (vendor_id);

notify pgrst, 'reload schema';
