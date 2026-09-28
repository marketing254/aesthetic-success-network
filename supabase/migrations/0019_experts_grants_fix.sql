-- =====================================================================
-- ASN — Hotfix for missing GRANTs on the experts table
-- Run AFTER 0018_experts_portal.sql.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
--
-- WHY THIS EXISTS:
-- 0018 enabled RLS on `experts` and added row-level policies, but I
-- forgot to GRANT table privileges to the `authenticated` Postgres role.
-- This project has "Automatically expose new tables" turned OFF (see
-- 0004_grants.sql), so without an explicit GRANT, the session-bound
-- Supabase client gets "permission denied for table experts" before the
-- RLS policy ever runs — which is exactly the error the middleware
-- expert gate has been hitting:
--
--   [middleware:expert] expert lookup { readErr: 'permission denied for table experts' }
--
-- After this migration the GRANT lets the user's session-bound query
-- reach the table; RLS (auth.uid() = auth_user_id) still filters it to
-- only their own row.
-- =====================================================================

-- SELECT so the middleware can find the row by auth_user_id.
-- UPDATE so an expert can edit their own profile (filtered by RLS to
-- their own row only — see experts_self_update policy in 0018).
grant select, update on public.experts to authenticated;

-- Supporting views — keep restricted to service_role (admin only).
-- experts_recent and expert_counts are not granted to authenticated;
-- admin code reads them through getSupabaseAdmin() which bypasses both
-- GRANT and RLS.

-- Force PostgREST to refresh its schema cache so the new grants are
-- visible immediately (otherwise it can take up to a minute).
notify pgrst, 'reload schema';
