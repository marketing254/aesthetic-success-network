-- =====================================================================
-- ASN: let the sign-in audit log record experts and job seekers
-- Run AFTER 0074_company_plan_ladder_flat.sql.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Why: auth_audit.user_type only allowed ('vendor', 'member', 'admin'),
-- so every expert (and seeker) sign-in row (code sent, refused, verified)
-- was silently rejected by the check constraint. Expert sign-in problems
-- left no trail. Additive and idempotent; no data changes.
-- =====================================================================

alter table public.auth_audit drop constraint if exists auth_audit_user_type_check;
alter table public.auth_audit
  add constraint auth_audit_user_type_check
  check (user_type in ('vendor', 'member', 'admin', 'expert', 'seeker'));

-- Check: select user_type, count(*) from public.auth_audit group by 1;
