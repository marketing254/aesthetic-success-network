-- =====================================================================
-- ASN — Job board (phase 1)
-- Run AFTER 0060_job_board_reset.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- The product is the PROMOTION, not the board. That shapes the schema:
--   - job_posts        : the vacancy itself, plus its promotion state
--   - job_post_views   : one row per view, the only evidence we can give
--                        a member that posting here did anything
--
-- Two rules from the spec are enforced in the DB, not just the UI, so a
-- bad API call can't get around them:
--   1. Pay range is REQUIRED. pay_min/pay_max/pay_unit are all NOT NULL.
--   2. Nothing is public without a human approving it — `live` is only
--      reachable by an admin setting approved_at + reviewed_by.
--
-- Browsing is public and posting is members-only, so unlike the rest of
-- the schema this table grants SELECT to `anon` — but only for rows that
-- are actually live (see the RLS policy). Everything else goes through
-- service-role API routes.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMs
-- =====================================================================

-- draft -> pending_review -> live -> expired
--             |                |
--             v                v
--          rejected          filled
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum (
      'draft',
      'pending_review',
      'live',
      'rejected',
      'expired',
      'filled'
    );
  end if;
end$$;

-- Fixed list (ASN aesthetics roles, see ASN-SWAP-CANON.md §4). Free text
-- here would fragment the filters instantly, so the dropdown in the form
-- and this enum must stay in step — the TS mirror lives in
-- src/lib/jobs/constants.ts and JobRoleValue in src/lib/supabase/types.ts.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_role') then
    create type job_role as enum (
      'injector_rn_np',
      'physician_assistant',
      'aesthetician',
      'laser_technician',
      'medical_director',
      'practice_manager',
      'patient_coordinator',
      'front_desk',
      'marketing_coordinator',
      'other'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_employment_type') then
    create type job_employment_type as enum (
      'full_time',
      'part_time',
      'temporary',
      'contract'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_workplace') then
    create type job_workplace as enum ('onsite', 'hybrid', 'remote');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_pay_unit') then
    create type job_pay_unit as enum ('hour', 'day', 'year');
  end if;
end$$;

-- =====================================================================
-- job_posts
-- =====================================================================
create table if not exists public.job_posts (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null references public.members(id) on delete cascade,

  -- Public URL segment, e.g. nurse-injector-austin-tx-4f2a. Built once
  -- at insert and never changed, because changing it would break every
  -- link we promoted to the group and every URL Google has indexed.
  slug                  text not null unique check (char_length(slug) between 3 and 160),

  -- Content
  practice_name         text not null check (char_length(practice_name) between 2 and 160),
  role                  job_role not null,
  role_other            text check (role_other is null or char_length(role_other) <= 80),
  employment_type       job_employment_type not null,
  location              text not null check (char_length(location) between 2 and 160),
  workplace             job_workplace not null,

  -- Pay. Required, deliberately: most aesthetic job ads hide it and candidates
  -- hate it. A range is fine, "depends on experience" is not.
  pay_min               numeric(10, 2) not null check (pay_min >= 0),
  pay_max               numeric(10, 2) not null check (pay_max >= 0),
  pay_unit              job_pay_unit not null,

  description           text not null check (char_length(description) between 30 and 8000),
  requirements          text check (requirements is null or char_length(requirements) <= 4000),

  -- Applications go STRAIGHT to the practice. We do not sit in the middle.
  apply_email           text check (apply_email is null or char_length(apply_email) <= 254),
  apply_url             text check (apply_url is null or char_length(apply_url) <= 500),

  start_date            date,
  start_flexible        boolean not null default false,

  -- State
  status                job_status not null default 'draft',
  submitted_at          timestamptz,
  approved_at           timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid references public.admin_users(id) on delete set null,
  -- Never reject silently: the API requires this before it will set
  -- status = 'rejected', and the poster gets it by email.
  rejection_reason      text check (rejection_reason is null or char_length(rejection_reason) <= 1000),

  -- Auto expire 30 days after approval. Set when the post goes live.
  expires_at            timestamptz,
  expiry_warning_sent_at timestamptz,   -- day-25 "renew in one click" email
  renewed_at            timestamptz,
  renewal_count         integer not null default 0 check (renewal_count >= 0),
  filled_at             timestamptz,

  -- Promotion queue. Phase 1 posts to the group + email BY HAND, so
  -- these are flags an admin ticks, not automation hooks. The dev work
  -- is the queue; do not build the Facebook API integration yet.
  promoted_facebook_at  timestamptz,
  promoted_email_at     timestamptz,

  -- Denormalised view counter, kept in step by a trigger on
  -- job_post_views so the board can sort/report without aggregating.
  view_count            integer not null default 0 check (view_count >= 0),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint job_posts_pay_range check (pay_max >= pay_min),
  -- "How to apply" is required, but either channel satisfies it.
  constraint job_posts_apply_channel check (
    apply_email is not null or apply_url is not null
  ),
  -- A live post must have been approved by a human. This is the publish
  -- gate expressed in the schema so no code path can skip it.
  constraint job_posts_live_needs_approval check (
    status <> 'live' or (approved_at is not null and expires_at is not null)
  ),
  constraint job_posts_rejected_needs_reason check (
    status <> 'rejected' or rejection_reason is not null
  )
);

-- The public board: newest live jobs first, filtered by role/type.
create index if not exists job_posts_board_idx
  on public.job_posts (status, approved_at desc)
  where status = 'live';

create index if not exists job_posts_role_idx
  on public.job_posts (role, status);

create index if not exists job_posts_member_idx
  on public.job_posts (member_id, created_at desc);

-- Admin queue.
create index if not exists job_posts_pending_idx
  on public.job_posts (submitted_at)
  where status = 'pending_review';

-- Cron sweep: expiring + expired.
create index if not exists job_posts_expiry_idx
  on public.job_posts (expires_at)
  where status = 'live';

create or replace function public.job_posts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_job_posts_updated_at on public.job_posts;
create trigger trg_job_posts_updated_at
  before update on public.job_posts
  for each row execute function public.job_posts_set_updated_at();

-- =====================================================================
-- job_post_views
--
-- "Views per post matters more than it sounds. It is the only evidence
-- we can give a member that posting here did anything." So we keep the
-- raw rows, not just the counter — it lets us answer "how many views
-- came the week the team posted it to the group?" later.
--
-- viewer_hash is a salted hash of IP + user agent, never the IP itself.
-- It exists only to collapse refreshes within a day, and a unique index
-- on (job_post_id, viewer_hash, viewed_on) is what actually enforces it.
-- =====================================================================
create table if not exists public.job_post_views (
  id            uuid primary key default gen_random_uuid(),
  job_post_id   uuid not null references public.job_posts(id) on delete cascade,
  viewer_hash   text not null check (char_length(viewer_hash) <= 64),
  viewed_on     date not null default (now() at time zone 'utc')::date,
  referrer_kind text check (referrer_kind is null or char_length(referrer_kind) <= 40),
  created_at    timestamptz not null default now()
);

create unique index if not exists job_post_views_dedupe_idx
  on public.job_post_views (job_post_id, viewer_hash, viewed_on);

create index if not exists job_post_views_post_idx
  on public.job_post_views (job_post_id, viewed_on);

create or replace function public.bump_job_post_view_count()
returns trigger language plpgsql as $$
begin
  update public.job_posts
    set view_count = view_count + 1
    where id = new.job_post_id;
  return new;
end$$;

drop trigger if exists trg_job_post_views_count on public.job_post_views;
create trigger trg_job_post_views_count
  after insert on public.job_post_views
  for each row execute function public.bump_job_post_view_count();

-- =====================================================================
-- Row Level Security
--
-- This is the one table in the schema anon can read. Browsing is public
-- by design — job seekers will never pay to look for a job, and a board
-- with no candidates gets no applicants, which kills the feature. The
-- policy is narrow: live rows only, nothing in draft/pending/rejected.
--
-- THE RULE THIS SECTION EXISTS TO PROTECT: nothing appears publicly
-- without a human approving it. That is a spec decision marked "not
-- optional", so it is held in THREE places, not one:
--
--   1. No UPDATE grant to anon or authenticated at all (below). Every
--      member write goes through a service-role API route, so a member
--      holding the public anon key and their own JWT has no PostgREST
--      write path to their row.
--   2. A BEFORE UPDATE trigger that refuses to let the anon/authenticated
--      roles touch the approval, promotion or metric columns even if
--      somebody re-adds a permissive UPDATE policy later.
--   3. The job_posts_live_needs_approval CHECK constraint, which stops
--      a row reaching `live` without approved_at + expires_at.
--
-- An earlier draft of this file granted `update` on the whole table to
-- `authenticated` with a row-level-only policy. That let a member PATCH
-- their own row directly through PostgREST and set status='live',
-- approved_at=now(), expires_at=now()+30d — self-publishing straight
-- past the review queue, and also faking promoted_* and view_count.
-- Do not reintroduce it.
-- =====================================================================
alter table public.job_posts enable row level security;
alter table public.job_post_views enable row level security;

drop policy if exists "job_posts_public_read_live" on public.job_posts;
drop policy if exists "job_posts_member_read_own" on public.job_posts;
drop policy if exists "job_posts_member_modify_own" on public.job_posts;
drop policy if exists "job_post_views_no_client_access" on public.job_post_views;

-- PUBLIC read of live jobs — anon and authenticated alike.
create policy "job_posts_public_read_live"
  on public.job_posts
  for select
  to anon, authenticated
  using (status = 'live');

-- A member can always see their own posts, in any state, so they can
-- track something that's pending or was rejected.
create policy "job_posts_member_read_own"
  on public.job_posts
  for select
  to authenticated
  using (
    member_id in (select id from public.members where auth_user_id = auth.uid())
  );

-- NOTE: there is deliberately NO member UPDATE policy. See the block
-- above. Members change their posts through /api/member/jobs/[id],
-- which holds the service-role key and re-runs validateJobInput().

-- ---------------------------------------------------------------------
-- Backstop: guard the privileged columns at the row level
--
-- Belt and braces for point 2 above. If a future migration or a hurried
-- dashboard click re-adds an UPDATE policy for the client roles, this
-- trigger still refuses to let them move a post to live, back-date an
-- approval, tick a promotion flag or inflate a view count.
--
-- `current_user` is the Postgres role PostgREST switched into for the
-- request: `anon` for the public key, `authenticated` for a logged-in
-- user's JWT, and `service_role` for our API routes. Migrations run as
-- `postgres`/`supabase_admin`, so they are unaffected.
-- ---------------------------------------------------------------------
create or replace function public.job_posts_guard_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status                 is distinct from old.status
    or new.member_id              is distinct from old.member_id
    or new.slug                   is distinct from old.slug
    or new.approved_at            is distinct from old.approved_at
    or new.reviewed_at            is distinct from old.reviewed_at
    or new.reviewed_by            is distinct from old.reviewed_by
    or new.rejection_reason       is distinct from old.rejection_reason
    or new.expires_at             is distinct from old.expires_at
    or new.expiry_warning_sent_at is distinct from old.expiry_warning_sent_at
    or new.renewal_count          is distinct from old.renewal_count
    or new.promoted_facebook_at   is distinct from old.promoted_facebook_at
    or new.promoted_email_at      is distinct from old.promoted_email_at
    or new.view_count             is distinct from old.view_count
    then
      raise exception
        'job_posts: % may not change approval, promotion or metric columns. Use the server API.',
        current_user
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_job_posts_guard_privileged on public.job_posts;
create trigger trg_job_posts_guard_privileged
  before update on public.job_posts
  for each row execute function public.job_posts_guard_privileged_columns();

-- Views are written by the service-role route only. No client touches
-- this table directly, so RLS stays on with no permissive policy.

-- =====================================================================
-- GRANTs (project has "Auto-expose new tables" OFF)
--
-- anon gets SELECT on the PUBLIC columns only. Everything on this list
-- is already rendered on /jobs/[slug], so the grant leaks nothing the
-- page doesn't. What is deliberately NOT on it:
--
--   apply_email, apply_url   — the page renders these as a mailto/link
--                              for one job at a time; a table-wide grant
--                              would let anyone bulk-harvest every
--                              hiring practice's inbox in one request.
--   member_id                — links a public ad to an internal record.
--   rejection_reason,        — moderation trail. Never public, even
--   reviewed_*, submitted_at   though RLS already hides non-live rows.
--
-- `authenticated` keeps whole-row SELECT: RLS still limits it to live
-- rows plus the member's own, and a member needs rejection_reason to
-- see why their own post came back.
-- =====================================================================
revoke all on public.job_posts from anon, authenticated;

grant select (
  id, slug, practice_name, role, role_other, employment_type, location,
  workplace, pay_min, pay_max, pay_unit, description, requirements,
  start_date, start_flexible, status, approved_at, expires_at, filled_at,
  view_count, promoted_facebook_at, promoted_email_at, created_at, updated_at
) on public.job_posts to anon;

grant select on public.job_posts to authenticated;
-- No UPDATE, no INSERT, no DELETE for either role. On purpose.

notify pgrst, 'reload schema';
