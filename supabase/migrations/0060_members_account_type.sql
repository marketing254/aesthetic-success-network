-- =====================================================================
-- ASN — members.account_type (lite)
-- Run AFTER 0059. Replaces the job-board files (0060 to 0064, now in
-- supabase/migrations/later/job-board/) for phase one.
--
-- The member portal guards (src/lib/auth/guards.ts) and the admin Members
-- and Overview pages read members.account_type on every request, and
-- 0067 pins it. The full job-board migration 0063 creates it; this file
-- creates ONLY that column and its enum, with the same definition, so
-- 0063 stays a no-op for this part when the job board is added later.
-- Idempotent.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_account_type') then
    create type member_account_type as enum ('member', 'job_seeker');
  end if;
end$$;

alter table public.members
  add column if not exists account_type member_account_type not null default 'member';

comment on column public.members.account_type is
  'member = paying/activated member. job_seeker = free job-board account (job board not enabled in phase one).';

create index if not exists members_account_type_idx
  on public.members (account_type);

notify pgrst, 'reload schema';
