-- =====================================================================
-- ASN — Row Level Security policies (Phase 1)
-- Run this AFTER 0002_vendor_portal.sql.
--
-- Pattern:
--   * service_role  → bypasses RLS (used by Next.js server-side admin code)
--   * anon          → public surfaces only (read approved listings, insert
--                     waitlist + vendor application, nothing else)
--   * authenticated → vendors / members / admins via Supabase Auth.
--                     Helper functions resolve the current user's role.
-- =====================================================================

-- =====================================================================
-- HELPER FUNCTIONS
-- Run with security definer so they can read tables that the calling
-- role is otherwise locked out of. Each is STABLE so Postgres caches the
-- result within a query.
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.admin_users
     where auth_user_id = auth.uid()
       and active = true
  );
$$;

create or replace function public.current_vendor_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
    from public.vendors
   where auth_user_id = auth.uid()
     and status = 'approved'
   order by created_at asc
   limit 1;
$$;

create or replace function public.current_member_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
    from public.members
   where auth_user_id = auth.uid()
     and status in ('active', 'invited')
   order by created_at asc
   limit 1;
$$;

-- Lock down the helpers (anyone authenticated can call them, no one writes).
revoke all on function public.is_admin from public;
revoke all on function public.current_vendor_id from public;
revoke all on function public.current_member_id from public;
grant execute on function public.is_admin to authenticated, anon;
grant execute on function public.current_vendor_id to authenticated;
grant execute on function public.current_member_id to authenticated;

-- =====================================================================
-- Enable RLS on every table
-- (waitlist_signups already has it enabled from 0001)
-- =====================================================================

alter table public.vendor_applications  enable row level security;
alter table public.vendors              enable row level security;
alter table public.catalog_items        enable row level security;
alter table public.catalog_media        enable row level security;
alter table public.offers               enable row level security;
alter table public.offer_media          enable row level security;
alter table public.redemptions          enable row level security;
alter table public.members              enable row level security;
alter table public.admin_users          enable row level security;
alter table public.review_actions       enable row level security;
alter table public.auth_audit           enable row level security;
alter table public.email_events         enable row level security;

-- =====================================================================
-- VENDOR APPLICATIONS
--   anon         → can INSERT a new application (the public signup form)
--   authenticated→ vendor sees their own (by contact_email); admin sees all
-- =====================================================================

drop policy if exists vendor_apps_insert_public on public.vendor_applications;
create policy vendor_apps_insert_public
  on public.vendor_applications
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists vendor_apps_select_owner on public.vendor_applications;
create policy vendor_apps_select_owner
  on public.vendor_applications
  for select
  to authenticated
  using (
    public.is_admin()
    or contact_email = (
      select email::citext from auth.users where id = auth.uid()
    )
  );

drop policy if exists vendor_apps_update_admin on public.vendor_applications;
create policy vendor_apps_update_admin
  on public.vendor_applications
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- VENDORS
--   anon         → can SELECT only approved + verified (public directory)
--   authenticated→ vendor sees / updates own; admin sees / updates all
-- =====================================================================

drop policy if exists vendors_select_public on public.vendors;
create policy vendors_select_public
  on public.vendors
  for select
  to anon
  using (status = 'approved' and verified = true);

drop policy if exists vendors_select_authed on public.vendors;
create policy vendors_select_authed
  on public.vendors
  for select
  to authenticated
  using (
    public.is_admin()
    or auth_user_id = auth.uid()
    or (status = 'approved' and verified = true)
  );

drop policy if exists vendors_update_self on public.vendors;
create policy vendors_update_self
  on public.vendors
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists vendors_update_admin on public.vendors;
create policy vendors_update_admin
  on public.vendors
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists vendors_insert_admin on public.vendors;
create policy vendors_insert_admin
  on public.vendors
  for insert
  to authenticated
  with check (public.is_admin());

-- =====================================================================
-- CATALOG ITEMS
--   anon         → SELECT approved items only (member directory)
--   authenticated→ vendor CRUDs their own; admin CRUDs all
-- =====================================================================

drop policy if exists catalog_select_public on public.catalog_items;
create policy catalog_select_public
  on public.catalog_items
  for select
  to anon
  using (review_status = 'approved');

drop policy if exists catalog_select_authed on public.catalog_items;
create policy catalog_select_authed
  on public.catalog_items
  for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
    or review_status = 'approved'
  );

drop policy if exists catalog_insert_own on public.catalog_items;
create policy catalog_insert_own
  on public.catalog_items
  for insert
  to authenticated
  with check (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

drop policy if exists catalog_update_own on public.catalog_items;
create policy catalog_update_own
  on public.catalog_items
  for update
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

drop policy if exists catalog_delete_own on public.catalog_items;
create policy catalog_delete_own
  on public.catalog_items
  for delete
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

-- =====================================================================
-- CATALOG MEDIA
-- Inherits visibility from the parent catalog item.
-- =====================================================================

drop policy if exists catalog_media_select on public.catalog_media;
create policy catalog_media_select
  on public.catalog_media
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_items ci
       where ci.id = catalog_media.catalog_item_id
         and (
              ci.review_status = 'approved'
           or ci.vendor_id = public.current_vendor_id()
           or public.is_admin()
         )
    )
  );

drop policy if exists catalog_media_mutate on public.catalog_media;
create policy catalog_media_mutate
  on public.catalog_media
  for all
  to authenticated
  using (
    exists (
      select 1 from public.catalog_items ci
       where ci.id = catalog_media.catalog_item_id
         and (ci.vendor_id = public.current_vendor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.catalog_items ci
       where ci.id = catalog_media.catalog_item_id
         and (ci.vendor_id = public.current_vendor_id() or public.is_admin())
    )
  );

-- =====================================================================
-- OFFERS
--   anon         → SELECT only approved + currently valid
--   authenticated→ vendor CRUDs their own; admin all
-- =====================================================================

drop policy if exists offers_select_public on public.offers;
create policy offers_select_public
  on public.offers
  for select
  to anon
  using (
    review_status = 'approved'
    and current_date between valid_from and valid_to
  );

drop policy if exists offers_select_authed on public.offers;
create policy offers_select_authed
  on public.offers
  for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
    or (review_status = 'approved' and current_date between valid_from and valid_to)
  );

drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own
  on public.offers
  for insert
  to authenticated
  with check (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

drop policy if exists offers_update_own on public.offers;
create policy offers_update_own
  on public.offers
  for update
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

drop policy if exists offers_delete_own on public.offers;
create policy offers_delete_own
  on public.offers
  for delete
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
  );

-- =====================================================================
-- OFFER MEDIA — same shape as catalog_media
-- =====================================================================

drop policy if exists offer_media_select on public.offer_media;
create policy offer_media_select
  on public.offer_media
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.offers o
       where o.id = offer_media.offer_id
         and (
              (o.review_status = 'approved' and current_date between o.valid_from and o.valid_to)
           or o.vendor_id = public.current_vendor_id()
           or public.is_admin()
         )
    )
  );

drop policy if exists offer_media_mutate on public.offer_media;
create policy offer_media_mutate
  on public.offer_media
  for all
  to authenticated
  using (
    exists (
      select 1 from public.offers o
       where o.id = offer_media.offer_id
         and (o.vendor_id = public.current_vendor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.offers o
       where o.id = offer_media.offer_id
         and (o.vendor_id = public.current_vendor_id() or public.is_admin())
    )
  );

-- =====================================================================
-- REDEMPTIONS
--   authenticated→ vendor sees own; member sees own; admin all
--   Inserts come from server-side service role (no anon insert).
-- =====================================================================

drop policy if exists redemptions_select on public.redemptions;
create policy redemptions_select
  on public.redemptions
  for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id = public.current_vendor_id()
    or member_id = public.current_member_id()
  );

drop policy if exists redemptions_admin_mutate on public.redemptions;
create policy redemptions_admin_mutate
  on public.redemptions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- MEMBERS
--   authenticated→ self sees + edits self; admin all
-- =====================================================================

drop policy if exists members_select_self on public.members;
create policy members_select_self
  on public.members
  for select
  to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());

drop policy if exists members_update_self on public.members;
create policy members_update_self
  on public.members
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists members_admin_mutate on public.members;
create policy members_admin_mutate
  on public.members
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- ADMIN USERS — admin only
-- =====================================================================

drop policy if exists admin_users_all on public.admin_users;
create policy admin_users_all
  on public.admin_users
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Special case: a user needs to read their OWN admin_users row at login
-- so the app can resolve their role. Allow self-read.
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
  on public.admin_users
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- =====================================================================
-- AUDIT LOGS — admin reads, server (service_role) inserts. Updates/deletes
-- intentionally not granted to any role to keep the trail immutable.
-- =====================================================================

drop policy if exists review_actions_select_admin on public.review_actions;
create policy review_actions_select_admin
  on public.review_actions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists review_actions_insert_admin on public.review_actions;
create policy review_actions_insert_admin
  on public.review_actions
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists auth_audit_select_admin on public.auth_audit;
create policy auth_audit_select_admin
  on public.auth_audit
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists email_events_select_admin on public.email_events;
create policy email_events_select_admin
  on public.email_events
  for select
  to authenticated
  using (public.is_admin());
