-- =====================================================================
-- ASN — Job board RLS hardening
-- Run AFTER 0061_job_board.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- WHO NEEDS THIS FILE
--
-- 0058 has already been corrected in place, so a database that has never
-- had 0058 applied gets the hardened rules from 0058 alone and this file
-- is a harmless no-op. Run it anyway — it is idempotent, and it is the
-- only thing that fixes a database where the ORIGINAL 0058 was applied.
--
-- WHAT WAS WRONG
--
-- The original 0058 shipped this policy plus `grant ... update ... to
-- authenticated`:
--
--     create policy "job_posts_member_modify_own"
--       on public.job_posts for update to authenticated
--       using  (member_id in (select id from public.members
--                             where auth_user_id = auth.uid()))
--       with check (same);
--
-- It was row-scoped but not COLUMN-scoped, and its comment claimed the
-- approval columns were "guarded by the API, which is the only thing
-- holding a service-role key". That was not true: members hold a
-- Supabase session and the anon key is public by definition, so a member
-- could PATCH their own row straight through PostgREST:
--
--     PATCH /rest/v1/job_posts?id=eq.<their-own-post>
--     { "status": "live",
--       "approved_at": "2026-09-01T00:00:00Z",
--       "expires_at":  "2026-10-01T00:00:00Z" }
--
-- The job_posts_live_needs_approval CHECK passes, because they supplied
-- approved_at and expires_at themselves. The post is now public with no
-- human having read it — which defeats the spec decision marked "Every
-- post is reviewed before it goes live … This is not optional." The same
-- write also let a member fake promoted_facebook_at / promoted_email_at
-- (the "Promoted" chip on the board) and inflate view_count (the one
-- number we ask a member to believe).
--
-- WHAT THIS FIXES IT WITH
--
--   1. Drop the UPDATE policy. Nothing in the app used it — every member
--      write already goes through /api/member/jobs/[id], which holds the
--      service-role key and re-runs validateJobInput().
--   2. Revoke UPDATE from anon + authenticated entirely.
--   3. Add a BEFORE UPDATE trigger that refuses approval / promotion /
--      metric column changes from the anon + authenticated roles, so the
--      hole cannot be reopened by re-adding a policy.
--   4. Narrow the anon SELECT grant to the public columns, so the board
--      cannot be scraped for every hiring practice's inbox in one call.
--
-- SAFE TO RE-RUN. No data is touched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 + 2. Remove the write path
-- ---------------------------------------------------------------------
drop policy if exists "job_posts_member_modify_own" on public.job_posts;

revoke update on public.job_posts from authenticated;
revoke update on public.job_posts from anon;

-- ---------------------------------------------------------------------
-- 3. Backstop trigger
--
-- `current_user` is the Postgres role PostgREST switched into for the
-- request: `anon` for the public key, `authenticated` for a logged-in
-- user's JWT, `service_role` for our API routes. Migrations run as
-- `postgres` / `supabase_admin` and are unaffected.
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

-- ---------------------------------------------------------------------
-- 4. Narrow the anon read grant to the public columns
--
-- Every column on this list is already rendered on /jobs/[slug], so the
-- grant leaks nothing the page doesn't. apply_email / apply_url are off
-- it because the page shows them one job at a time, while a table-wide
-- grant would let anyone bulk-harvest the lot in a single request.
-- ---------------------------------------------------------------------
revoke all on public.job_posts from anon;

grant select (
  id, slug, practice_name, role, role_other, employment_type, location,
  workplace, pay_min, pay_max, pay_unit, description, requirements,
  start_date, start_flexible, status, approved_at, expires_at, filled_at,
  view_count, promoted_facebook_at, promoted_email_at, created_at, updated_at
) on public.job_posts to anon;

-- `authenticated` keeps whole-row SELECT: RLS still limits it to live
-- rows plus the member's own, and a member needs rejection_reason to
-- read why their own post came back.
grant select on public.job_posts to authenticated;

notify pgrst, 'reload schema';
