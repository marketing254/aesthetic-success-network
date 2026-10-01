-- =====================================================================
-- ASN — Job board phase 2: applications, free job-seeker accounts,
--       and banner posts.
-- Run AFTER 0062_job_board_rls_hardening.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- WHAT CHANGED AND WHY (this reverses part of the phase-1 spec, on
-- purpose — see the 1 Sep huddle):
--
--   Phase 1 said "applications go straight to the practice, we do not
--   sit in the middle", and listed candidate accounts + resume uploads
--   as explicitly NOT in scope. That has been overturned by the product
--   owner for one reason: an applicant who mailtos the practice is a
--   visitor we never see again. Requiring a FREE account before applying
--   converts that anonymous traffic into a contactable list, which is
--   the whole marketing argument for the board.
--
--   Browsing stays public and applying stays free. The paywall did not
--   move — a job seeker is never asked for $49.
--
-- THREE THINGS THIS FILE ADDS:
--   1. members.account_type — the discriminator that keeps a free
--      applicant out of every paid member surface. Read §1, it is the
--      load-bearing part of this migration.
--   2. job_applications — the stored application, its CV, and the
--      status the practice sets on it.
--   3. job_posts.post_format + banner columns — the "upload a banner
--      instead of typing a description" path.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. members.account_type — the free tier discriminator
--
-- Job seekers reuse public.members rather than getting their own table.
-- That was a deliberate product call, and it has one sharp edge that
-- this column exists to blunt:
--
--   requireMember() in src/lib/auth/guards.ts admits any row with
--   status = 'active'. A job seeker MUST be status='active' for the
--   OTP login to work at all. Without a second discriminator, every
--   free applicant would satisfy the member gate the moment they
--   registered.
--
-- So: account_type is checked in the guards alongside status, and the
-- admin member lists/counts filter on it. subscription_status stays
-- null for job seekers, so requirePaidMember() already rejects them
-- (402) — this column closes the *unpaid-but-active* member surfaces
-- that requirePaidMember doesn't cover.
--
-- Default 'member' means every existing row keeps its current meaning
-- and no existing query changes behaviour on day one.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_account_type') then
    create type member_account_type as enum ('member', 'job_seeker');
  end if;
end$$;

alter table public.members
  add column if not exists account_type member_account_type not null default 'member';

-- Job seekers will outnumber paying members quickly. Every admin member
-- list and count now filters on this, so it needs to be indexed.
create index if not exists members_account_type_idx
  on public.members (account_type, created_at desc);

-- Partial index for the admin "Job seekers" page, which only ever wants
-- one side of the split.
create index if not exists members_job_seekers_idx
  on public.members (created_at desc)
  where account_type = 'job_seeker';

-- What kind of role the job seeker is after. Uses the same job_role enum
-- as the posts, so "show me everyone looking for an injector job" is a
-- filter and not a text search.
--
-- Nullable and only ever set on job_seeker rows. Kept separate from
-- members.practice_role, which means something different on a paying
-- member (their job at their own practice, not the job they want).
alter table public.members
  add column if not exists job_role_interest job_role;

create index if not exists members_job_role_interest_idx
  on public.members (job_role_interest)
  where account_type = 'job_seeker';

comment on column public.members.account_type is
  'member = paying/paid-tier account. job_seeker = free account created to apply for a job; never has a subscription and must never pass a member-only gate.';

-- ---------------------------------------------------------------------
-- auth_audit.user_type — widen the vocabulary
--
-- 0002 defined this as check (user_type in ('vendor','member','admin')).
-- The expert portal has been writing 'expert' since it shipped, and the
-- job-seeker routes added here write 'job_seeker'.
--
-- Every one of those inserts is wrapped in a best-effort try/catch, so
-- the constraint violation is swallowed and the audit row is simply
-- never written. That is the worst failure mode an audit trail can
-- have: it looks like it is working and it is quietly dropping the
-- events you would most want during an incident. Widening the check
-- fixes the expert rows too, which is a pre-existing bug this migration
-- happens to be the right place to close.
-- ---------------------------------------------------------------------
alter table public.auth_audit
  drop constraint if exists auth_audit_user_type_check;

alter table public.auth_audit
  add constraint auth_audit_user_type_check
  check (user_type in ('vendor', 'member', 'admin', 'expert', 'job_seeker'));

-- =====================================================================
-- 2. job_posts — banner posts
--
-- A member can now post one of two ways:
--
--   'detailed' — the original form. Long rich-text description.
--   'banner'   — they generate a graphic (ChatGPT or anything else),
--                upload it, and fill in a short summary instead of the
--                long description.
--
-- THE SEO RULE THIS ENCODES: `description` stays NOT NULL with the same
-- 30-character floor for BOTH formats. That is not an oversight, it is
-- the point. An image carries no text Google can read, so a banner-only
-- post would be invisible to search and to the JobPosting structured
-- data — which is the single highest-value thing on the public page.
-- The banner replaces the *long* description, never the text itself.
--
-- Pay range also stays required for banner posts. It is the board's
-- clearest differentiator and it is enforced in the schema precisely so
-- that no new posting path can quietly drop it.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_post_format') then
    create type job_post_format as enum ('detailed', 'banner');
  end if;
end$$;

alter table public.job_posts
  add column if not exists post_format job_post_format not null default 'detailed',
  -- Storage object path in the public `job-banners` bucket, e.g.
  -- {member_id}/{job_post_id}.webp. Path only — never a full URL, so
  -- the storage origin can change without a data migration.
  add column if not exists banner_path text,
  -- Alt text is required for a banner post. Two reasons, both real:
  -- a screen reader user gets nothing from the image otherwise, and it
  -- is one more piece of indexable text on a page whose main content is
  -- a picture.
  add column if not exists banner_alt text,
  -- Denormalised counter, trigger-maintained, same pattern as
  -- view_count. The member's "my posts" list and the admin queue both
  -- want it and neither should aggregate job_applications to get it.
  add column if not exists application_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_banner_path_len'
  ) then
    alter table public.job_posts
      add constraint job_posts_banner_path_len
      check (banner_path is null or char_length(banner_path) between 3 and 400);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_banner_alt_len'
  ) then
    alter table public.job_posts
      add constraint job_posts_banner_alt_len
      check (banner_alt is null or char_length(banner_alt) between 5 and 300);
  end if;

  -- A banner post without a banner is just a worse detailed post, and it
  -- would render an empty frame on a public page carrying our name.
  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_banner_needs_image'
  ) then
    alter table public.job_posts
      add constraint job_posts_banner_needs_image
      check (post_format <> 'banner' or (banner_path is not null and banner_alt is not null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_application_count_nonneg'
  ) then
    alter table public.job_posts
      add constraint job_posts_application_count_nonneg
      check (application_count >= 0);
  end if;
end$$;

-- =====================================================================
-- 3. job_applications
--
-- One row per (job post, applicant). The applicant must hold a free
-- account, so applicant_member_id is NOT NULL — there is no anonymous
-- application path any more, which is the entire point of the change.
--
-- The contact fields are copied onto the row rather than joined from
-- members. Deliberate: an applicant may use a different phone or a
-- different reply-to for one specific application, and the practice
-- needs to see what was actually sent to them, not what the profile
-- says today.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_application_status') then
    create type job_application_status as enum (
      'submitted',      -- default; set on insert
      'viewed',         -- practice opened it
      'shortlisted',
      'not_selected',
      'hired'
    );
  end if;
end$$;

create table if not exists public.job_applications (
  id                  uuid primary key default gen_random_uuid(),
  job_post_id         uuid not null references public.job_posts(id) on delete cascade,
  applicant_member_id uuid not null references public.members(id) on delete cascade,

  -- What was actually sent to the practice.
  full_name           text not null check (char_length(full_name) between 2 and 160),
  email               text not null check (char_length(email) between 3 and 254),
  phone               text check (phone is null or char_length(phone) between 5 and 40),
  message             text check (message is null or char_length(message) <= 4000),

  -- CV lives in the PRIVATE `job-applications` bucket. Path only; the
  -- practice and the admin console get time-limited signed URLs. A CV
  -- is the most sensitive thing this application stores — it is never
  -- served from a public bucket and `anon` has no grant on this table.
  cv_path             text check (cv_path is null or char_length(cv_path) between 3 and 400),
  cv_filename         text check (cv_filename is null or char_length(cv_filename) <= 255),
  cv_size_bytes       integer check (cv_size_bytes is null or cv_size_bytes between 1 and 10485760),

  -- The practice sets this from their own post's applicant list. It
  -- defaults to 'submitted' and stays there until they touch it, which
  -- is honest: the applicant sees "Submitted", not a fake progression.
  status              job_application_status not null default 'submitted',
  status_changed_at   timestamptz,
  -- Which member moved it. Nullable because 'submitted' was never "set"
  -- by anyone, and because a member row can be deleted.
  status_changed_by   uuid references public.members(id) on delete set null,

  -- Delivery of the application email to the practice. Recorded so a
  -- "they never got my application" support question is answerable, and
  -- so a failed send can be retried without guessing.
  delivered_at        timestamptz,
  delivery_error      text check (delivery_error is null or char_length(delivery_error) <= 500),
  copy_to_applicant   boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One application per person per job. Stops a double-submitted form
  -- mailing the practice twice, and stops a frustrated applicant
  -- re-applying daily. Editing an existing application is the intended
  -- path, not a second row.
  constraint job_applications_one_per_member unique (job_post_id, applicant_member_id),

  -- Anything past 'submitted' was set by a human, so record when.
  constraint job_applications_status_change_stamped check (
    status = 'submitted' or status_changed_at is not null
  )
);

-- The practice's applicant list for one post, newest first.
create index if not exists job_applications_post_idx
  on public.job_applications (job_post_id, created_at desc);

-- "My applications" for the job seeker.
create index if not exists job_applications_applicant_idx
  on public.job_applications (applicant_member_id, created_at desc);

-- Retry sweep for applications whose email to the practice never landed.
create index if not exists job_applications_undelivered_idx
  on public.job_applications (created_at)
  where delivered_at is null;

create or replace function public.job_applications_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_job_applications_updated_at on public.job_applications;
create trigger trg_job_applications_updated_at
  before update on public.job_applications
  for each row execute function public.job_applications_set_updated_at();

-- Keep job_posts.application_count in step, same approach as view_count.
create or replace function public.bump_job_post_application_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.job_posts
      set application_count = application_count + 1
      where id = new.job_post_id;
  elsif tg_op = 'DELETE' then
    update public.job_posts
      set application_count = greatest(application_count - 1, 0)
      where id = old.job_post_id;
  end if;
  return null;
end$$;

drop trigger if exists trg_job_applications_count on public.job_applications;
create trigger trg_job_applications_count
  after insert or delete on public.job_applications
  for each row execute function public.bump_job_post_application_count();

-- =====================================================================
-- 4. Row Level Security
--
-- Unlike job_posts, NOTHING here is public. anon gets no grant at all.
-- This table holds names, phone numbers and CV paths — a table-wide
-- read for anon would be a straightforward personal-data leak.
--
-- Two read paths only:
--   - the applicant reads their own applications
--   - the member who posted the job reads applications on that job
--
-- No client INSERT/UPDATE/DELETE, matching the job_posts design: every
-- write goes through a service-role API route that re-runs validation.
-- =====================================================================

alter table public.job_applications enable row level security;

drop policy if exists "job_applications_applicant_read_own" on public.job_applications;
drop policy if exists "job_applications_poster_read_own_post" on public.job_applications;

create policy "job_applications_applicant_read_own"
  on public.job_applications
  for select
  to authenticated
  using (
    applicant_member_id in (
      select id from public.members where auth_user_id = auth.uid()
    )
  );

create policy "job_applications_poster_read_own_post"
  on public.job_applications
  for select
  to authenticated
  using (
    job_post_id in (
      select jp.id
      from public.job_posts jp
      join public.members m on m.id = jp.member_id
      where m.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Backstop trigger, same reasoning as job_posts_guard_privileged_columns:
-- if a future migration or a hurried dashboard click adds a permissive
-- UPDATE policy for the client roles, this still refuses to let them
-- rewrite what was submitted, forge a delivery record, or reassign an
-- application to a different post or applicant.
--
-- Note `status` is NOT guarded — the posting member setting the status
-- is a legitimate action. It still has no UPDATE grant today, so it
-- goes through the API route regardless; this trigger only decides what
-- would remain forbidden if that ever changed.
-- ---------------------------------------------------------------------
create or replace function public.job_applications_guard_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.job_post_id         is distinct from old.job_post_id
    or new.applicant_member_id is distinct from old.applicant_member_id
    or new.full_name           is distinct from old.full_name
    or new.email               is distinct from old.email
    or new.phone               is distinct from old.phone
    or new.message             is distinct from old.message
    or new.cv_path             is distinct from old.cv_path
    or new.cv_filename         is distinct from old.cv_filename
    or new.cv_size_bytes       is distinct from old.cv_size_bytes
    or new.delivered_at        is distinct from old.delivered_at
    or new.delivery_error      is distinct from old.delivery_error
    or new.created_at          is distinct from old.created_at
    then
      raise exception
        'job_applications: % may not rewrite a submitted application. Use the server API.',
        current_user
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_job_applications_guard_privileged on public.job_applications;
create trigger trg_job_applications_guard_privileged
  before update on public.job_applications
  for each row execute function public.job_applications_guard_privileged_columns();

-- ---------------------------------------------------------------------
-- Extend the existing job_posts guard to cover the new metric column.
-- Re-stated in full (create or replace) because that is the only way to
-- amend it; the added line is `application_count`.
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
    or new.application_count      is distinct from old.application_count
    then
      raise exception
        'job_posts: % may not change approval, promotion or metric columns. Use the server API.',
        current_user
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end$$;

-- =====================================================================
-- 5. GRANTs
--
-- Project has "Auto-expose new tables" OFF, so these are required for
-- PostgREST to see the table at all.
--
-- anon: nothing. Not a narrowed column list — nothing. There is no
-- public view of an application.
-- =====================================================================

revoke all on public.job_applications from anon, authenticated;
grant select on public.job_applications to authenticated;
-- No INSERT/UPDATE/DELETE for either role. On purpose.

-- The public board reads job_posts as anon. Banner posts are shown on
-- that board, so the two new *public* columns join the anon grant —
-- both are already rendered on /jobs/[slug], so this leaks nothing the
-- page doesn't. application_count is deliberately NOT here: how many
-- people applied is the member's business and a competitor's shortcut.
grant select (
  id, slug, practice_name, role, role_other, employment_type, location,
  workplace, pay_min, pay_max, pay_unit, description, requirements,
  start_date, start_flexible, status, approved_at, expires_at, filled_at,
  view_count, promoted_facebook_at, promoted_email_at, created_at, updated_at,
  post_format, banner_path, banner_alt
) on public.job_posts to anon;

-- =====================================================================
-- 6. Storage buckets
-- =====================================================================

-- CVs. PRIVATE — public = false. There are no storage policies for
-- anon or authenticated below, which means no client can read or write
-- this bucket directly at all. Uploads go through the apply route and
-- reads are time-limited signed URLs minted server-side for the
-- posting member and admins only.
insert into storage.buckets (id, name, public)
values ('job-applications', 'job-applications', false)
on conflict (id) do update set public = excluded.public;

-- Job banners. PUBLIC read — they are the visible content of a public
-- job ad, same category as a vendor logo. Writes still go through the
-- server route (which checks the image type and size), so there is no
-- client write policy here either.
insert into storage.buckets (id, name, public)
values ('job-banners', 'job-banners', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "job banners public read" on storage.objects;
create policy "job banners public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'job-banners');

-- Deliberately absent: any policy granting anon or authenticated access
-- to bucket_id = 'job-applications'. Do not add one. The service role
-- bypasses RLS and is the only intended reader.

notify pgrst, 'reload schema';
