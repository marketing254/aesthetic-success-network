-- =====================================================================
-- ASN — Schema grants (Phase 1)
-- Run this AFTER 0002_vendor_portal.sql and 0003_rls_policies.sql.
--
-- WHY THIS FILE EXISTS:
-- We unchecked "Automatically expose new tables" at project creation
-- (deliberate security choice — every new table requires conscious
-- exposure). With that off, new tables receive NO grants to the
-- anon/authenticated roles by default, so the PostgREST API layer
-- can't see them and returns PGRST205 ("Could not find the table").
--
-- This migration grants the minimum table-level privileges needed.
-- RLS policies (0003) layer on top to enforce row-level access.
-- =====================================================================

-- Roles need USAGE on the schema before they can touch anything in it.
grant usage on schema public to anon, authenticated, service_role;

-- =====================================================================
-- SERVICE ROLE
-- The service_role is used by our Next.js server-side API routes
-- (getSupabaseAdmin). It MUST be able to do everything — it's the
-- authority that performs trusted writes (inserts to audit logs,
-- vendor applications, etc.) and bypasses RLS by design.
--
-- Normally Supabase grants this automatically, but with "Automatically
-- expose new tables" off, even service_role is excluded. We grant
-- everything in one shot here. RLS doesn't apply to service_role so
-- this doesn't widen any row-level access.
-- =====================================================================
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future-proofing for service_role: any table/sequence/function created
-- later automatically gets full access for service_role.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

-- =====================================================================
-- WAITLIST
-- Notes:
--   * `waitlist_signups` GRANT INSERT to anon looks scary but RLS on the
--     table has NO insert policy, so the GRANT is dead unless overridden
--     by a future policy. The real insert path is the service-role API.
--   * `waitlist_signups_recent` is intentionally NOT granted to anyone —
--     it's a PII-rich admin view and the admin API reads it via the
--     service-role key (which bypasses RLS + GRANT entirely).
-- =====================================================================
grant insert on public.waitlist_signups to anon, authenticated;
grant select on public.waitlist_signups to authenticated;
grant select on public.waitlist_counts  to anon, authenticated;

-- =====================================================================
-- VENDOR APPLICATIONS (public can apply)
-- =====================================================================
grant insert on public.vendor_applications to anon, authenticated;
grant select on public.vendor_applications to authenticated;
grant update on public.vendor_applications to authenticated;

-- =====================================================================
-- VENDORS (anon reads approved+verified for the public directory)
-- =====================================================================
grant select               on public.vendors to anon, authenticated;
grant insert, update       on public.vendors to authenticated;

-- =====================================================================
-- CATALOG
-- =====================================================================
grant select                       on public.catalog_items to anon, authenticated;
grant insert, update, delete       on public.catalog_items to authenticated;

grant select                       on public.catalog_media to anon, authenticated;
grant insert, update, delete       on public.catalog_media to authenticated;

-- =====================================================================
-- OFFERS
-- =====================================================================
grant select                       on public.offers to anon, authenticated;
grant insert, update, delete       on public.offers to authenticated;

grant select                       on public.offer_media to anon, authenticated;
grant insert, update, delete       on public.offer_media to authenticated;

-- =====================================================================
-- REDEMPTIONS (authenticated only — vendor/member/admin via RLS)
-- =====================================================================
grant select, insert, update on public.redemptions to authenticated;

-- =====================================================================
-- MEMBERS (self via RLS; admin all via RLS)
-- =====================================================================
grant select, update on public.members to authenticated;

-- =====================================================================
-- ADMIN
--   Authenticated needs SELECT on admin_users so is_admin() can run.
--   Mutations are restricted by RLS to is_admin() = true.
-- =====================================================================
grant select                       on public.admin_users to authenticated;
grant insert, update, delete       on public.admin_users to authenticated;

-- =====================================================================
-- AUDIT LOGS
--   review_actions: authenticated SELECT/INSERT (RLS limits to admin)
--   auth_audit + email_events: SELECT for admin via RLS, INSERTS happen
--   server-side via service_role (which bypasses RLS).
-- =====================================================================
grant select, insert on public.review_actions to authenticated;
grant select         on public.auth_audit     to authenticated;
grant select         on public.email_events   to authenticated;

-- =====================================================================
-- Sequences — required for any INSERT that uses gen_random_uuid()
-- defaults or serial columns. gen_random_uuid() doesn't use sequences,
-- but we issue blanket grants here for future-proofing.
-- =====================================================================
grant usage, select on all sequences in schema public to anon, authenticated;

-- =====================================================================
-- Future-proofing: default privileges so that any tables/sequences
-- created later automatically get the same baseline. New tables still
-- need explicit per-table grants for non-default operations, but this
-- avoids the "I forgot to grant USAGE" footgun.
-- =====================================================================
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- =====================================================================
-- Force PostgREST to reload its schema cache so the grants are visible
-- to the Data API immediately (otherwise it caches for up to a minute).
-- =====================================================================
notify pgrst, 'reload schema';
